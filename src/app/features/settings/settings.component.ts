import {
  Component,
  computed,
  effect,
  inject,
  linkedSignal,
  untracked,
  ChangeDetectionStrategy,
} from '@angular/core';
import { form, FormField } from '@angular/forms/signals';
import { RouterLink } from '@angular/router';
import { APP_VERSION } from '../../../environments/version';
import { HouseholdService } from '../../core/services/household.service';
import { NotificationService } from '../../core/services/notification.service';
import { PwaInstallService } from '../../core/services/pwa-install.service';
import { MealTimeService, MEAL_TYPE_ORDER } from '../../core/services/meal-time.service';
import { MealType, MEAL_LABELS } from '../../core/models/meal.model';
import { UserAvatarComponent } from '../../shared/components/user-avatar.component';

const MEAL_ICONS: Record<MealType, string> = {
  [MealType.Breakfast]: '🍳',
  [MealType.Snack]: '🍎',
  [MealType.Lunch]: '🍽️',
  [MealType.AfternoonSnack]: '🍪',
  [MealType.Dinner]: '🌙',
};

@Component({
  selector: 'app-settings',
  imports: [RouterLink, FormField, UserAvatarComponent],
  changeDetection: ChangeDetectionStrategy.Eager,
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
                class="mt-2 px-4 py-2 text-sm text-red-500 border border-red-200 rounded-lg min-h-11 self-start"
              >
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
            <div class="bg-red-50 rounded-xl p-3 mb-3" role="alert">
              <p class="text-sm text-red-600">
                Obaveštenja su blokirana. Omogućite ih u podešavanjima pretraživača.
              </p>
            </div>
          }

          @if (notificationService.pushSupported() && !notificationService.needsInstallPrompt()) {
            @if (
              !notificationService.isSubscribed() &&
              notificationService.permissionState() !== 'granted'
            ) {
              <button
                (click)="enableNotifications()"
                [disabled]="!notificationService.canRequestPermission()"
                class="w-full py-3 bg-green-primary text-white font-medium rounded-xl min-h-11 disabled:opacity-40 mb-3"
              >
                Omogući podsetnike
              </button>
            } @else {
              <div class="space-y-3">
                <!-- Priprema sastojaka toggle (daily summary at 7:00) -->
                <label class="flex items-center justify-between">
                  <div>
                    <span class="text-sm font-medium text-text-primary block"
                      >Priprema sastojaka</span
                    >
                    <span class="text-xs text-text-muted"
                      >Dnevni pregled svih sastojaka u 07:00</span
                    >
                  </div>
                  <input
                    type="checkbox"
                    [formField]="notifyForm.dailySummary"
                    class="w-5 h-5 accent-green-primary"
                  />
                </label>

                <!-- Podsetnici za obroke toggle (per-meal reminders) -->
                <label class="flex items-center justify-between">
                  <div>
                    <span class="text-sm font-medium text-text-primary block"
                      >Podsetnici za obroke</span
                    >
                    <span class="text-xs text-text-muted">30 min pre svakog obroka</span>
                  </div>
                  <input
                    type="checkbox"
                    [formField]="notifyForm.mealReminders"
                    class="w-5 h-5 accent-green-primary"
                  />
                </label>

                <!-- Odgovori na moje prijave toggle (issue reply notifications) -->
                <label class="flex items-center justify-between">
                  <div>
                    <span class="text-sm font-medium text-text-primary block"
                      >Odgovori na moje prijave</span
                    >
                    <span class="text-xs text-text-muted"
                      >Obaveštenje kad razvijač odgovori ili promeni status</span
                    >
                  </div>
                  <input
                    type="checkbox"
                    [formField]="notifyForm.issueUpdates"
                    class="w-5 h-5 accent-green-primary"
                  />
                </label>
              </div>
            }
          } @else if (
            !notificationService.pushSupported() && !notificationService.needsInstallPrompt()
          ) {
            <p class="text-sm text-text-muted">Obaveštenja nisu podržana u ovom pretraživaču</p>
          }
        </div>

        <!-- Meal times (per-user overrides on top of the imported plan) -->
        <div class="bg-white rounded-2xl shadow-sm p-4">
          <h2 class="font-semibold text-text-primary mb-1">Vreme obroka</h2>
          <p class="text-xs text-text-muted mb-3">
            Podrazumevano se koristi vreme iz uvezenog plana. Izmena ovde važi samo za tebe.
          </p>

          <div class="flex flex-col gap-2">
            @for (row of mealTimeRows(); track row.type) {
              <div class="flex items-center justify-between gap-3">
                <div class="min-w-0">
                  <span class="text-sm font-medium text-text-primary block">
                    <span aria-hidden="true">{{ row.icon }}</span> {{ row.label }}
                  </span>
                  @if (row.overridden) {
                    <span class="text-xs text-text-muted">Plan: {{ row.planTime }}</span>
                  }
                </div>
                <div class="flex items-center gap-1.5 shrink-0">
                  <input
                    type="time"
                    [formField]="mealTimeForm[row.type]"
                    [attr.aria-label]="'Vreme — ' + row.label"
                    class="px-2 py-2 text-sm border border-cream-dark rounded-lg min-h-11 bg-cream-light text-text-primary"
                  />
                  <button
                    type="button"
                    (click)="resetMealTime(row.type)"
                    [disabled]="!row.overridden"
                    [attr.aria-label]="'Vrati na vreme iz plana — ' + row.label"
                    class="w-11 h-11 flex items-center justify-center rounded-lg text-text-muted disabled:opacity-25"
                  >
                    <span aria-hidden="true">↺</span>
                  </button>
                </div>
              </div>
            }
          </div>

          @if (mealTimeService.hasOverrides()) {
            <button
              type="button"
              (click)="resetAllMealTimes()"
              class="mt-3 px-4 py-2 text-sm text-text-secondary border border-cream-dark rounded-lg min-h-11"
            >
              Vrati sve na plan
            </button>
          }
        </div>

        <!-- PWA install prompt (Chrome/Android) -->
        @if (pwaInstallService.canInstall()) {
          <div class="bg-white rounded-2xl shadow-sm p-4">
            <h2 class="font-semibold text-text-primary mb-2">Instaliraj aplikaciju</h2>
            <p class="text-sm text-text-muted mb-3">
              Dodaj na početni ekran za brži pristup i offline rad.
            </p>
            <button
              (click)="installPwa()"
              class="px-4 py-2 bg-orange-primary text-white font-medium rounded-lg min-h-11"
            >
              Instaliraj
            </button>
          </div>
        }

        <!-- Feedback / report issue -->
        <a
          routerLink="/report-issue"
          class="bg-white rounded-2xl shadow-sm p-4 flex items-center justify-between active:bg-cream-light transition-colors"
        >
          <div>
            <h2 class="font-semibold text-text-primary">Povratna informacija</h2>
            <p class="text-sm text-text-muted">Greška, predlog ili pitanje</p>
          </div>
          <span class="text-text-muted text-lg">›</span>
        </a>

        <!-- My issues / suggestions -->
        <a
          routerLink="/my-issues"
          class="bg-white rounded-2xl shadow-sm p-4 flex items-center justify-between active:bg-cream-light transition-colors"
        >
          <div>
            <h2 class="font-semibold text-text-primary">Moje prijave</h2>
            <p class="text-sm text-text-muted">Status tvojih prijava i predlozi domaćinstva</p>
          </div>
          <span class="text-text-muted text-lg">›</span>
        </a>

        <!-- Editor link -->
        <a
          routerLink="/editor"
          class="bg-white rounded-2xl shadow-sm p-4 flex items-center justify-between active:bg-cream-light transition-colors"
        >
          <div>
            <h2 class="font-semibold text-text-primary">Uredi plan</h2>
            <p class="text-sm text-text-muted">Izmeni obroke, sastojke i recepte</p>
          </div>
          <span class="text-text-muted text-lg">›</span>
        </a>

        <!-- App version -->
        <p class="text-center text-xs text-text-muted mt-2 font-mono">
          Verzija {{ version.version }} · {{ version.commit }}
        </p>
      </div>
    </div>
  `,
})
export class SettingsComponent {
  private readonly householdService = inject(HouseholdService);
  readonly notificationService = inject(NotificationService);
  readonly pwaInstallService = inject(PwaInstallService);
  readonly mealTimeService = inject(MealTimeService);

  readonly isLoggedIn = this.householdService.isLoggedIn;
  readonly householdCode = this.householdService.householdCode;
  readonly members = this.householdService.members;

  readonly prefs = this.notificationService.preferences;
  readonly version = APP_VERSION;

  readonly mealTimeRows = computed(() =>
    MEAL_TYPE_ORDER.map((type) => ({
      type,
      label: MEAL_LABELS[type],
      icon: MEAL_ICONS[type],
      planTime: this.mealTimeService.planTimeFor(type),
      overridden: this.mealTimeService.isOverridden(type),
    })),
  );

  /**
   * Both forms edit a copy seeded from the owning service and write back on
   * change: the services stay the source of truth, Signal Forms owns the inputs.
   */
  readonly mealTimeModel = linkedSignal<Record<MealType, string>>(() => {
    const times = {} as Record<MealType, string>;
    for (const type of MEAL_TYPE_ORDER) times[type] = this.mealTimeService.resolve(type);
    return times;
  });

  readonly mealTimeForm = form(this.mealTimeModel);

  readonly notifyModel = linkedSignal(() => {
    const prefs = this.notificationService.preferences();
    return {
      dailySummary: prefs.dailySummary,
      mealReminders: prefs.mealReminders,
      issueUpdates: prefs.issueUpdates ?? true,
    };
  });

  readonly notifyForm = form(this.notifyModel);

  constructor() {
    effect(() => {
      const edited = this.mealTimeModel();
      let touched = false;

      for (const type of MEAL_TYPE_ORDER) {
        const current = untracked(() => this.mealTimeService.resolve(type));
        if (edited[type] === current) continue;
        // Clearing the input means "go back to the plan", not "blank time".
        if (edited[type]) this.mealTimeService.setTime(type, edited[type]);
        else this.mealTimeService.resetTime(type);
        touched = true;
      }

      if (touched) untracked(() => this.rescheduleReminders());
    });

    effect(() => {
      const edited = this.notifyModel();
      const prefs = untracked(() => this.notificationService.preferences());
      if (
        edited.dailySummary === prefs.dailySummary &&
        edited.mealReminders === prefs.mealReminders &&
        edited.issueUpdates === (prefs.issueUpdates ?? true)
      ) {
        return;
      }
      untracked(() => this.notificationService.updatePreferences({ ...prefs, ...edited }));
    });
  }

  async enableNotifications(): Promise<void> {
    await this.notificationService.requestPermissionAndSubscribe();
  }

  resetMealTime(mealType: MealType): void {
    this.mealTimeService.resetTime(mealType);
    this.rescheduleReminders();
  }

  resetAllMealTimes(): void {
    this.mealTimeService.resetAll();
    this.rescheduleReminders();
  }

  /**
   * Foreground timers are pinned to the old clock time until re-armed, and the
   * worker only learns about the new schedule when preferences are re-sent.
   */
  private rescheduleReminders(): void {
    this.notificationService.syncMealTimes();
    if (this.prefs().enabled) {
      this.notificationService.scheduleForegroundReminders();
    }
  }

  async installPwa(): Promise<void> {
    await this.pwaInstallService.promptInstall();
  }

  logout(): void {
    this.householdService.logout();
  }
}
