import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { signal, computed, WritableSignal } from '@angular/core';
import { MealDataService } from './meal-data.service';
import { HouseholdService } from './household.service';
import { AuthService } from './auth.service';
import { ApiService } from './api.service';
import { WeeklyPlan, MealType } from '../models/meal.model';

const MOCK_PLAN: WeeklyPlan = {
  weekLabel: 'Test Week',
  days: [
    {
      dayIndex: 0,
      dayName: 'Ponedeljak',
      meals: [
        {
          type: MealType.Breakfast,
          time: '09:00',
          name: 'Test Doručak',
          description: 'Test opis',
          ingredients: [
            { name: 'Hleb', quantity: 70, unit: 'g', category: 'grain' as any },
            { name: 'Puter', quantity: 10, unit: 'g', category: 'dairy' as any },
          ],
        },
        {
          type: MealType.Snack,
          time: '11:00',
          name: 'Test Užina',
          description: 'Jabuka',
          ingredients: [{ name: 'Jabuka', quantity: 150, unit: 'g', category: 'produce' as any }],
        },
        {
          type: MealType.Lunch,
          time: '14:00',
          name: 'Test Ručak',
          description: 'Pasulj',
          ingredients: [{ name: 'Pasulj', quantity: 150, unit: 'g', category: 'pantry' as any }],
        },
        {
          type: MealType.Dinner,
          time: '18:00',
          name: 'Test Večera',
          description: 'Tunjevina',
          ingredients: [{ name: 'Tunjevina', quantity: 120, unit: 'g', category: 'meat' as any }],
        },
      ],
    },
    ...Array.from({ length: 6 }, (_, i) => ({
      dayIndex: i + 1,
      dayName: `Dan ${i + 2}`,
      meals: [],
    })),
  ],
  recipes: [
    {
      id: 'test-recipe',
      name: 'Test Recept',
      servings: '2 porcije',
      ingredients: [{ name: 'Brašno', quantity: 250, unit: 'g', category: 'grain' as any }],
      instructions: ['Korak 1', 'Korak 2'],
    },
  ],
};

let mockAuthUid: WritableSignal<string | null>;

