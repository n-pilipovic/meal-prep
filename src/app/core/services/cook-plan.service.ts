import { Injectable, inject, computed, effect, signal } from '@angular/core';
import { MealDataService } from './meal-data.service';
import { HouseholdService } from './household.service';
import { SyncService } from './sync.service';
import { ApiService } from './api.service';
import {
  DayPlan,
  DAY_NAMES,
  Ingredient,
  IngredientCategory,
  Meal,
  MealType,
  Recipe,
  WeeklyPlan,
} from '../models/meal.model';
import { UserProfile } from '../models/user.model';
import {
  BlockDish,
  BlockIngredient,
  CookBlock,
  CookMealInstance,
  CookPlanSettings,
  DEFAULT_COOK_PLAN_SETTINGS,
  DishMeta,
  DishRefineInput,
  PrepStep,
} from '../models/cook-plan.model';
import {
  getIngredientKey,
  getDisplayName,
  normalizeIngredientName,
} from '../utils/ingredient-normalizer';

/**
 * Heuristics for "does this meal need actual cooking?". Phase-1 deterministic
 * classifier — an AI refinement endpoint can override these later (issue #5).
 */
const COOKING_VERBS =
  /(kuva|skuva|obari|bariti|baren|peci|ispec|pečen|peče|prž|dinsta|grilu|grilovan|blanšir|restuj|zapec|posoli pa termički|rerna|rerni)/i;

const COOKED_DISH_NAMES =
  /(gulaš|čorba|supa|sarma|musaka|rižoto|paprikaš|đuveč|punjen|varivo|pasulj|pilav|ćufte|pljeskavic|kotlet|batak|karađorđev|prebranac|podvarak|bolonjeze|lazanj)/i;

const NO_COOK_NAMES =
  /(jogurt|kefir|kiselo mleko|voće|voćn|sendvič|tost\b|cerealij|ovsen|smuti|smoothie|orasi|bademi|kikiriki|urme|keks|puding od chia|chia)/i;

/** Dishes that spoil faster than the default 3-day window. */
const SHORT_SHELF_LIFE =
  /(salat|tartar|taratur|riba|oslić|losos|pastrmk|tuna|škamp|plodovi mora)/i;

const DEFAULT_KEEPS_DAYS = 3;
const SHORT_KEEPS_DAYS = 1;

const CATEGORY_ORDER: IngredientCategory[] = [
  IngredientCategory.Meat,
  IngredientCategory.Produce,
  IngredientCategory.Grain,
  IngredientCategory.Dairy,
  IngredientCategory.Pantry,
  IngredientCategory.Spice,
  IngredientCategory.Oil,
];

/** Same junk filter as the shopping list: drop broken-import pseudo-ingredients. */
function isRealIngredient(name: string | null | undefined): boolean {
  if (typeof name !== 'string') return false;
  const trimmed = name.trim();
  if (!trimmed) return false;
  if (trimmed.length > 60) return false;
  if (/\.\s/.test(trimmed)) return false;
  const folded = trimmed
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '');
  if (/^(dorucak|uzina(\s*\d*)?|rucak|vecera)$/.test(folded)) return false;
  return true;
}

export function needsCooking(meal: Meal, recipes: Recipe[]): boolean {
  const text = `${meal.name} ${meal.description}`;
  if (NO_COOK_NAMES.test(meal.name)) return false;
  if (meal.ingredients.some(i => i.category === IngredientCategory.Meat)) return true;
  if (COOKED_DISH_NAMES.test(meal.name)) return true;
  if (COOKING_VERBS.test(text)) return true;
  const recipe = meal.recipeRef ? recipes.find(r => r.id === meal.recipeRef) : undefined;
  if (recipe && recipe.instructions.some(step => COOKING_VERBS.test(step))) return true;
  return false;
}

export function keepsDays(dishName: string): number {
  return SHORT_SHELF_LIFE.test(dishName) ? SHORT_KEEPS_DAYS : DEFAULT_KEEPS_DAYS;
}

/**
 * Pick the cooking day for a meal eaten on `consumeDay`: the closest cook day
 * at or before it, treating the week as cyclic (Sunday's cooking covers next
 * Monday). Returns the day plus how many days the dish sits before serving.
 */
export function assignCookDay(
  consumeDay: number,
  cookDays: number[],
): { cookDay: number; distance: number } | null {
  let best: { cookDay: number; distance: number } | null = null;
  for (const cookDay of cookDays) {
    const distance = (consumeDay - cookDay + 7) % 7;
    if (best === null || distance < best.distance) {
      best = { cookDay, distance };
    }
  }
  return best;
}

@Injectable({ providedIn: 'root' })
export class CookPlanService {
  private readonly mealData = inject(MealDataService);
  private readonly householdService = inject(HouseholdService);
  private readonly syncService = inject(SyncService);
  private readonly api = inject(ApiService);

  /** AI dish classification keyed by dish key; null until the user asks for it. */
  readonly aiMeta = signal<Record<string, DishMeta> | null>(null);
  readonly aiLoading = signal(false);
  readonly aiError = signal<string | null>(null);
  /** True when the worker could only serve cached classifications (provider down). */
  readonly aiIncomplete = signal(false);

