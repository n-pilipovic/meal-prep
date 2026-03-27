import { Injectable, inject, signal, computed } from '@angular/core';
import { SwPush } from '@angular/service-worker';
import { ApiService } from './api.service';
import { HouseholdService } from './household.service';
import { MealDataService } from './meal-data.service';
import { MealType, MEAL_LABELS, MEAL_TIMES } from '../models/meal.model';
import { NotificationPreferences } from '../models/user.model';

const PREFS_STORAGE_KEY = 'meal-prep:notification-prefs';
const VAPID_PUBLIC_KEY_STORAGE_KEY = 'meal-prep:vapid-public-key';

// Default VAPID public key placeholder — must be replaced with actual key
const DEFAULT_VAPID_PUBLIC_KEY = '';

@Injectable({ providedIn: 'root' })
export class NotificationService {
  private readonly swPush = inject(SwPush);
  private readonly api = inject(ApiService);
  private readonly householdService = inject(HouseholdService);
  private readonly mealData = inject(MealDataService);

  private foregroundTimers: ReturnType<typeof setTimeout>[] = [];

  readonly pushSupported = signal(this.checkPushSupport());
  readonly permissionState = signal<NotificationPermission>(
    typeof Notification !== 'undefined' ? Notification.permission : 'default',
  );
  readonly isSubscribed = signal(false);
  readonly isStandalone = signal(this.checkStandalone());

  readonly preferences = signal<NotificationPreferences>(this.loadPreferences());

  readonly canRequestPermission = computed(() => {
    return this.pushSupported() && this.permissionState() !== 'denied';
  });

  readonly needsInstallPrompt = computed(() => {
    // iOS needs PWA installed for push notifications
    return this.isIOS() && !this.isStandalone();
  });

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

      // Save subscription to server
      const userId = this.householdService.currentUserId();
      if (userId) {
        this.api.saveSubscription(userId, sub.toJSON()).subscribe();
      }

      this.isSubscribed.set(true);
      this.permissionState.set('granted');
      this.updatePreferences({ ...this.preferences(), enabled: true });

      // Start foreground scheduling as fallback
      this.scheduleForegroundReminders();

      return true;
    } catch (err) {
      console.error('Push subscription failed:', err);
      this.permissionState.set(
        typeof Notification !== 'undefined' ? Notification.permission : 'denied',
      );
      return false;
    }
  }

  updatePreferences(prefs: NotificationPreferences): void {
    this.preferences.set(prefs);
    localStorage.setItem(PREFS_STORAGE_KEY, JSON.stringify(prefs));

    if (prefs.enabled) {
      this.scheduleForegroundReminders();
    } else {
      this.clearForegroundTimers();
    }
  }

  /**
   * Foreground setTimeout-based reminders as fallback.
   * These fire local notifications when the app is open,
   * independent of push notifications from the Cloudflare Worker.
   */
  scheduleForegroundReminders(): void {
    this.clearForegroundTimers();

    const prefs = this.preferences();
    if (!prefs.enabled) return;
    if (typeof Notification === 'undefined' || Notification.permission !== 'granted') return;

    const now = new Date();
    const mealTypes = [MealType.Breakfast, MealType.Snack, MealType.Lunch, MealType.Dinner];

    for (const mealType of mealTypes) {
      const mealPref = prefs.mealReminders[mealType];
      if (!mealPref?.enabled) continue;

      const time = MEAL_TIMES[mealType];
      const [hours, minutes] = time.split(':').map(Number);
      const reminderTime = new Date(now);
      reminderTime.setHours(hours, minutes - mealPref.minutesBefore, 0, 0);

      const delay = reminderTime.getTime() - now.getTime();
      if (delay <= 0) continue; // Already passed today

      const timer = setTimeout(() => {
        this.showLocalNotification(mealType);
      }, delay);

      this.foregroundTimers.push(timer);
    }

    // Daily summary at 7:00
    if (prefs.dailySummary.enabled) {
      const [h, m] = prefs.dailySummary.time.split(':').map(Number);
      const summaryTime = new Date(now);
      summaryTime.setHours(h, m, 0, 0);

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

    new Notification(`${label} za 30 min (${meal.time})`, {
      body: body || meal.name,
      icon: '/icons/icon-192x192.png',
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
      icon: '/icons/icon-192x192.png',
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

  private checkStandalone(): boolean {
    if (typeof window === 'undefined') return false;
    return window.matchMedia('(display-mode: standalone)').matches ||
      (navigator as any).standalone === true;
  }

  isIOS(): boolean {
    if (typeof navigator === 'undefined') return false;
    return /iPad|iPhone|iPod/.test(navigator.userAgent) ||
      (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
  }

  private getVapidPublicKey(): string | null {
    const stored = localStorage.getItem(VAPID_PUBLIC_KEY_STORAGE_KEY);
    return stored || DEFAULT_VAPID_PUBLIC_KEY || null;
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
      dailySummary: { enabled: true, time: '07:00' },
      mealReminders: {
        [MealType.Breakfast]: { enabled: true, minutesBefore: 30 },
        [MealType.Snack]: { enabled: true, minutesBefore: 30 },
        [MealType.Lunch]: { enabled: true, minutesBefore: 30 },
        [MealType.Dinner]: { enabled: true, minutesBefore: 30 },
      },
    };
  }
}
