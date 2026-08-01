import { Injectable, inject, signal, computed, DestroyRef } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { Router } from '@angular/router';
import { SwPush } from '@angular/service-worker';
import { ApiService } from './api.service';
import { HouseholdService } from './household.service';
import { PwaInstallService } from './pwa-install.service';
import { MealDataService } from './meal-data.service';
import { MealTimeService } from './meal-time.service';
import { MealType, MEAL_LABELS } from '../models/meal.model';
import { NotificationPreferences } from '../models/user.model';
import { environment } from '../../../environments/environment';

const PREFS_STORAGE_KEY = 'meal-prep:notification-prefs';

@Injectable({ providedIn: 'root' })
export class NotificationService {
  private readonly swPush = inject(SwPush);
  private readonly api = inject(ApiService);
  private readonly householdService = inject(HouseholdService);
  private readonly pwaInstall = inject(PwaInstallService);
  private readonly mealData = inject(MealDataService);
  private readonly mealTimes = inject(MealTimeService);
  private readonly router = inject(Router);
  private readonly destroyRef = inject(DestroyRef);

  private foregroundTimers: ReturnType<typeof setTimeout>[] = [];

  readonly pushSupported = signal(this.checkPushSupport());
  readonly permissionState = signal<NotificationPermission>(
    typeof Notification !== 'undefined' ? Notification.permission : 'default',
  );
  readonly isSubscribed = signal(false);

  readonly preferences = signal<NotificationPreferences>(this.loadPreferences());

  readonly canRequestPermission = computed(() => {
    return this.pushSupported() && this.permissionState() !== 'denied';
  });

  readonly needsInstallPrompt = computed(() => {
    return this.isIOS() && !this.pwaInstall.isStandalone();
  });

  constructor() {
    this.swPush.notificationClicks
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe(({ notification }) => {
        const url = notification?.data?.url;
        if (url) {
          // Strip base href prefix for Angular router navigation
          const path = url.replace(/^\/meal-prep/, '') || '/';
          this.router.navigateByUrl(path);
        }
      });
  }

  async requestPermissionAndSubscribe(): Promise<boolean> {
    if (!this.pushSupported()) return false;

    try {
      const vapidKey = this.getVapidPublicKey();
      if (!vapidKey) {
        console.warn('VAPID public key not configured');
        return false;
      }

      const sub = await this.swPush.requestSubscription({
        serverPublicKey: vapidKey,
      });

      const userId = this.householdService.currentUserId();
      if (userId) {
        this.api.saveSubscription(userId, sub.toJSON()).subscribe();
      }

      this.isSubscribed.set(true);
      this.permissionState.set('granted');
      this.updatePreferences({ ...this.preferences(), enabled: true });

      return true;
    } catch (err) {
      console.error('Push subscription failed:', err);
      this.permissionState.set(
        typeof Notification !== 'undefined' ? Notification.permission : 'denied',
      );
      return false;
    }
  }

  async unsubscribe(): Promise<void> {
    try {
      const userId = this.householdService.currentUserId();
      if (userId) {
        this.api.deleteSubscription(userId).subscribe();
      }

      await new Promise<void>((resolve) => {
        this.swPush.subscription.subscribe(sub => {
          if (sub) sub.unsubscribe().then(() => resolve());
          else resolve();
        });
      });
    } catch (err) {
      console.error('Unsubscribe failed:', err);
    }

    this.isSubscribed.set(false);
    this.clearForegroundTimers();
    this.updatePreferences({ ...this.preferences(), enabled: false });
  }

  updatePreferences(prefs: NotificationPreferences): void {
    this.preferences.set(prefs);
    localStorage.setItem(PREFS_STORAGE_KEY, JSON.stringify(prefs));
    this.syncPreferencesToApi(prefs);

    if (prefs.enabled) {
      this.scheduleForegroundReminders();
    } else {
      this.clearForegroundTimers();
    }
  }

  /**
   * Re-sends preferences after the user edits a meal time. The times live in
   * MealTimeService, but the worker reads them off the notification-prefs
   * record, so a schedule change has to be pushed from here.
   */
  syncMealTimes(): void {
    this.syncPreferencesToApi(this.preferences());
  }

