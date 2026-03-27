export enum IngredientCategory {
  Meat = 'meat',
  Dairy = 'dairy',
  Produce = 'produce',
  Grain = 'grain',
  Pantry = 'pantry',
  Spice = 'spice',
  Oil = 'oil',
}

export enum MealType {
  Breakfast = 'dorucak',
  Snack = 'uzina',
  Lunch = 'rucak',
  Dinner = 'vecera',
}

export const MEAL_TIMES: Record<MealType, string> = {
  [MealType.Breakfast]: '09:00',
  [MealType.Snack]: '11:00',
  [MealType.Lunch]: '14:00',
  [MealType.Dinner]: '18:00',
};

export const MEAL_LABELS: Record<MealType, string> = {
  [MealType.Breakfast]: 'Doručak',
  [MealType.Snack]: 'Užina',
  [MealType.Lunch]: 'Ručak',
  [MealType.Dinner]: 'Večera',
};

export interface Ingredient {
  name: string;
  quantity: number | null;
  unit: string;
  category: IngredientCategory;
}

export interface Meal {
  type: MealType;
  time: string;
  name: string;
  description: string;
  ingredients: Ingredient[];
  recipeRef?: string;
}

export interface Recipe {
  id: string;
  name: string;
  servings: string;
  ingredients: Ingredient[];
  instructions: string[];
}

export interface DayPlan {
  dayIndex: number;
  dayName: string;
  meals: Meal[];
}

export interface WeeklyPlan {
  weekLabel: string;
  days: DayPlan[];
  recipes: Recipe[];
  extras?: {
    dessert?: string;
    drink?: string;
  };
}

export const DAY_NAMES = [
  'Ponedeljak',
  'Utorak',
  'Sreda',
  'Četvrtak',
  'Petak',
  'Subota',
  'Nedelja',
];
