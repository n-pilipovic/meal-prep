import { Component, inject, computed, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { HouseholdService } from '../../core/services/household.service';
import { NotificationService } from '../../core/services/notification.service';
import { MealType, MEAL_LABELS } from '../../core/models/meal.model';
import { UserAvatarComponent } from '../../shared/components/user-avatar.component';

@Component({
  selector: 'app-settings',
  imports: [RouterLink, FormsModule, UserAvatarComponent],
  template: `
    <div class="px-4 py-4 pb-24">
      <h1 class="text-xl font-bold text-text-primary mb-4">Podešavanja</h1>

      <div class="flex flex-col gap-3">
        <!-- Household info -->
        <div class="bg-white rounded-2xl shadow-sm p-4">
          <h2 class="font-semibold text-text-primary mb-2">Domaćinstvo</h2>
          @if (isLoggedIn()) {
            <div class="flex flex-col gap-2">
              <div class="flex items-center gap-2 text-sm text-text-secondary">
                <span>Kod:</span>
                <span class="font-mono font-semibold text-text-primary">{{ householdCode() }}</span>
              </div>
              <div class="flex flex-wrap gap-2 mt-1">
                @for (member of members(); track member.id) {
                  <div class="flex items-center gap-1.5 px-2 py-1 rounded-full bg-cream-light">
                    <app-user-avatar [user]="member" size="sm" />
                    <span class="text-sm">{{ member.name }}</span>
                  </div>
                }
              </div>
              <button
                (click)="logout()"
                class="mt-2 px-4 py-2 text-sm text-red-500 border border-red-200 rounded-lg min-h-11 self-start">
                Odjavi se
              </button>
            </div>
          } @else {
            <p class="text-sm text-text-muted">Niste prijavljeni u domaćinstvo</p>
          }
        </div>

        <!-- Notifications -->
        <div class="bg-white rounded-2xl shadow-sm p-4">
          <h2 class="font-semibold text-text-primary mb-2">Obaveštenja</h2>

          @if (notificationService.needsInstallPrompt()) {
            <!-- iOS install guide -->
            <div class="bg-cream-light rounded-xl p-3 mb-3">
              <p class="text-sm font-medium text-text-primary mb-2">Instaliraj aplikaciju</p>
              <p class="text-xs text-text-secondary mb-2">
                Za obaveštenja na iPhone-u, potrebno je instalirati aplikaciju:
              </p>
              <ol class="text-xs text-text-secondary list-decimal list-inside space-y-1">
                <li>Tapni na <strong>Share</strong> dugme (⬆️) u Safari-ju</li>
                <li>Izaberi <strong>"Add to Home Screen"</strong></li>
                <li>Tapni <strong>"Add"</strong></li>
                <li>Otvori aplikaciju sa Home ekrana</li>
              </ol>
            </div>
          }

          @if (notificationService.permissionState() === 'denied') {
            <div class="bg-red-50 rounded-xl p-3 mb-3">
              <p class="text-sm text-red-600">
                Obaveštenja su blokirana. Omogućite ih u podešavanjima pretraživača.
              </p>
            </div>
          }

          @if (notificationService.pushSupported() && !notificationService.needsInstallPrompt()) {
            @if (!notificationService.isSubscribed()) {
              <button
                (click)="enableNotifications()"
                [disabled]="!notificationService.canRequestPermission()"
                class="w-full py-3 bg-green-primary text-white font-medium rounded-xl min-h-11 disabled:opacity-40 mb-3">
                Omogući podsetnike
              </button>
            }

            @if (notificationService.isSubscribed() || notificationService.permissionState() === 'granted') {
              <!-- Notification preferences -->
              <div class="space-y-3">
                <!-- Daily summary toggle -->
                <label class="flex items-center justify-between">
                  <span class="text-sm text-text-primary">Dnevni pregled (07:00)</span>
                  <input type="checkbox"
                         [ngModel]="prefs().dailySummary.enabled"
                         (ngModelChange)="toggleDailySummary($event)"
                         class="w-5 h-5 accent-green-primary" />
                </label>

                <!-- Per-meal toggles -->
                @for (meal of mealTypes; track meal.type) {
                  <label class="flex items-center justify-between">
                    <span class="text-sm text-text-primary">{{ meal.label }} ({{ meal.time }})</span>
                    <input type="checkbox"
                           [ngModel]="prefs().mealReminders[meal.type]?.enabled"
                           (ngModelChange)="toggleMealReminder(meal.type, $event)"
                           class="w-5 h-5 accent-green-primary" />
                  </label>
                }
              </div>
            }
          } @else if (!notificationService.pushSupported() && !notificationService.needsInstallPrompt()) {
            <p class="text-sm text-text-muted">Obaveštenja nisu podržana u ovom pretraživaču</p>
          }
        </div>

        <!-- PWA install prompt (Chrome/Android) -->
        @if (showInstallBanner()) {
          <div class="bg-white rounded-2xl shadow-sm p-4">
            <h2 class="font-semibold text-text-primary mb-2">Instaliraj aplikaciju</h2>
            <p class="text-sm text-text-muted mb-3">
              Dodaj na početni ekran za brži pristup i offline rad.
            </p>
            <button
              (click)="installPwa()"
              class="px-4 py-2 bg-orange-primary text-white font-medium rounded-lg min-h-11">
              Instaliraj
            </button>
          </div>
        }

        <!-- Editor link -->
        <a routerLink="/editor"
           class="bg-white rounded-2xl shadow-sm p-4 flex items-center justify-between active:bg-cream-light transition-colors">
          <div>
            <h2 class="font-semibold text-text-primary">Uredi plan</h2>
            <p class="text-sm text-text-muted">Izmeni obroke, sastojke i recepte</p>
          </div>
          <span class="text-text-muted text-lg">›</span>
        </a>
      </div>
    </div>
  `,
})
export class SettingsComponent {
  private readonly householdService = inject(HouseholdService);
  readonly notificationService = inject(NotificationService);

  private deferredPrompt: any = null;
  readonly showInstallBanner = signal(false);

  readonly isLoggedIn = this.householdService.isLoggedIn;
  readonly householdCode = this.householdService.householdCode;
  readonly members = this.householdService.members;

  readonly prefs = this.notificationService.preferences;

  readonly mealTypes = [
    { type: MealType.Breakfast, label: MEAL_LABELS[MealType.Breakfast], time: '09:00' },
    { type: MealType.Snack, label: MEAL_LABELS[MealType.Snack], time: '11:00' },
    { type: MealType.Lunch, label: MEAL_LABELS[MealType.Lunch], time: '14:00' },
    { type: MealType.AfternoonSnack, label: MEAL_LABELS[MealType.AfternoonSnack], time: '16:00' },
    { type: MealType.Dinner, label: MEAL_LABELS[MealType.Dinner], time: '18:00' },
  ];

  constructor() {
    // Capture Chrome install prompt
    if (typeof window !== 'undefined') {
      window.addEventListener('beforeinstallprompt', (e: Event) => {
        e.preventDefault();
        this.deferredPrompt = e;
        this.showInstallBanner.set(true);
      });
    }
  }

  async enableNotifications(): Promise<void> {
    await this.notificationService.requestPermissionAndSubscribe();
  }

  toggleDailySummary(enabled: boolean): void {
    const current = this.prefs();
    this.notificationService.updatePreferences({
      ...current,
      dailySummary: { ...current.dailySummary, enabled },
    });
  }

  toggleMealReminder(mealType: MealType, enabled: boolean): void {
    const current = this.prefs();
    this.notificationService.updatePreferences({
      ...current,
      mealReminders: {
        ...current.mealReminders,
        [mealType]: { ...current.mealReminders[mealType], enabled },
      },
    });
  }

  async installPwa(): Promise<void> {
    if (!this.deferredPrompt) return;
    this.deferredPrompt.prompt();
    const result = await this.deferredPrompt.userChoice;
    if (result.outcome === 'accepted') {
      this.showInstallBanner.set(false);
    }
    this.deferredPrompt = null;
  }

  logout(): void {
    this.householdService.logout();
  }
}
