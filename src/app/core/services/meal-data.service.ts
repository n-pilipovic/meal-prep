import { Injectable, signal, computed, inject, effect } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { rxResource } from '@angular/core/rxjs-interop';
import { of } from 'rxjs';
import { WeeklyPlan, DayPlan, Meal, MealType } from '../models/meal.model';
import { HouseholdService } from './household.service';
import { ApiService } from './api.service';

const STORAGE_KEY = 'meal-prep:weekly-plan';

@Injectable({ providedIn: 'root' })
export class MealDataService {
  private readonly http = inject(HttpClient);
  private readonly householdService = inject(HouseholdService);
  private readonly api = inject(ApiService);

  private readonly weeklyPlan = signal<WeeklyPlan | null>(null);
  readonly currentDayIndex = signal(this.todayDayIndex());
  readonly loading = signal(true);

  readonly plan = this.weeklyPlan.asReadonly();

  readonly currentDayPlan = computed<DayPlan | null>(() => {
    const plan = this.weeklyPlan();
    const idx = this.currentDayIndex();
    return plan?.days[idx] ?? null;
  });

  readonly allDays = computed<DayPlan[]>(() => {
    return this.weeklyPlan()?.days ?? [];
  });

  readonly recipes = computed(() => {
    return this.weeklyPlan()?.recipes ?? [];
  });

  /** Fetch household plans from KV — auto-cancels on param change */
  private readonly remotePlans = rxResource<Record<string, WeeklyPlan> | null, { userId: string | null; code: string | null }>({
    params: () => ({
      userId: this.householdService.currentUserId(),
      code: this.householdService.householdCode(),
    }),
    stream: ({ params: { userId, code } }) => {
      if (!userId || !code) return of(null);
      return this.api.getHouseholdPlans(code);
    },
  });

  /** Local overrides from savePlanForUser — merged on top of remote data */
  private readonly localPlanOverrides = signal<Record<string, WeeklyPlan>>({});

  /** Merged view: remote plans + local overrides */
  readonly householdPlans = computed<Record<string, WeeklyPlan>>(() => {
    const remote = this.remotePlans.value() ?? {};
    const local = this.localPlanOverrides();
    return { ...remote, ...local };
  });

  private seedAssigned = false;

  constructor() {
    this.loadPlan();

    // When remote plans arrive, update the current user's local plan
    effect(() => {
      const plans = this.remotePlans.value();
      const userId = this.householdService.currentUserId();
      if (plans && userId && plans[userId]) {
        this.weeklyPlan.set(plans[userId]);
        localStorage.setItem(STORAGE_KEY, JSON.stringify(plans[userId]));
      }
    });

    // Auto-assign seed plan to Ivana/Ica on first login
    effect(() => {
      const user = this.householdService.currentUser();
      const plan = this.weeklyPlan();
      const name = user?.name.toLowerCase();
      if (user && plan && (name === 'ivana' || name === 'ica') && !this.seedAssigned) {
        const plans = this.householdPlans();
        if (!plans[user.id]) {
          this.seedAssigned = true;
          this.savePlanForUser(user.id, plan);
        }
      }
    });
  }

  setDayIndex(index: number): void {
    if (index >= 0 && index <= 6) {
      this.currentDayIndex.set(index);
    }
  }

  getMealForDay(dayIndex: number, mealType: MealType): Meal | null {
    const plan = this.weeklyPlan();
    if (!plan) return null;
    const day = plan.days[dayIndex];
    return day?.meals.find(m => m.type === mealType) ?? null;
  }

  /** Get a specific user's meal for a day (for multi-user views) */
  getMealForUser(userId: string, dayIndex: number, mealType: MealType): Meal | null {
    const plan = this.householdPlans()[userId];
    if (!plan) return null;
    const day = plan.days[dayIndex];
    return day?.meals.find(m => m.type === mealType) ?? null;
  }

  /** Get a specific user's day plan */
  getDayPlanForUser(userId: string, dayIndex: number): DayPlan | null {
    const plan = this.householdPlans()[userId];
    return plan?.days[dayIndex] ?? null;
  }

  savePlanToLocalStorage(plan: WeeklyPlan): void {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(plan));
    this.weeklyPlan.set(plan);

    // Also save to remote if logged in
    const userId = this.householdService.currentUserId();
    if (userId) {
      this.api.savePlan(userId, plan).subscribe();
    }
  }

  /** Save a plan for a specific user (multi-user import/edit) */
  savePlanForUser(userId: string, plan: WeeklyPlan): void {
    // Update local overlay
    this.localPlanOverrides.update(overrides => ({ ...overrides, [userId]: plan }));

    // If this is the current user, also update the local plan
    if (userId === this.householdService.currentUserId()) {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(plan));
      this.weeklyPlan.set(plan);
    }

    // Save to remote
    this.api.savePlan(userId, plan).subscribe();
  }

  private loadPlan(): void {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored) {
      try {
        this.weeklyPlan.set(JSON.parse(stored));
        this.loading.set(false);
        return;
      } catch {
        localStorage.removeItem(STORAGE_KEY);
      }
    }

    this.http.get<WeeklyPlan>('assets/data/weekly-plan.json').subscribe({
      next: (plan) => {
        this.weeklyPlan.set(plan);
        this.loading.set(false);
      },
      error: () => {
        this.loading.set(false);
      },
    });
  }

  private todayDayIndex(): number {
    const jsDay = new Date().getDay();
    return jsDay === 0 ? 6 : jsDay - 1;
  }
}