  constructor() {
    // A different dish set makes the previous classification stale
    effect(() => {
      this.refineInput();
      this.aiMeta.set(null);
      this.aiIncomplete.set(false);
    });
  }

  readonly settings = computed<CookPlanSettings>(() => {
    return this.syncService.sharedState().cookPlanSettings ?? DEFAULT_COOK_PLAN_SETTINGS;
  });

  readonly checked = computed<Record<string, boolean>>(() => {
    return this.syncService.sharedState().cookPrepChecked ?? {};
  });

  /** Household plans in multi-user mode, the local plan otherwise. */
  private readonly activePlans = computed<{ plan: WeeklyPlan; user: UserProfile }[]>(() => {
    const members = this.householdService.members();
    const allPlans = this.mealData.householdPlans();
    const currentPlan = this.mealData.plan();
    const isMultiUser = members.length > 1 && Object.keys(allPlans).length > 0;

    if (isMultiUser) {
      return members
        .map(member => ({ plan: allPlans[member.id], user: member }))
        .filter((x): x is { plan: WeeklyPlan; user: UserProfile } => !!x.plan);
    }
    if (!currentPlan) return [];
    return [{ plan: currentPlan, user: { id: 'local', name: 'Ti', color: '#2d6a4f' } }];
  });

  /** Unique dishes across all plans — the AI refinement request payload. */
  private readonly refineInput = computed<DishRefineInput[]>(() => {
    const map = new Map<string, DishRefineInput>();
    for (const { plan } of this.activePlans()) {
      for (const day of plan.days) {
        for (const meal of day.meals) {
          const key = normalizeIngredientName(meal.name);
          if (!key || map.has(key)) continue;
          map.set(key, {
            key,
            name: meal.name,
            description: meal.description || undefined,
            ingredients: meal.ingredients
              .filter(i => isRealIngredient(i.name))
              .map(i => i.name),
          });
        }
      }
    }
    return Array.from(map.values());
  });

  /** Meal instances that require cooking, across every household member's plan. */
  private readonly cookedInstances = computed<CookMealInstance[]>(() => {
    const metaMap = this.aiMeta();
    const instances: CookMealInstance[] = [];
    for (const { plan, user } of this.activePlans()) {
      this.collectInstances(plan, user, metaMap, instances);
    }
    return instances;
  });

  /** Meals that can be assembled fresh — shown as context, never scheduled. */
  readonly noCookMealCount = computed<number>(() => {
    const metaMap = this.aiMeta();
    let total = 0;
    for (const { plan } of this.activePlans()) {
      for (const day of plan.days) {
        for (const meal of day.meals) {
          if (!this.effectiveNeedsCooking(meal, plan, metaMap)) total++;
        }
      }
    }
    return total;
  });

  loadAiRefinement(): void {
    if (this.aiLoading()) return;
    const dishes = this.refineInput();
    if (dishes.length === 0) return;

    this.aiLoading.set(true);
    this.aiError.set(null);
    this.api.refineCookPlan(dishes).subscribe({
      next: response => {
        const map: Record<string, DishMeta> = {};
        for (const meta of response.dishes) map[meta.key] = meta;
        this.aiMeta.set(map);
        this.aiIncomplete.set(!!response.incomplete);
        this.aiLoading.set(false);
      },
      error: err => {
        this.aiError.set(err.error?.error ?? 'AI analiza nije uspela. Pokušaj ponovo.');
        this.aiLoading.set(false);
      },
    });
  }

  readonly blocks = computed<CookBlock[]>(() => {
    const cookDays = [...this.settings().cookDayIndexes].sort((a, b) => a - b);
    if (cookDays.length === 0) return [];

    const instances = this.cookedInstances();
    const metaMap = this.aiMeta();

    // blockId → dishKey → accumulated dish + its instances
    const byBlock = new Map<number, Map<string, { dish: BlockDish; instances: CookMealInstance[] }>>();

    for (const instance of instances) {
      const assignment = assignCookDay(instance.source.dayIndex, cookDays);
      if (!assignment) continue;
      const keeps = metaMap?.[instance.dishKey]?.keepsDays ?? keepsDays(instance.dishName);
      const stale = assignment.distance > keeps;

      let dishes = byBlock.get(assignment.cookDay);
      if (!dishes) {
        dishes = new Map();
        byBlock.set(assignment.cookDay, dishes);
      }

      const existing = dishes.get(instance.dishKey);
      if (existing) {
        existing.dish.portions++;
        existing.dish.sources.push(instance.source);
        existing.dish.freshnessWarning ||= stale;
        existing.instances.push(instance);
      } else {
        dishes.set(instance.dishKey, {
          dish: {
            key: instance.dishKey,
            name: instance.dishName,
            portions: 1,
            sources: [instance.source],
            freshnessWarning: stale,
            recipeRef: instance.recipeRef,
          },
          instances: [instance],
        });
      }
    }

    return cookDays
      .filter(day => byBlock.has(day))
      .map(cookDay => {
        const entries = Array.from(byBlock.get(cookDay)!.values());
        const dishes = entries
          .map(e => e.dish)
          .sort((a, b) => b.portions - a.portions || a.name.localeCompare(b.name));
        const ingredients = this.aggregateBlockIngredients(entries);
        const coversDayIndexes = Array.from(
          new Set(entries.flatMap(e => e.dish.sources.map(s => s.dayIndex))),
        ).sort((a, b) => {
          // serving order starting from the cook day, wrapping around the week
          return ((a - cookDay + 7) % 7) - ((b - cookDay + 7) % 7);
        });

        const prepSteps: PrepStep[] = metaMap
          ? entries.flatMap(e =>
              (metaMap[e.dish.key]?.prepAhead ?? []).map((label, i) => ({
                key: `${e.dish.key}:${i}`,
                label,
                dishName: e.dish.name,
              })),
            )
          : [];

        return {
          id: `block-${cookDay}`,
          cookDayIndex: cookDay,
          label: `Kuvanje — ${DAY_NAMES[cookDay]}`,
          coversDayIndexes,
          dishes,
          ingredients,
          prepAhead: ingredients.filter(i => i.category === IngredientCategory.Produce),
          prepSteps,
        } satisfies CookBlock;
      });
  });

