import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { ShoppingListComponent } from './shopping-list.component';
import { MealDataService } from '../../core/services/meal-data.service';
import { ShoppingListService } from '../../core/services/shopping-list.service';
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

describe('ShoppingListComponent', () => {
  let fixture: ComponentFixture<ShoppingListComponent>;
  let httpTesting: HttpTestingController;
  let mealDataService: MealDataService;

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
    mealDataService = TestBed.inject(MealDataService);

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

  it('should display the shopping list title', () => {
    expect(fixture.nativeElement.textContent).toContain('Lista za kupovinu');
  });

  it('should show scope toggle buttons', () => {
    const buttons = fixture.nativeElement.querySelectorAll('button');
    const labels = Array.from(buttons).map((b: any) => b.textContent.trim());
    expect(labels).toContain('Danas');
    expect(labels).toContain('Cela nedelja');
  });

  it('should aggregate duplicate ingredients for today', () => {
    const text = fixture.nativeElement.textContent;
    expect(text).toContain('Hleb');
  });

  it('should show checkboxes for each ingredient', () => {
    const checkboxes = fixture.nativeElement.querySelectorAll('input[type="checkbox"]');
    // 3 unique ingredients: Hleb (aggregated), Puter, Pasulj
    expect(checkboxes.length).toBe(3);
  });

  it('should toggle checkbox state', () => {
    const checkbox = fixture.nativeElement.querySelector('input[type="checkbox"]');
    checkbox.click();
    fixture.detectChanges();

    expect(checkbox.checked).toBe(true);
  });
});
