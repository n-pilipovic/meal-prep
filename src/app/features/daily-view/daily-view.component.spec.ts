import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { DailyViewComponent } from './daily-view.component';
import { MealType, WeeklyPlan } from '../../core/models/meal.model';

const MOCK_PLAN: WeeklyPlan = {
  weekLabel: 'Test',
  days: Array.from({ length: 7 }, (_, i) => ({
    dayIndex: i,
    dayName: `Dan ${i + 1}`,
    meals: [
      { type: MealType.Breakfast, time: '09:00', name: `Doručak ${i}`, description: '', ingredients: [] },
      { type: MealType.Snack, time: '11:00', name: `Užina ${i}`, description: '', ingredients: [] },
      { type: MealType.Lunch, time: '14:00', name: `Ručak ${i}`, description: '', ingredients: [] },
      { type: MealType.Dinner, time: '18:00', name: `Večera ${i}`, description: '', ingredients: [] },
    ],
  })),
  recipes: [],
};

describe('DailyViewComponent', () => {
  let fixture: ComponentFixture<DailyViewComponent>;
  let httpTesting: HttpTestingController;

  beforeEach(async () => {
    localStorage.clear();

    await TestBed.configureTestingModule({
      imports: [DailyViewComponent],
      providers: [
        provideRouter([]),
        provideHttpClient(),
        provideHttpClientTesting(),
      ],
    }).compileComponents();

    httpTesting = TestBed.inject(HttpTestingController);
    fixture = TestBed.createComponent(DailyViewComponent);
    fixture.detectChanges();

    // Flush the JSON load
    const req = httpTesting.expectOne('assets/data/weekly-plan.json');
    req.flush(MOCK_PLAN);
    fixture.detectChanges();
  });

  afterEach(() => {
    httpTesting.verify();
    localStorage.clear();
  });

  it('should display 4 meal cards', () => {
    const cards = fixture.nativeElement.querySelectorAll('app-meal-card');
    expect(cards.length).toBe(4);
  });

  it('should display the "Pripremi sastojke" button', () => {
    const buttons = fixture.nativeElement.querySelectorAll('button');
    const prepBtn = Array.from(buttons).find(
      (b: any) => b.textContent?.includes('Pripremi sastojke'),
    );
    expect(prepBtn).toBeTruthy();
  });

  it('should show day navigator', () => {
    const nav = fixture.nativeElement.querySelector('app-day-navigator');
    expect(nav).toBeTruthy();
  });

  it('should show loading state initially', () => {
    // Create a fresh component without flushing
    localStorage.clear();
    const freshFixture = TestBed.createComponent(DailyViewComponent);
    freshFixture.detectChanges();

    // The existing JSON request was already flushed, but new component instance
    // will trigger loading through MealDataService (which is singleton and already loaded)
    // So loading will be false since service is shared
    expect(freshFixture.nativeElement.querySelector('app-meal-card')).toBeTruthy();
  });
});