describe('MealDataService', () => {
  let service: MealDataService;
  let httpTesting: HttpTestingController;

  beforeEach(() => {
    localStorage.clear();
    mockAuthUid = signal(null);

    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        {
          provide: AuthService,
          useValue: {
            uid: computed(() => mockAuthUid()),
            isLoggedIn: computed(() => mockAuthUid() !== null),
            isReady: computed(() => false),
            photoURL: computed(() => null as string | null),
            signOutUser: () => Promise.resolve(),
          },
        },
        MealDataService,
        HouseholdService,
        ApiService,
      ],
    });

    httpTesting = TestBed.inject(HttpTestingController);
    service = TestBed.inject(MealDataService);
  });

  afterEach(() => {
    httpTesting.verify();
    localStorage.clear();
  });

  it('should load plan from static JSON on init', () => {
    expect(service.loading()).toBe(true);

    const req = httpTesting.expectOne('assets/data/weekly-plan.json');
    req.flush(MOCK_PLAN);

    expect(service.loading()).toBe(false);
    expect(service.plan()).toBeTruthy();
    expect(service.plan()!.weekLabel).toBe('Test Week');
  });

  it('should persist and retrieve plan via localStorage', () => {
    const req = httpTesting.expectOne('assets/data/weekly-plan.json');
    req.flush(MOCK_PLAN);

    const modifiedPlan = { ...MOCK_PLAN, weekLabel: 'Cached' };
    service.savePlanToLocalStorage(modifiedPlan);

    expect(localStorage.getItem('meal-prep:weekly-plan')).toBeTruthy();
    const stored = JSON.parse(localStorage.getItem('meal-prep:weekly-plan')!);
    expect(stored.weekLabel).toBe('Cached');
  });

  it('should set and get current day index', () => {
    const req = httpTesting.expectOne('assets/data/weekly-plan.json');
    req.flush(MOCK_PLAN);

    service.setDayIndex(3);
    expect(service.currentDayIndex()).toBe(3);
  });

  it('should clamp day index to valid range', () => {
    const req = httpTesting.expectOne('assets/data/weekly-plan.json');
    req.flush(MOCK_PLAN);

    const before = service.currentDayIndex();
    service.setDayIndex(-1);
    expect(service.currentDayIndex()).toBe(before);

    service.setDayIndex(7);
    expect(service.currentDayIndex()).toBe(before);
  });

  it('should return current day plan based on index', () => {
    const req = httpTesting.expectOne('assets/data/weekly-plan.json');
    req.flush(MOCK_PLAN);

    service.setDayIndex(0);
    const dayPlan = service.currentDayPlan();
    expect(dayPlan).toBeTruthy();
    expect(dayPlan!.dayName).toBe('Ponedeljak');
    expect(dayPlan!.meals.length).toBe(4);
  });

  it('should return all days', () => {
    const req = httpTesting.expectOne('assets/data/weekly-plan.json');
    req.flush(MOCK_PLAN);

    expect(service.allDays().length).toBe(7);
  });

  it('should return recipes', () => {
    const req = httpTesting.expectOne('assets/data/weekly-plan.json');
    req.flush(MOCK_PLAN);

    expect(service.recipes().length).toBe(1);
    expect(service.recipes()[0].name).toBe('Test Recept');
  });

  it('should get meal for specific day and type', () => {
    const req = httpTesting.expectOne('assets/data/weekly-plan.json');
    req.flush(MOCK_PLAN);

    const meal = service.getMealForDay(0, MealType.Breakfast);
    expect(meal).toBeTruthy();
    expect(meal!.name).toBe('Test Doručak');
  });

  it('should return undefined for missing meal', () => {
    const req = httpTesting.expectOne('assets/data/weekly-plan.json');
    req.flush(MOCK_PLAN);

    // Day 1 has empty meals in mock
    const meal = service.getMealForDay(1, MealType.Breakfast);
    expect(meal).toBeFalsy();
  });

  it('should return null plan before loading', () => {
    // Don't flush - plan hasn't loaded yet
    expect(service.plan()).toBeNull();
    expect(service.currentDayPlan()).toBeNull();

    const req = httpTesting.expectOne('assets/data/weekly-plan.json');
    req.flush(MOCK_PLAN);
  });

  it('should save plan to localStorage', () => {
    const req = httpTesting.expectOne('assets/data/weekly-plan.json');
    req.flush(MOCK_PLAN);

    const modifiedPlan = { ...MOCK_PLAN, weekLabel: 'Modified' };
    service.savePlanToLocalStorage(modifiedPlan);

    expect(service.plan()!.weekLabel).toBe('Modified');
    const stored = JSON.parse(localStorage.getItem('meal-prep:weekly-plan')!);
    expect(stored.weekLabel).toBe('Modified');
  });

  it('should handle HTTP error gracefully', () => {
    const req = httpTesting.expectOne('assets/data/weekly-plan.json');
    req.error(new ProgressEvent('error'));

    expect(service.loading()).toBe(false);
    expect(service.plan()).toBeNull();
  });

  it('should auto-assign seed plan to user named Ivana', () => {
    const req = httpTesting.expectOne('assets/data/weekly-plan.json');
    req.flush(MOCK_PLAN);

    mockAuthUid.set('ivana-1');
    const householdService = TestBed.inject(HouseholdService);
    householdService.createHousehold('Ivana');

    const createReq = httpTesting.expectOne(r => r.url.includes('/api/household') && r.method === 'POST');
    createReq.flush({
      code: 'SEED01',
      userId: 'ivana-1',
      household: {
        code: 'SEED01',
        members: [{ id: 'ivana-1', name: 'Ivana', color: '#2d6a4f' }],
        createdAt: '2026-03-27T00:00:00Z',
      },
    });

    // Flush effects so loadFromRemote fires
    TestBed.flushEffects();

    const plansReq = httpTesting.expectOne(r => r.url.includes('/api/household/SEED01/plans'));
    plansReq.flush({});

    // Flush effects so seed assignment fires
    TestBed.flushEffects();

    const saveReq = httpTesting.expectOne(r => r.url.includes('/api/user/ivana-1/plan') && r.method === 'PUT');
    expect(saveReq.request.body.weekLabel).toBe('Test Week');
    saveReq.flush({ ok: true });
  });

  it('should auto-assign seed plan to user named Ica', () => {
    const req = httpTesting.expectOne('assets/data/weekly-plan.json');
    req.flush(MOCK_PLAN);

    mockAuthUid.set('ica-1');
    const householdService = TestBed.inject(HouseholdService);
    householdService.createHousehold('Ica');

    const createReq = httpTesting.expectOne(r => r.url.includes('/api/household') && r.method === 'POST');
    createReq.flush({
      code: 'SEED02',
      userId: 'ica-1',
      household: {
        code: 'SEED02',
        members: [{ id: 'ica-1', name: 'Ica', color: '#2d6a4f' }],
        createdAt: '2026-03-27T00:00:00Z',
      },
    });

    TestBed.flushEffects();

    const plansReq = httpTesting.expectOne(r => r.url.includes('/api/household/SEED02/plans'));
    plansReq.flush({});

    TestBed.flushEffects();

    const saveReq = httpTesting.expectOne(r => r.url.includes('/api/user/ica-1/plan') && r.method === 'PUT');
    expect(saveReq.request.body.weekLabel).toBe('Test Week');
    saveReq.flush({ ok: true });
  });

  it('should not auto-assign seed plan to other users', () => {
    const req = httpTesting.expectOne('assets/data/weekly-plan.json');
    req.flush(MOCK_PLAN);

    mockAuthUid.set('novica-1');
    const householdService = TestBed.inject(HouseholdService);
    householdService.createHousehold('Novica');

    const createReq = httpTesting.expectOne(r => r.url.includes('/api/household') && r.method === 'POST');
    createReq.flush({
      code: 'SEED03',
      userId: 'novica-1',
      household: {
        code: 'SEED03',
        members: [{ id: 'novica-1', name: 'Novica', color: '#2d6a4f' }],
        createdAt: '2026-03-27T00:00:00Z',
      },
    });

    TestBed.flushEffects();

    const plansReq = httpTesting.expectOne(r => r.url.includes('/api/household/SEED03/plans'));
    plansReq.flush({});

    TestBed.flushEffects();

    // No save request should be made for non-Ivana/Ica users
    httpTesting.expectNone(r => r.url.includes('/api/user/novica-1/plan'));
  });
});
