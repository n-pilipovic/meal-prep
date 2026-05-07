import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting, HttpTestingController } from '@angular/common/http/testing';
import { MealDetailComponent } from './meal-detail.component';
import { MealDataService } from '../../core/services/meal-data.service';
import { MealType, IngredientCategory, WeeklyPlan } from '../../core/models/meal.model';
import { Component, signal } from '@angular/core';

const MOCK_PLAN: WeeklyPlan = {
  weekLabel: 'Test',
  days: Array.from({ length: 7 }, (_, i) => ({
    dayIndex: i,
    dayName: `Dan ${i + 1}`,
    meals: [
      {
        type: MealType.Lunch,
        time: '14:00',
        name: 'Bolonjeze',
        description: 'Opis',
        ingredients: [
          { name: 'Meso', quantity: 200, unit: 'g', category: IngredientCategory.Meat },
          { name: 'Špagete', quantity: 100, unit: 'g', category: IngredientCategory.Grain },
        ],
        recipeRef: 'recipe-1',
      },
    ],
  })),
  recipes: [
    {
      id: 'recipe-1',
      name: 'Bolonjeze sos',
      servings: '2 porcije',
      ingredients: [],
      instructions: ['Prokuvaj vodu', 'Dodaj špagete', 'Pripremi sos', 'Serviraj'],
    },
  ],
};

@Component({
  imports: [MealDetailComponent],
  template: `<app-meal-detail [dayIndex]="dayIndex()" [mealType]="mealType()" [user]="user()" />`,
})
class TestHost {
  dayIndex = signal('0');
  mealType = signal('rucak');
  user = signal<string | undefined>(undefined);
}

describe('MealDetailComponent', () => {
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
    fixture = TestBed.createComponent(TestHost);
    fixture.detectChanges();

    const req = httpTesting.expectOne('assets/data/weekly-plan.json');
    req.flush(MOCK_PLAN);
    fixture.detectChanges();
  });

  afterEach(() => {
    httpTesting.verify();
    localStorage.clear();
  });

  it('should display meal name', () => {
    expect(fixture.nativeElement.textContent).toContain('Bolonjeze');
  });

  it('should display ingredients with checkboxes', () => {
    const checkboxes = fixture.nativeElement.querySelectorAll('input[type="checkbox"]');
    expect(checkboxes.length).toBe(2);
    expect(fixture.nativeElement.textContent).toContain('Meso');
    expect(fixture.nativeElement.textContent).toContain('Špagete');
  });

  it('should display recipe name and steps', () => {
    const text = fixture.nativeElement.textContent;
    expect(text).toContain('Bolonjeze sos');
    expect(text).toContain('Prokuvaj vodu');
    expect(text).toContain('Serviraj');
  });

  it('should show cook mode button when recipe exists', () => {
    const btn = fixture.nativeElement.querySelector('button[aria-label="Uđi u režim kuvanja"]');
    expect(btn).toBeTruthy();
    expect(btn.textContent).toContain('Kuvaj');
  });

  it('should resolve meal against another household member when [user] is set', () => {
    // Seed a different plan for "other-uid" via the service
    const mealData = TestBed.inject(MealDataService);
    const otherPlan: WeeklyPlan = {
      ...MOCK_PLAN,
      days: MOCK_PLAN.days.map((d, i) => ({
        ...d,
        meals: d.meals.map(m => ({ ...m, name: i === 0 ? 'Drugi obrok' : m.name })),
      })),
    };
    mealData.savePlanForUser('other-uid', otherPlan);

    // savePlanForUser triggers an HTTP PUT — handle it
    const saveReq = httpTesting.expectOne((req) => req.url.endsWith('/api/user/other-uid/plan'));
    saveReq.flush({ ok: true });

    fixture.componentInstance.user.set('other-uid');
    fixture.detectChanges();

    expect(fixture.nativeElement.textContent).toContain('Drugi obrok');
    expect(fixture.nativeElement.textContent).not.toContain('Bolonjeze špagete');
  });

  describe('Cook Mode', () => {
    beforeEach(() => {
      const btn = fixture.nativeElement.querySelector('button[aria-label="Uđi u režim kuvanja"]');
      btn.click();
      fixture.detectChanges();
    });

    it('should enter cook mode and show steps', () => {
      const steps = fixture.nativeElement.querySelectorAll('[id^="cook-step-"]');
      expect(steps.length).toBe(4);
    });

    it('should highlight active step (first step by default)', () => {
      const firstStep = fixture.nativeElement.querySelector('#cook-step-0');
      expect(firstStep.className).toContain('bg-green-primary');
      expect(firstStep.className).toContain('text-white');
    });

    it('should show progress counter', () => {
      expect(fixture.nativeElement.textContent).toContain('0/4');
    });

    it('should navigate to next step', () => {
      const nextBtn = Array.from(fixture.nativeElement.querySelectorAll('button') as NodeListOf<HTMLButtonElement>)
        .find((b: HTMLButtonElement) => b.textContent?.includes('Sledeći'));
      expect(nextBtn).toBeTruthy();
      nextBtn!.click();
      fixture.detectChanges();

      const secondStep = fixture.nativeElement.querySelector('#cook-step-1');
      expect(secondStep.className).toContain('bg-green-primary');
    });

    it('should navigate to previous step', () => {
      // Go to step 2 first
      const nextBtn = Array.from(fixture.nativeElement.querySelectorAll('button') as NodeListOf<HTMLButtonElement>)
        .find((b: HTMLButtonElement) => b.textContent?.includes('Sledeći'));
      nextBtn!.click();
      fixture.detectChanges();

      const prevBtn = Array.from(fixture.nativeElement.querySelectorAll('button') as NodeListOf<HTMLButtonElement>)
        .find((b: HTMLButtonElement) => b.textContent?.includes('Prethodni'));
      prevBtn!.click();
      fixture.detectChanges();

      const firstStep = fixture.nativeElement.querySelector('#cook-step-0');
      expect(firstStep.className).toContain('bg-green-primary');
    });

    it('should mark step as completed on click and update progress', () => {
      const firstStep = fixture.nativeElement.querySelector('#cook-step-0');
      firstStep.click();
      fixture.detectChanges();

      expect(fixture.nativeElement.textContent).toContain('1/4');
    });

    it('should show finish button on last step', () => {
      // Navigate to last step
      const component = fixture.debugElement.children[0].componentInstance as MealDetailComponent;
      component.activeStep.set(3);
      fixture.detectChanges();

      const finishBtn = Array.from(fixture.nativeElement.querySelectorAll('button') as NodeListOf<HTMLButtonElement>)
        .find((b: HTMLButtonElement) => b.textContent?.includes('Završi'));
      expect(finishBtn).toBeTruthy();
    });

    it('should exit cook mode on back button', () => {
      const backBtn = fixture.nativeElement.querySelector('button[aria-label="Izađi iz režima kuvanja"]');
      backBtn.click();
      fixture.detectChanges();

      // Should show regular view again with cook button
      const cookBtn = fixture.nativeElement.querySelector('button[aria-label="Uđi u režim kuvanja"]');
      expect(cookBtn).toBeTruthy();
    });

    it('should disable prev button on first step', () => {
      const prevBtn = Array.from(fixture.nativeElement.querySelectorAll('button') as NodeListOf<HTMLButtonElement>)
        .find((b: HTMLButtonElement) => b.textContent?.includes('Prethodni'));
      expect(prevBtn!.disabled).toBe(true);
    });
  });
});
