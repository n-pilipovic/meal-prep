import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { CookPlanService, assignCookDay, needsCooking, keepsDays } from './cook-plan.service';
import { MealDataService } from './meal-data.service';
import {
  WeeklyPlan,
  Meal,
  MealType,
  IngredientCategory,
  Ingredient,
} from '../models/meal.model';

function ing(
  name: string,
  quantity: number | null,
  unit = 'g',
  category = IngredientCategory.Produce,
): Ingredient {
  return { name, quantity, unit, category };
}

function meal(type: MealType, name: string, ingredients: Ingredient[], description = ''): Meal {
  return { type, time: '12:00', name, description, ingredients };
}

const EMPTY_MEALS: Meal[] = [];

const MOCK_PLAN: WeeklyPlan = {
  weekLabel: 'Test',
  days: [
    {
      dayIndex: 0,
      dayName: 'Ponedeljak',
      meals: [
        meal(MealType.Breakfast, 'Jogurt sa voćem', [
          ing('Jogurt', 200, 'ml', IngredientCategory.Dairy),
          ing('Banana', 1, 'kom'),
        ]),
        meal(MealType.Lunch, 'Grašak sa piletinom', [
          ing('Piletina', 140, 'g', IngredientCategory.Meat),
          ing('Grašak', 200, 'g'),
        ]),
      ],
    },
    {
      dayIndex: 1,
      dayName: 'Utorak',
      meals: [
        meal(MealType.Lunch, 'Gulaš sa piletinom', [
          ing('Piletina', 300, 'g', IngredientCategory.Meat),
          ing('Luk', 50, 'g'),
        ]),
      ],
    },
    { dayIndex: 2, dayName: 'Sreda', meals: EMPTY_MEALS },
    {
      dayIndex: 3,
      dayName: 'Četvrtak',
      meals: [
        meal(MealType.Lunch, 'Grilovana piletina', [
          ing('Piletina', 220, 'g', IngredientCategory.Meat),
        ]),
      ],
    },
    {
      dayIndex: 4,
      dayName: 'Petak',
      meals: [
        meal(MealType.Dinner, 'Tuna salata', [
          ing('Tuna', 100, 'g', IngredientCategory.Meat),
          ing('Zelena salata', 1, 'kom'),
        ]),
      ],
    },
    { dayIndex: 5, dayName: 'Subota', meals: EMPTY_MEALS },
    { dayIndex: 6, dayName: 'Nedelja', meals: EMPTY_MEALS },
  ],
  recipes: [],
};

describe('cook-plan pure helpers', () => {
  describe('assignCookDay', () => {
    it('returns null when no cook days are configured', () => {
      expect(assignCookDay(0, [])).toBeNull();
    });

    it('picks the closest cook day at or before the consumption day', () => {
      expect(assignCookDay(3, [2, 6])).toEqual({ cookDay: 2, distance: 1 });
      expect(assignCookDay(2, [2, 6])).toEqual({ cookDay: 2, distance: 0 });
    });

    it('wraps around the week: Sunday cooking covers Monday', () => {
      expect(assignCookDay(0, [2, 6])).toEqual({ cookDay: 6, distance: 1 });
      expect(assignCookDay(1, [2, 6])).toEqual({ cookDay: 6, distance: 2 });
    });
  });

  describe('needsCooking', () => {
    it('meals with meat need cooking', () => {
      const m = meal(MealType.Lunch, 'Piletina sa povrćem', [
        ing('Piletina', 200, 'g', IngredientCategory.Meat),
      ]);
      expect(needsCooking(m, [])).toBe(true);
    });

    it('assemble-only meals do not need cooking', () => {
      const m = meal(MealType.Snack, 'Jogurt sa voćem', [
        ing('Jogurt', 200, 'ml', IngredientCategory.Dairy),
      ]);
      expect(needsCooking(m, [])).toBe(false);
    });

    it('detects cooked dishes by name', () => {
      const m = meal(MealType.Lunch, 'Čorba od povrća', [ing('Šargarepa', 100, 'g')]);
      expect(needsCooking(m, [])).toBe(true);
    });

    it('detects cooking verbs in the description', () => {
      const m = meal(
        MealType.Dinner,
        'Povrće',
        [ing('Tikvica', 200, 'g')],
        'Dinstati tikvice na malo ulja',
      );
      expect(needsCooking(m, [])).toBe(true);
    });

    it('detects cooking verbs in linked recipe instructions', () => {
      const m: Meal = {
        ...meal(MealType.Lunch, 'Povrtni tanjir', [ing('Brokoli', 200, 'g')]),
        recipeRef: 'r1',
      };
      const recipes = [
        {
          id: 'r1',
          name: 'Povrtni tanjir',
          servings: '2',
          ingredients: [],
          instructions: ['Obariti brokoli 5 minuta.'],
        },
      ];
      expect(needsCooking(m, recipes)).toBe(true);
    });

    it('plain raw meals without verbs are not cooked', () => {
      const m = meal(MealType.Snack, 'Štapići šargarepe', [ing('Šargarepa', 100, 'g')]);
      expect(needsCooking(m, [])).toBe(false);
    });
  });

  describe('keepsDays', () => {
    it('salads and fish keep one day', () => {
      expect(keepsDays('Tuna salata')).toBe(1);
      expect(keepsDays('Pečeni oslić')).toBe(1);
    });

    it('regular cooked dishes keep three days', () => {
      expect(keepsDays('Gulaš sa piletinom')).toBe(3);
    });
  });
});

