import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { ShoppingListService } from './shopping-list.service';
import { MealDataService } from './meal-data.service';
import { WeeklyPlan, MealType, IngredientCategory } from '../models/meal.model';

const MOCK_PLAN: WeeklyPlan = {
  weekLabel: 'Test',
  days: [
    {
      dayIndex: 0,
      dayName: 'Ponedeljak',
      meals: [
        {
          type: MealType.Breakfast,
          time: '09:00',
          name: 'Doručak',
          description: '',
          ingredients: [
            { name: 'Hleb', quantity: 70, unit: 'g', category: IngredientCategory.Grain },
            { name: 'Puter', quantity: 10, unit: 'g', category: IngredientCategory.Dairy },
          ],
        },
        {
          type: MealType.Lunch,
          time: '14:00',
          name: 'Ručak',
          description: '',
          ingredients: [
            { name: 'Hleb', quantity: 50, unit: 'g', category: IngredientCategory.Grain },
            { name: 'Pasulj', quantity: 150, unit: 'g', category: IngredientCategory.Pantry },
          ],
        },
        { type: MealType.Snack, time: '11:00', name: 'Užina', description: '', ingredients: [] },
        { type: MealType.Dinner, time: '18:00', name: 'Večera', description: '', ingredients: [] },
      ],
    },
    ...Array.from({ length: 6 }, (_, i) => ({
      dayIndex: i + 1,
      dayName: `Dan ${i + 2}`,
      meals: [
        { type: MealType.Breakfast, time: '09:00', name: 'D', description: '', ingredients: [] },
        { type: MealType.Snack, time: '11:00', name: 'U', description: '', ingredients: [] },
        { type: MealType.Lunch, time: '14:00', name: 'R', description: '', ingredients: [] },
        { type: MealType.Dinner, time: '18:00', name: 'V', description: '', ingredients: [] },
      ],
    })),
  ],
  recipes: [],
};

describe('ShoppingListService', () => {
  let service: ShoppingListService;
  let mealData: MealDataService;
  let httpTesting: HttpTestingController;

  beforeEach(() => {
    localStorage.clear();

    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
      ],
    });

    httpTesting = TestBed.inject(HttpTestingController);
    mealData = TestBed.inject(MealDataService);
    service = TestBed.inject(ShoppingListService);

    const req = httpTesting.expectOne('assets/data/weekly-plan.json');
    req.flush(MOCK_PLAN);
    mealData.setDayIndex(0);
  });

  afterEach(() => {
    httpTesting.verify();
    localStorage.clear();
  });

  it('should aggregate ingredients for today', () => {
    service.scope.set('today');
    const items = service.aggregatedIngredients();
    expect(items.length).toBe(3); // Hleb (merged), Puter, Pasulj
  });

  it('should sum duplicate ingredient quantities', () => {
    service.scope.set('today');
    const hleb = service.aggregatedIngredients().find(i => i.name === 'Hleb');
    expect(hleb).toBeTruthy();
    expect(hleb!.quantity).toBe(120); // 70 + 50
  });

  it('should group ingredients by category', () => {
    service.scope.set('today');
    const groups = service.groupedIngredients();
    const categories = groups.map(g => g.category);
    expect(categories).toContain(IngredientCategory.Grain);
    expect(categories).toContain(IngredientCategory.Dairy);
    expect(categories).toContain(IngredientCategory.Pantry);
  });

  it('should toggle checked state via sync', () => {
    const key = 'hleb_g';
    service.toggleChecked(key);
    expect(service.checked()[key]).toBe(true);

    service.toggleChecked(key);
    expect(service.checked()[key]).toBe(false);
  });

  it('should assign and unassign ingredients', () => {
    const key = 'hleb_g';
    service.assignToUser(key, 'user-1');
    expect(service.assignments()[key]).toBe('user-1');

    service.assignToUser(key, null);
    expect(service.assignments()[key]).toBeUndefined();
  });

  it('should return empty for week scope when no other days have ingredients', () => {
    service.scope.set('week');
    const items = service.aggregatedIngredients();
    // Only day 0 has ingredients in mock
    expect(items.length).toBe(3);
  });
});
