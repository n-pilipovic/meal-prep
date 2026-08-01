import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting } from '@angular/common/http/testing';
import { signal } from '@angular/core';
import { MealTimeService } from './meal-time.service';
import { HouseholdService } from './household.service';
import { MealDataService } from './meal-data.service';
import { DayPlan, MealType, IngredientCategory } from '../models/meal.model';

const STORAGE_KEY = 'meal-prep:meal-times';

function day(dayIndex: number, times: Partial<Record<MealType, string>>): DayPlan {
  return {
    dayIndex,
    dayName: `Dan ${dayIndex}`,
    meals: Object.entries(times).map(([type, time]) => ({
      type: type as MealType,
      time: time as string,
      name: 'Obrok',
      description: '',
      ingredients: [{ name: 'Sastojak', quantity: 1, unit: 'kom', category: IngredientCategory.Produce }],
    })),
  };
}

function setup(options: { userId?: string | null; days?: DayPlan[]; stored?: unknown } = {}) {
  localStorage.clear();
  if (options.stored !== undefined) {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(options.stored));
  }

  const currentUserId = signal<string | null>('userId' in options ? options.userId! : 'user-1');
  const allDays = signal<DayPlan[]>(options.days ?? []);

  TestBed.configureTestingModule({
    providers: [
      provideHttpClient(),
      provideHttpClientTesting(),
      { provide: HouseholdService, useValue: { currentUserId } },
      { provide: MealDataService, useValue: { allDays } },
      MealTimeService,
    ],
  });

  return { service: TestBed.inject(MealTimeService), currentUserId, allDays };
}

