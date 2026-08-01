import { Injectable, computed, inject, signal } from '@angular/core';
import { MealType, MEAL_TIMES } from '../models/meal.model';
import { HouseholdService } from './household.service';
import { MealDataService } from './meal-data.service';

const STORAGE_KEY = 'meal-prep:meal-times';

/** Bucket used before the user logs into a household. */
const ANON_USER = 'local';

const TIME_PATTERN = /^([01]\d|2[0-3]):[0-5]\d$/;

export type MealTimeOverrides = Partial<Record<MealType, string>>;

export const MEAL_TYPE_ORDER: MealType[] = [
  MealType.Breakfast,
  MealType.Snack,
  MealType.Lunch,
  MealType.AfternoonSnack,
  MealType.Dinner,
];

/**
 * Resolves the clock time shown for a meal, in priority order:
 *
 *   1. the current user's personal override (set in Podešavanja)
 *   2. the `time` carried by the imported plan's meal
 *   3. the plan's time for that meal type on any other day
 *   4. the `MEAL_TIMES` fallback
 *
 * Overrides are stored per user id, so two household members sharing a device
 * keep separate schedules.
 */
@Injectable({ providedIn: 'root' })
export class MealTimeService {
  private readonly householdService = inject(HouseholdService);
  private readonly mealData = inject(MealDataService);

  private readonly byUser = signal<Record<string, MealTimeOverrides>>(this.load());

  private readonly userKey = computed(() => this.householdService.currentUserId() ?? ANON_USER);

  /** The current user's overrides — empty object when nothing is customised. */
  readonly overrides = computed<MealTimeOverrides>(() => this.byUser()[this.userKey()] ?? {});

  readonly hasOverrides = computed(() => Object.keys(this.overrides()).length > 0);

  /**
   * Times declared by the imported plan, per meal type. Takes the first day
   * that carries a usable time so a plan is not required to fill every day.
   */
  readonly planTimes = computed<MealTimeOverrides>(() => {
    const times: MealTimeOverrides = {};
    for (const day of this.mealData.allDays()) {
      for (const meal of day.meals) {
        if (times[meal.type] === undefined && isUsableTime(meal.time)) {
          times[meal.type] = meal.time;
        }
      }
    }
    return times;
  });

  /**
   * @param planTime the `time` from the meal being rendered, when the caller
   *        has it — a per-day value beats the per-type one from `planTimes`.
   */
  resolve(mealType: MealType, planTime?: string | null): string {
    const override = this.overrides()[mealType];
    if (isUsableTime(override)) return override;
    if (isUsableTime(planTime)) return planTime;
    return this.planTimes()[mealType] ?? MEAL_TIMES[mealType] ?? '';
  }

  /** The time this meal type would show if the user's override were removed. */
  planTimeFor(mealType: MealType): string {
    return this.planTimes()[mealType] ?? MEAL_TIMES[mealType] ?? '';
  }

  isOverridden(mealType: MealType): boolean {
    return isUsableTime(this.overrides()[mealType]);
  }

  /** Ignores malformed input so a half-typed `<input type="time">` cannot wipe a time. */
  setTime(mealType: MealType, time: string): void {
    if (!TIME_PATTERN.test(time)) return;
    if (time === this.planTimeFor(mealType)) {
      // Matching the plan is the same as having no override.
      this.resetTime(mealType);
      return;
    }
    this.write({ ...this.overrides(), [mealType]: time });
  }

  resetTime(mealType: MealType): void {
    const next = { ...this.overrides() };
    delete next[mealType];
    this.write(next);
  }

  resetAll(): void {
    this.write({});
  }

  private write(overrides: MealTimeOverrides): void {
    const key = this.userKey();
    const next = { ...this.byUser() };
    if (Object.keys(overrides).length === 0) {
      delete next[key];
    } else {
      next[key] = overrides;
    }
    this.byUser.set(next);

    try {
      if (Object.keys(next).length === 0) {
        localStorage.removeItem(STORAGE_KEY);
      } else {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
      }
    } catch {
      // Private-mode / quota failures must not break the UI.
    }
  }

  private load(): Record<string, MealTimeOverrides> {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (!stored) return {};
    try {
      const parsed: unknown = JSON.parse(stored);
      if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) return {};
      return parsed as Record<string, MealTimeOverrides>;
    } catch {
      localStorage.removeItem(STORAGE_KEY);
      return {};
    }
  }
}

function isUsableTime(time: string | null | undefined): time is string {
  return typeof time === 'string' && TIME_PATTERN.test(time);
}
