export interface MealPlanPreferences {
  calories: number;
  restrictions: string[];
  preferredIngredients: string[];
  avoidIngredients: string[];
  note: string;
}

export const DIETARY_RESTRICTIONS = [
  { key: 'vegetarian', label: 'Vegetarijansko' },
  { key: 'vegan', label: 'Vegansko' },
  { key: 'gluten-free', label: 'Bez glutena' },
  { key: 'lactose-free', label: 'Bez laktoze' },
  { key: 'no-pork', label: 'Bez svinjetine' },
  { key: 'no-red-meat', label: 'Bez crvenog mesa' },
  { key: 'pescatarian', label: 'Pesketarijansko' },
  { key: 'low-carb', label: 'Nisko ugljenih hidrata' },
  { key: 'high-protein', label: 'Visoko proteinsko' },
] as const;

export const DEFAULT_PREFERENCES: MealPlanPreferences = {
  calories: 2000,
  restrictions: [],
  preferredIngredients: [],
  avoidIngredients: [],
  note: '',
};
