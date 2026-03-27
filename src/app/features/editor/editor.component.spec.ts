import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { EditorComponent } from './editor.component';
import { MealType, IngredientCategory, WeeklyPlan } from '../../core/models/meal.model';

const MOCK_PLAN: WeeklyPlan = {
  weekLabel: 'Test',
  days: Array.from({ length: 7 }, (_, i) => ({
    dayIndex: i,
    dayName: `Dan ${i + 1}`,
    meals: [
      { type: MealType.Breakfast, time: '09:00', name: `Doručak ${i}`, description: '', ingredients: [
        { name: 'Hleb', quantity: 70, unit: 'g', category: IngredientCategory.Grain },
      ] },
      { type: MealType.Snack, time: '11:00', name: `Užina ${i}`, description: '', ingredients: [] },
      { type: MealType.Lunch, time: '14:00', name: `Ručak ${i}`, description: '', ingredients: [] },
      { type: MealType.Dinner, time: '18:00', name: `Večera ${i}`, description: '', ingredients: [] },
    ],
  })),
  recipes: [
    { id: 'r1', name: 'Test Recept', servings: '2', ingredients: [], instructions: ['Korak 1'] },
  ],
};

describe('EditorComponent', () => {
  let fixture: ComponentFixture<EditorComponent>;
  let component: EditorComponent;
  let httpTesting: HttpTestingController;

  beforeEach(async () => {
    localStorage.clear();
    localStorage.setItem('meal-prep:weekly-plan', JSON.stringify(MOCK_PLAN));

    await TestBed.configureTestingModule({
      imports: [EditorComponent],
      providers: [
        provideRouter([]),
        provideHttpClient(),
        provideHttpClientTesting(),
      ],
    }).compileComponents();

    httpTesting = TestBed.inject(HttpTestingController);
    fixture = TestBed.createComponent(EditorComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  afterEach(() => {
    httpTesting.verify();
    localStorage.clear();
  });

  it('should display the editor title', () => {
    expect(fixture.nativeElement.textContent).toContain('Uredi plan');
  });

  it('should show tab buttons', () => {
    const text = fixture.nativeElement.textContent;
    expect(text).toContain('Obroci');
    expect(text).toContain('Recepti');
    expect(text).toContain('Uvoz');
  });

  it('should show day tabs', () => {
    const text = fixture.nativeElement.textContent;
    expect(text).toContain('Pon');
    expect(text).toContain('Uto');
    expect(text).toContain('Ned');
  });

  it('should show meal forms for selected day', () => {
    const text = fixture.nativeElement.textContent;
    expect(text).toContain('Doručak');
    expect(text).toContain('Užina');
    expect(text).toContain('Ručak');
    expect(text).toContain('Večera');
  });

  it('should show save and export buttons', () => {
    const buttons = fixture.nativeElement.querySelectorAll('button');
    const labels = Array.from(buttons).map((b: any) => b.textContent.trim());
    expect(labels).toContain('Sačuvaj');
    expect(labels).toContain('Izvezi JSON');
  });

  it('should switch to recipes tab', () => {
    component.activeTab.set('recipes');
    fixture.detectChanges();

    // Recipe form should be rendered
    const recipeForm = fixture.nativeElement.querySelector('app-recipe-form');
    expect(recipeForm).toBeTruthy();
    // "Dodaj recept" button should also appear
    expect(fixture.nativeElement.textContent).toContain('Dodaj recept');
  });

  it('should switch to import tab', () => {
    component.activeTab.set('import');
    fixture.detectChanges();

    expect(fixture.nativeElement.textContent).toContain('Uvezi iz .docx fajla');
    expect(fixture.nativeElement.textContent).toContain('Uvezi iz JSON fajla');
  });

  it('should load existing plan into editor', () => {
    const plan = component.editingPlan();
    expect(plan.weekLabel).toBe('Test');
    expect(plan.days.length).toBe(7);
    expect(plan.recipes.length).toBe(1);
  });

  it('should update meal when changed', () => {
    const updated = {
      ...MOCK_PLAN.days[0].meals[0],
      name: 'Novi Doručak',
    };
    component.updateMeal(0, MealType.Breakfast, updated);

    const plan = component.editingPlan();
    const breakfast = plan.days[0].meals.find(m => m.type === MealType.Breakfast);
    expect(breakfast?.name).toBe('Novi Doručak');
  });

  it('should add and remove recipes', () => {
    const initialCount = component.editingPlan().recipes.length;
    component.addRecipe();
    expect(component.editingPlan().recipes.length).toBe(initialCount + 1);

    component.removeRecipe(initialCount);
    expect(component.editingPlan().recipes.length).toBe(initialCount);
  });
});