describe('CookPlanService', () => {
  let service: CookPlanService;
  let httpTesting: HttpTestingController;

  beforeEach(() => {
    localStorage.clear();

    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting()],
    });

    httpTesting = TestBed.inject(HttpTestingController);
    TestBed.inject(MealDataService);
    service = TestBed.inject(CookPlanService);

    const req = httpTesting.expectOne('assets/data/weekly-plan.json');
    req.flush(MOCK_PLAN);
  });

  afterEach(() => {
    httpTesting.verify();
    localStorage.clear();
  });

  it('uses default cook days (Wednesday + Sunday) when nothing is configured', () => {
    expect(service.settings().cookDayIndexes).toEqual([2, 6]);
  });

  it('splits cooked meals into blocks by closest preceding cook day', () => {
    const blocks = service.blocks();
    expect(blocks.map(b => b.id)).toEqual(['block-2', 'block-6']);

    const sunday = blocks.find(b => b.id === 'block-6')!;
    expect(sunday.dishes.map(d => d.name).sort()).toEqual([
      'Grašak sa piletinom',
      'Gulaš sa piletinom',
    ]);

    const wednesday = blocks.find(b => b.id === 'block-2')!;
    expect(wednesday.dishes.map(d => d.name).sort()).toEqual([
      'Grilovana piletina',
      'Tuna salata',
    ]);
  });

  it('excludes assemble-only meals from blocks but counts them', () => {
    const allDishes = service.blocks().flatMap(b => b.dishes.map(d => d.name));
    expect(allDishes).not.toContain('Jogurt sa voćem');
    expect(service.noCookMealCount()).toBeGreaterThan(0);
  });

  it('aggregates ingredients per block with per-dish breakdown', () => {
    const sunday = service.blocks().find(b => b.id === 'block-6')!;
    const piletina = sunday.ingredients.find(i => i.key === 'piletina_g')!;

    expect(piletina.quantity).toBe(440); // 140 + 300
    expect(piletina.contributions.length).toBe(2);
    expect(piletina.contributions.map(c => c.quantity).sort((a, b) => a! - b!)).toEqual([
      140, 300,
    ]);
  });

  it('lists produce as night-before prep', () => {
    const sunday = service.blocks().find(b => b.id === 'block-6')!;
    const prepNames = sunday.prepAhead.map(i => i.name);
    expect(prepNames).toContain('Grašak');
    expect(prepNames).toContain('Luk');
    expect(prepNames).not.toContain('Piletina');
  });

  it('flags dishes served outside their freshness window', () => {
    service.setCookDays([6]); // single Sunday session
    const sunday = service.blocks().find(b => b.id === 'block-6')!;

    // Thursday is 4 days after Sunday — beyond the 3-day default window
    const grilovana = sunday.dishes.find(d => d.name === 'Grilovana piletina')!;
    expect(grilovana.freshnessWarning).toBe(true);

    // Monday is 1 day after Sunday — fine
    const grasak = sunday.dishes.find(d => d.name === 'Grašak sa piletinom')!;
    expect(grasak.freshnessWarning).toBe(false);
  });

  it('merges repeated servings of the same dish into one contribution', () => {
    service.setCookDays([6]);
    const sunday = service.blocks().find(b => b.id === 'block-6')!;
    const piletina = sunday.ingredients.find(i => i.key === 'piletina_g')!;

    // 4 dishes feed into one block, chicken from 3 of them
    expect(piletina.quantity).toBe(660); // 140 + 300 + 220
    expect(piletina.contributions.length).toBe(3);
  });

  it('returns no blocks when no cook days are selected', () => {
    service.setCookDays([]);
    expect(service.blocks()).toEqual([]);
  });

  it('syncs check state through shared state', () => {
    service.toggleChecked('cook:block-6:prep:luk_g');
    expect(service.checked()['cook:block-6:prep:luk_g']).toBe(true);
    service.toggleChecked('cook:block-6:prep:luk_g');
    expect(service.checked()['cook:block-6:prep:luk_g']).toBe(false);
  });

  it('orders covered days in serving order starting from the cook day', () => {
    service.setCookDays([6]);
    const sunday = service.blocks().find(b => b.id === 'block-6')!;
    expect(sunday.coversDayIndexes).toEqual([0, 1, 3, 4]);
  });

  describe('AI refinement', () => {
    function flushRefine(dishes: object[]): void {
      service.loadAiRefinement();
      const req = httpTesting.expectOne(r => r.url.endsWith('/api/cook-plan/refine'));
      expect(req.request.method).toBe('POST');
      req.flush({ dishes });
    }

    it('sends every unique dish, including no-cook ones', () => {
      service.loadAiRefinement();
      const req = httpTesting.expectOne(r => r.url.endsWith('/api/cook-plan/refine'));
      const keys = (req.request.body as { dishes: { key: string }[] }).dishes.map(d => d.key);
      expect(keys).toContain('jogurt sa voćem');
      expect(keys).toContain('gulaš sa piletinom');
      req.flush({ dishes: [] });
    });

    it('AI classification overrides the needsCooking heuristic in both directions', () => {
      flushRefine([
        { key: 'jogurt sa voćem', needsCooking: true, keepsDays: 2, prepAhead: [] },
        { key: 'tuna salata', needsCooking: false, keepsDays: 1, prepAhead: [] },
      ]);

      const allDishes = service.blocks().flatMap(b => b.dishes.map(d => d.name));
      expect(allDishes).toContain('Jogurt sa voćem');
      expect(allDishes).not.toContain('Tuna salata');
    });

    it('AI keepsDays override clears the freshness warning', () => {
      service.setCookDays([6]);
      flushRefine([
        { key: 'grilovana piletina', needsCooking: true, keepsDays: 7, prepAhead: [] },
      ]);

      const sunday = service.blocks().find(b => b.id === 'block-6')!;
      const grilovana = sunday.dishes.find(d => d.name === 'Grilovana piletina')!;
      expect(grilovana.freshnessWarning).toBe(false);
    });

    it('exposes AI prep steps on the block', () => {
      flushRefine([
        {
          key: 'gulaš sa piletinom',
          needsCooking: true,
          keepsDays: 3,
          prepAhead: ['Iseckaj luk', 'Mariniraj piletinu'],
        },
      ]);

      const sunday = service.blocks().find(b => b.id === 'block-6')!;
      expect(sunday.prepSteps.map(s => s.label)).toEqual(['Iseckaj luk', 'Mariniraj piletinu']);
      expect(sunday.prepSteps[0].dishName).toBe('Gulaš sa piletinom');
    });

    it('surfaces a provider error without touching the heuristic blocks', () => {
      const before = service.blocks().length;
      service.loadAiRefinement();
      httpTesting
        .expectOne(r => r.url.endsWith('/api/cook-plan/refine'))
        .flush({ error: 'Analiza jela nije uspela.' }, { status: 500, statusText: 'Server Error' });

      expect(service.aiError()).toBe('Analiza jela nije uspela.');
      expect(service.aiMeta()).toBeNull();
      expect(service.blocks().length).toBe(before);
    });
  });
});