  setCookDays(dayIndexes: number[]): void {
    this.syncService.updateSharedState(state => ({
      ...state,
      cookPlanSettings: { cookDayIndexes: [...dayIndexes].sort((a, b) => a - b) },
    }));
  }

  toggleChecked(key: string): void {
    this.syncService.updateSharedState(state => ({
      ...state,
      cookPrepChecked: {
        ...(state.cookPrepChecked ?? {}),
        [key]: !(state.cookPrepChecked ?? {})[key],
      },
    }));
  }

  /** AI classification when present, deterministic heuristics otherwise. */
  private effectiveNeedsCooking(
    meal: Meal,
    plan: WeeklyPlan,
    metaMap: Record<string, DishMeta> | null,
  ): boolean {
    const meta = metaMap?.[normalizeIngredientName(meal.name)];
    return meta ? meta.needsCooking : needsCooking(meal, plan.recipes);
  }

  private collectInstances(
    plan: WeeklyPlan,
    user: UserProfile,
    metaMap: Record<string, DishMeta> | null,
    out: CookMealInstance[],
  ): void {
    for (const day of plan.days) {
      this.collectDayInstances(day, plan, user, metaMap, out);
    }
  }

  private collectDayInstances(
    day: DayPlan | undefined,
    plan: WeeklyPlan,
    user: UserProfile,
    metaMap: Record<string, DishMeta> | null,
    out: CookMealInstance[],
  ): void {
    if (!day) return;
    for (const meal of day.meals) {
      if (!this.effectiveNeedsCooking(meal, plan, metaMap)) continue;
      out.push({
        dishKey: normalizeIngredientName(meal.name),
        dishName: meal.name,
        source: {
          userId: user.id,
          userName: user.name,
          dayIndex: day.dayIndex,
          mealType: meal.type as MealType,
        },
        ingredients: meal.ingredients,
        recipeRef: meal.recipeRef,
      });
    }
  }

  /**
   * Aggregate ingredients across every dish of a block, keeping a per-dish
   * breakdown so the cook sees "Piletina 660g (140g + 300g + 220g)".
   */
  private aggregateBlockIngredients(
    entries: { dish: BlockDish; instances: CookMealInstance[] }[],
  ): BlockIngredient[] {
    const map = new Map<string, BlockIngredient>();

    for (const entry of entries) {
      for (const instance of entry.instances) {
        for (const ing of instance.ingredients) {
          if (!isRealIngredient(ing.name)) continue;
          const key = getIngredientKey(ing.name, ing.unit);
          let agg = map.get(key);
          if (!agg) {
            agg = {
              key,
              name: getDisplayName(key.replace(/_[^_]*$/, '')),
              quantity: null,
              unit: ing.unit,
              category: ing.category,
              contributions: [],
            };
            map.set(key, agg);
          }
          this.addContribution(agg, entry.dish.name, ing);
        }
      }
    }

    return Array.from(map.values()).sort((a, b) => {
      const ai = CATEGORY_ORDER.indexOf(a.category);
      const bi = CATEGORY_ORDER.indexOf(b.category);
      if (ai !== bi) return (ai === -1 ? 999 : ai) - (bi === -1 ? 999 : bi);
      return a.name.localeCompare(b.name);
    });
  }

  private addContribution(agg: BlockIngredient, dishName: string, ing: Ingredient): void {
    if (ing.quantity != null) {
      agg.quantity = (agg.quantity ?? 0) + ing.quantity;
    }
    const existing = agg.contributions.find(c => c.dishName === dishName);
    if (existing) {
      if (ing.quantity != null) {
        existing.quantity = (existing.quantity ?? 0) + ing.quantity;
      }
    } else {
      agg.contributions.push({ dishName, quantity: ing.quantity, unit: ing.unit });
    }
  }
}