describe('MealTimeService', () => {
  afterEach(() => localStorage.clear());

  describe('resolution priority', () => {
    it('falls back to MEAL_TIMES when there is no plan time and no override', () => {
      const { service } = setup();
      expect(service.resolve(MealType.Breakfast)).toBe('09:00');
    });

    it('prefers the plan time passed by the caller over the MEAL_TIMES fallback', () => {
      const { service } = setup();
      expect(service.resolve(MealType.Breakfast, '07:30')).toBe('07:30');
    });

    it('prefers the plan time from the loaded plan when the caller passes none', () => {
      const { service } = setup({ days: [day(0, { [MealType.Lunch]: '13:00' })] });
      expect(service.resolve(MealType.Lunch)).toBe('13:00');
    });

    it('prefers the user override over the plan time', () => {
      const { service } = setup({ days: [day(0, { [MealType.Lunch]: '13:00' })] });
      service.setTime(MealType.Lunch, '12:15');
      expect(service.resolve(MealType.Lunch, '13:00')).toBe('12:15');
    });

    it('ignores a blank or malformed plan time', () => {
      const { service } = setup();
      expect(service.resolve(MealType.Dinner, '')).toBe('18:00');
      expect(service.resolve(MealType.Dinner, 'podne')).toBe('18:00');
      expect(service.resolve(MealType.Dinner, '25:00')).toBe('18:00');
    });

    it('takes the per-day time the caller passes over the per-type plan time', () => {
      const { service } = setup({ days: [day(0, { [MealType.Dinner]: '18:30' })] });
      expect(service.resolve(MealType.Dinner, '19:45')).toBe('19:45');
    });
  });

  describe('planTimes', () => {
    it('takes the first day that carries a usable time for that meal type', () => {
      const { service } = setup({
        days: [
          day(0, { [MealType.Snack]: '' }),
          day(1, { [MealType.Snack]: '10:30' }),
          day(2, { [MealType.Snack]: '11:45' }),
        ],
      });
      expect(service.planTimeFor(MealType.Snack)).toBe('10:30');
    });

    it('reacts to the plan being replaced', () => {
      const { service, allDays } = setup({ days: [day(0, { [MealType.Breakfast]: '09:00' })] });
      expect(service.resolve(MealType.Breakfast)).toBe('09:00');

      allDays.set([day(0, { [MealType.Breakfast]: '07:30' })]);
      expect(service.resolve(MealType.Breakfast)).toBe('07:30');
    });
  });

  describe('setTime', () => {
    it('rejects malformed input so a half-typed value cannot clobber a time', () => {
      const { service } = setup();
      service.setTime(MealType.Lunch, '1');
      service.setTime(MealType.Lunch, '99:99');
      service.setTime(MealType.Lunch, '');
      expect(service.isOverridden(MealType.Lunch)).toBe(false);
      expect(service.resolve(MealType.Lunch)).toBe('14:00');
    });

    it('treats a value equal to the plan time as clearing the override', () => {
      const { service } = setup({ days: [day(0, { [MealType.Lunch]: '13:00' })] });
      service.setTime(MealType.Lunch, '12:00');
      expect(service.isOverridden(MealType.Lunch)).toBe(true);

      service.setTime(MealType.Lunch, '13:00');
      expect(service.isOverridden(MealType.Lunch)).toBe(false);
      expect(localStorage.getItem(STORAGE_KEY)).toBeNull();
    });

    it('persists overrides to localStorage under the current user id', () => {
      const { service } = setup({ userId: 'user-1' });
      service.setTime(MealType.Dinner, '18:30');

      const raw = JSON.parse(localStorage.getItem(STORAGE_KEY)!);
      expect(raw).toEqual({ 'user-1': { vecera: '18:30' } });
    });
  });

  describe('reset', () => {
    it('resetTime drops a single meal type back to the plan time', () => {
      const { service } = setup({ days: [day(0, { [MealType.Breakfast]: '07:30', [MealType.Dinner]: '18:30' })] });
      service.setTime(MealType.Breakfast, '08:00');
      service.setTime(MealType.Dinner, '19:00');

      service.resetTime(MealType.Breakfast);

      expect(service.resolve(MealType.Breakfast)).toBe('07:30');
      expect(service.resolve(MealType.Dinner)).toBe('19:00');
    });

    it('resetAll clears every override and removes the storage entry', () => {
      const { service } = setup();
      service.setTime(MealType.Breakfast, '08:00');
      service.setTime(MealType.Dinner, '19:00');

      service.resetAll();

      expect(service.hasOverrides()).toBe(false);
      expect(localStorage.getItem(STORAGE_KEY)).toBeNull();
    });
  });

  describe('per-user isolation', () => {
    it('keeps a separate set of overrides for each household member', () => {
      const { service, currentUserId } = setup({ userId: 'user-1' });
      service.setTime(MealType.Lunch, '12:00');

      currentUserId.set('user-2');
      expect(service.isOverridden(MealType.Lunch)).toBe(false);
      expect(service.resolve(MealType.Lunch)).toBe('14:00');

      service.setTime(MealType.Lunch, '15:30');
      currentUserId.set('user-1');
      expect(service.resolve(MealType.Lunch)).toBe('12:00');
    });

    it('uses an anonymous bucket before login', () => {
      const { service } = setup({ userId: null });
      service.setTime(MealType.Lunch, '12:00');

      const raw = JSON.parse(localStorage.getItem(STORAGE_KEY)!);
      expect(raw).toEqual({ local: { rucak: '12:00' } });
    });
  });

  describe('loading', () => {
    it('restores overrides written by a previous session', () => {
      const { service } = setup({ userId: 'user-1', stored: { 'user-1': { rucak: '12:45' } } });
      expect(service.resolve(MealType.Lunch, '14:00')).toBe('12:45');
    });

    it('recovers from corrupt storage instead of throwing', () => {
      localStorage.clear();
      localStorage.setItem(STORAGE_KEY, 'not json');

      TestBed.configureTestingModule({
        providers: [
          provideHttpClient(),
          provideHttpClientTesting(),
          { provide: HouseholdService, useValue: { currentUserId: signal<string | null>('user-1') } },
          { provide: MealDataService, useValue: { allDays: signal<DayPlan[]>([]) } },
          MealTimeService,
        ],
      });

      const service = TestBed.inject(MealTimeService);
      expect(service.hasOverrides()).toBe(false);
      expect(localStorage.getItem(STORAGE_KEY)).toBeNull();
    });
  });
});