  /**
   * The worker cron ticks every few minutes and needs two things the toggles
   * do not carry: the user's meal-time overrides and their IANA zone. Without
   * the zone a wall-clock time like "08:30" cannot be turned into an instant.
   */
  private syncPreferencesToApi(prefs: NotificationPreferences): void {
    const userId = this.householdService.currentUserId();
    if (!userId) return;

    this.api.saveNotificationPrefs(userId, {
      ...prefs,
      mealTimes: this.mealTimes.overrides(),
      timeZone: this.deviceTimeZone(),
    }).subscribe();
  }

  private deviceTimeZone(): string | undefined {
    try {
      return Intl.DateTimeFormat().resolvedOptions().timeZone || undefined;
    } catch {
      return undefined;
    }
  }

  scheduleForegroundReminders(): void {
    this.clearForegroundTimers();

    const prefs = this.preferences();
    if (!prefs.enabled) return;
    if (typeof Notification === 'undefined' || Notification.permission !== 'granted') return;

    const now = new Date();

    // Meal reminders (30 min before each meal)
    if (prefs.mealReminders) {
      const mealTypes = [MealType.Breakfast, MealType.Snack, MealType.Lunch, MealType.AfternoonSnack, MealType.Dinner];

      const day = this.mealData.currentDayPlan();

      for (const mealType of mealTypes) {
        // Personal override > this day's plan time > fallback
        const planTime = day?.meals.find(m => m.type === mealType)?.time;
        const time = this.mealTimes.resolve(mealType, planTime);
        if (!time) continue;

        const [hours, minutes] = time.split(':').map(Number);
        const reminderTime = new Date(now);
        reminderTime.setHours(hours, minutes - 30, 0, 0);

        const delay = reminderTime.getTime() - now.getTime();
        if (delay <= 0) continue;

        const timer = setTimeout(() => {
          this.showLocalNotification(mealType);
        }, delay);

        this.foregroundTimers.push(timer);
      }
    }

    // Daily summary at 7:00
    if (prefs.dailySummary) {
      const summaryTime = new Date(now);
      summaryTime.setHours(7, 0, 0, 0);

      const delay = summaryTime.getTime() - now.getTime();
      if (delay > 0) {
        const timer = setTimeout(() => {
          this.showDailySummaryNotification();
        }, delay);
        this.foregroundTimers.push(timer);
      }
    }
  }

  private showLocalNotification(mealType: MealType): void {
    const day = this.mealData.currentDayPlan();
    if (!day) return;

    const meal = day.meals.find(m => m.type === mealType);
    if (!meal) return;

    const label = MEAL_LABELS[mealType];
    const body = meal.ingredients
      .map(i => i.quantity != null ? `☐ ${i.name} ${i.quantity}${i.unit}` : `☐ ${i.name}`)
      .join('\n');

    new Notification(`${label} za 30 min (${this.mealTimes.resolve(mealType, meal.time)})`, {
      body: body || meal.name,
      icon: '/meal-prep/icons/icon-192x192.png',
      tag: `meal-${mealType}`,
    });
  }

  private showDailySummaryNotification(): void {
    const day = this.mealData.currentDayPlan();
    if (!day) return;

    const allIngredients = day.meals
      .flatMap(m => m.ingredients)
      .map(i => i.quantity != null ? `☐ ${i.name} ${i.quantity}${i.unit}` : `☐ ${i.name}`);

    new Notification(`Priprema za danas — ${day.dayName}`, {
      body: allIngredients.slice(0, 10).join('\n'),
      icon: '/meal-prep/icons/icon-192x192.png',
      tag: 'daily-summary',
    });
  }

  private clearForegroundTimers(): void {
    for (const timer of this.foregroundTimers) {
      clearTimeout(timer);
    }
    this.foregroundTimers = [];
  }

  private checkPushSupport(): boolean {
    return typeof window !== 'undefined' &&
      'serviceWorker' in navigator &&
      'PushManager' in window &&
      'Notification' in window;
  }

  isIOS(): boolean {
    if (typeof navigator === 'undefined') return false;
    return /iPad|iPhone|iPod/.test(navigator.userAgent) ||
      (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
  }

  private getVapidPublicKey(): string | null {
    return environment.vapidPublicKey || null;
  }

  private loadPreferences(): NotificationPreferences {
    const stored = localStorage.getItem(PREFS_STORAGE_KEY);
    if (stored) {
      try {
        return JSON.parse(stored);
      } catch {
        // fall through
      }
    }
    return this.defaultPreferences();
  }

  private defaultPreferences(): NotificationPreferences {
    return {
      enabled: false,
      dailySummary: true,
      mealReminders: true,
    };
  }
}
