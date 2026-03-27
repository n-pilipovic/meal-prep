import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { PrepChecklistComponent } from './prep-checklist.component';
import { MealType, IngredientCategory, WeeklyPlan } from '../../core/models/meal.model';
import { Component } from '@angular/core';

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
          ],
        },
        {
          type: MealType.Lunch,
          time: '14:00',
          name: 'Ručak',
          description: '',
          ingredients: [
            { name: 'Pasulj', quantity: 150, unit: 'g', category: IngredientCategory.Pantry },
            { name: 'Kupus', quantity: null, unit: '', category: IngredientCategory.Produce },
          ],
        },
        { type: MealType.Snack, time: '11:00', name: 'Užina', description: '', ingredients: [] },
        { type: MealType.Dinner, time: '18:00', name: 'Večera', description: '', ingredients: [] },
      ],
    },
    ...Array.from({ length: 6 }, (_, i) => ({
      dayIndex: i + 1,
      dayName: `Dan ${i + 2}`,
      meals: [],
    })),
  ],
  recipes: [],
};

@Component({
  imports: [PrepChecklistComponent],
  template: `<app-prep-checklist dayIndex="0" />`,
})
class TestHost {}

describe('PrepChecklistComponent', () => {
  let fixture: ComponentFixture<TestHost>;
  let httpTesting: HttpTestingController;

  beforeEach(async () => {
    localStorage.clear();
    localStorage.setItem('meal-prep:weekly-plan', JSON.stringify(MOCK_PLAN));

    await TestBed.configureTestingModule({
      imports: [TestHost],
      providers: [
        provideRouter([]),
        provideHttpClient(),
        provideHttpClientTesting(),
      ],
    }).compileComponents();

    httpTesting = TestBed.inject(HttpTestingController);
    fixture = TestBed.createComponent(TestHost);
    fixture.detectChanges();
  });

  afterEach(() => {
    httpTesting.verify();
    localStorage.clear();
  });

  it('should display the prep title', () => {
    expect(fixture.nativeElement.textContent).toContain('Priprema za danas');
  });

  it('should display the day name', () => {
    expect(fixture.nativeElement.textContent).toContain('Ponedeljak');
  });

  it('should show progress as 0/3', () => {
    expect(fixture.nativeElement.textContent).toContain('0/3');
  });

  it('should show meal group headers', () => {
    const text = fixture.nativeElement.textContent;
    expect(text).toContain('Doručak');
    expect(text).toContain('Ručak');
  });

  it('should show ingredient checkboxes', () => {
    const checkboxes = fixture.nativeElement.querySelectorAll('input[type="checkbox"]');
    expect(checkboxes.length).toBe(3);
  });

  it('should update progress when checking items', () => {
    const checkbox = fixture.nativeElement.querySelector('input[type="checkbox"]');
    checkbox.click();
    fixture.detectChanges();

    expect(fixture.nativeElement.textContent).toContain('1/3');
  });

  it('should show back button', () => {
    const backBtn = fixture.nativeElement.querySelector('button');
    expect(backBtn?.textContent?.trim()).toContain('Nazad');
  });
});
