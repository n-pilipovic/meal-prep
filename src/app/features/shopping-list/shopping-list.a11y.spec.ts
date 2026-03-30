import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { ShoppingListComponent } from './shopping-list.component';
import { MealDataService } from '../../core/services/meal-data.service';
import { MealType, IngredientCategory, WeeklyPlan } from '../../core/models/meal.model';

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
        { type: MealType.Snack, time: '11:00', name: 'U', description: '', ingredients: [] },
        { type: MealType.Lunch, time: '14:00', name: 'R', description: '', ingredients: [] },
        { type: MealType.Dinner, time: '18:00', name: 'V', description: '', ingredients: [] },
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

describe('ShoppingListComponent a11y', () => {
  let fixture: ComponentFixture<ShoppingListComponent>;
  let httpTesting: HttpTestingController;

  beforeEach(async () => {
    localStorage.clear();

    await TestBed.configureTestingModule({
      imports: [ShoppingListComponent],
      providers: [
        provideRouter([]),
        provideHttpClient(),
        provideHttpClientTesting(),
      ],
    }).compileComponents();

    httpTesting = TestBed.inject(HttpTestingController);
    const mealDataService = TestBed.inject(MealDataService);

    const req = httpTesting.expectOne('assets/data/weekly-plan.json');
    req.flush(MOCK_PLAN);
    mealDataService.setDayIndex(0);

    fixture = TestBed.createComponent(ShoppingListComponent);
    fixture.detectChanges();
  });

  afterEach(() => {
    httpTesting.verify();
    localStorage.clear();
  });

  it('should have aria-pressed on scope toggle buttons', () => {
    const buttons = fixture.nativeElement.querySelectorAll('button');
    const scopeButtons = Array.from(buttons).filter((b: any) =>
      b.hasAttribute('aria-pressed'),
    ) as HTMLButtonElement[];

    expect(scopeButtons.length).toBeGreaterThanOrEqual(2);

    const activeBtn = scopeButtons.find(b => b.getAttribute('aria-pressed') === 'true');
    expect(activeBtn).toBeTruthy();
    expect(activeBtn!.textContent!.trim()).toBe('Danas');
  });

  it('should wrap checkboxes in label elements', () => {
    const checkboxes = fixture.nativeElement.querySelectorAll('input[type="checkbox"]');
    for (const cb of checkboxes) {
      const label = cb.closest('label');
      expect(label).toBeTruthy();
    }
  });

  it('should have a heading hierarchy starting with h1', () => {
    const h1 = fixture.nativeElement.querySelector('h1');
    expect(h1).toBeTruthy();
    expect(h1.textContent).toContain('Lista za kupovinu');
  });
});
