import { Ingredient, IngredientCategory, MealType } from './meal.model';

/** Household-level settings for the batch-cooking planner (synced via SharedState). */
export interface CookPlanSettings {
  /** Day indexes (0 = Ponedeljak … 6 = Nedelja) on which the household can batch-cook. */
  cookDayIndexes: number[];
}

export const DEFAULT_COOK_PLAN_SETTINGS: CookPlanSettings = {
  // Sunday + Wednesday: two sessions that keep every dish within a 3-day freshness window
  cookDayIndexes: [2, 6],
};

/** One meal instance (a user eating a dish on a given day) covered by a cooking block. */
export interface DishSource {
  userId: string;
  userName: string;
  dayIndex: number;
  mealType: MealType;
}

/** A dish cooked once in a block, possibly covering several users/days. */
export interface BlockDish {
  key: string;
  name: string;
  portions: number;
  sources: DishSource[];
  /** True when at least one covered day falls outside the dish's freshness window. */
  freshnessWarning: boolean;
  recipeRef?: string;
}

/** How much of an ingredient a single dish contributes to the block total. */
export interface BlockIngredientContribution {
  dishName: string;
  quantity: number | null;
  unit: string;
}

/** An ingredient aggregated across all dishes of a block: "Piletina 660g (140g + 300g + 220g)". */
export interface BlockIngredient {
  key: string;
  name: string;
  quantity: number | null;
  unit: string;
  category: IngredientCategory;
  contributions: BlockIngredientContribution[];
}

/** A night-before prep step, either AI-generated or derived from produce. */
export interface PrepStep {
  key: string;
  label: string;
  dishName: string;
}

/** A single batch-cooking session. */
export interface CookBlock {
  id: string;
  cookDayIndex: number;
  label: string;
  /** Day indexes whose meals this block covers, in serving order. */
  coversDayIndexes: number[];
  dishes: BlockDish[];
  ingredients: BlockIngredient[];
  /** Produce that can be washed/chopped/peeled the evening before cooking. */
  prepAhead: BlockIngredient[];
  /** AI-generated night-before steps; preferred over `prepAhead` when present. */
  prepSteps: PrepStep[];
}

/** Dish sent to the worker's AI refinement endpoint. */
export interface DishRefineInput {
  key: string;
  name: string;
  description?: string;
  ingredients: string[];
}

/** AI classification of one dish (mirrors cf-worker/src/cook-plan.ts). */
export interface DishMeta {
  key: string;
  needsCooking: boolean;
  keepsDays: number;
  prepAhead: string[];
}

export interface CookPlanRefineResponse {
  dishes: DishMeta[];
  /** True when the AI provider failed and only cached entries were served. */
  incomplete?: boolean;
}

/** Raw ingredient with meal context, used while aggregating. */
export interface CookMealInstance {
  dishKey: string;
  dishName: string;
  source: DishSource;
  ingredients: Ingredient[];
  recipeRef?: string;
}
