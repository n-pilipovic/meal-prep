import { ComponentFixture, TestBed } from '@angular/core/testing';
import { Component, signal } from '@angular/core';
import { provideRouter } from '@angular/router';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { PrepChecklistComponent } from './prep-checklist.component';
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
            { name: 'Jaje', quantity: 2, unit: 'kom', category: IngredientCategory.Dairy },
            { name: 'Hleb', quantity: 50, unit: 'g', category: IngredientCategory.Grain },
          ],
        },
        { type: MealType.Snack, time: '11:00', name: 'Užina', description: '', ingredients: [] },
        {
          type: MealType.Lunch,
          time: '14:00',
          name: 'Ručak',
          description: '',
          ingredients: [
            { name: 'Piletina', quantity: 200, unit: 'g', category: IngredientCategory.Meat },
          ],
        },
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

@Component({
  imports: [PrepChecklistComponent],
  template: `<app-prep-checklist [dayIndex]="'0'" />`,
})
class TestHost {}

describe('PrepChecklistComponent a11y', () => {
  let fixture: ComponentFixture<TestHost>;
  let httpTesting: HttpTestingController;

  beforeEach(async () => {
    localStorage.clear();

    await TestBed.configureTestingModule({
      imports: [TestHost],
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

    fixture = TestBed.createComponent(TestHost);
    fixture.detectChanges();
  });

  afterEach(() => {
    httpTesting.verify();
    localStorage.clear();
  });

  it('should have a back button with aria-label', () => {
    const backBtn = fixture.nativeElement.querySelector('button[aria-label="Nazad"]');
    expect(backBtn).toBeTruthy();
  });

  it('should have a progress bar with role and aria attributes', () => {
    const progressBar = fixture.nativeElement.querySelector('[role="progressbar"]');
    expect(progressBar).toBeTruthy();
    expect(progressBar.getAttribute('aria-valuemin')).toBe('0');
    expect(progressBar.getAttribute('aria-valuemax')).toBe('100');
    expect(progressBar.hasAttribute('aria-valuenow')).toBe(true);
    expect(progressBar.hasAttribute('aria-label')).toBe(true);
  });

  it('should have progress count with aria-live', () => {
    const liveRegion = fixture.nativeElement.querySelector('[aria-live="polite"]');
    expect(liveRegion).toBeTruthy();
    expect(liveRegion.textContent).toContain('/');
  });

  it('should wrap checkboxes in label elements', () => {
    const checkboxes = fixture.nativeElement.querySelectorAll('input[type="checkbox"]');
    expect(checkboxes.length).toBeGreaterThan(0);
    for (const cb of checkboxes) {
      const label = cb.closest('label');
      expect(label).toBeTruthy();
    }
  });

  it('should hide back button chevron from screen readers', () => {
    const backBtn = fixture.nativeElement.querySelector('button[aria-label="Nazad"]');
    const hidden = backBtn.querySelector('[aria-hidden="true"]');
    expect(hidden).toBeTruthy();
    expect(hidden.textContent.trim()).toBe('‹');
  });
});
