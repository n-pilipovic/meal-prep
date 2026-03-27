import { Injectable, signal, computed, inject, effect } from '@angular/core';
import { HttpClient } from '@angular/common/http';
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

  /** All household members' plans keyed by userId */
  private readonly allPlans = signal<Record<string, WeeklyPlan>>({});

  readonly plan = this.weeklyPlan.asReadonly();
  readonly householdPlans = this.allPlans.asReadonly();

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

  constructor() {
    this.loadPlan();

    // When household logs in, try to fetch plan from KV
    effect(() => {
      const userId = this.householdService.currentUserId();
      const code = this.householdService.householdCode();
      if (userId && code) {
        this.loadFromRemote(userId, code);
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
    const plan = this.allPlans()[userId];
    if (!plan) return null;
    const day = plan.days[dayIndex];
    return day?.meals.find(m => m.type === mealType) ?? null;
  }

  /** Get a specific user's day plan */
  getDayPlanForUser(userId: string, dayIndex: number): DayPlan | null {
    const plan = this.allPlans()[userId];
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
    // Update local allPlans cache
    this.allPlans.update(plans => ({ ...plans, [userId]: plan }));

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

  private loadFromRemote(userId: string, householdCode: string): void {
    this.api.getHouseholdPlans(householdCode).subscribe({
      next: (plans) => {
        this.allPlans.set(plans);
        // If user has a remote plan, use it
        if (plans[userId]) {
          this.weeklyPlan.set(plans[userId]);
          localStorage.setItem(STORAGE_KEY, JSON.stringify(plans[userId]));
        }
      },
    });
  }

  private todayDayIndex(): number {
    const jsDay = new Date().getDay();
    return jsDay === 0 ? 6 : jsDay - 1;
  }
}
