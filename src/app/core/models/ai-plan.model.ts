export interface MealPlanPreferences {
  calories: number;
  ageGroup: string;
  restrictions: string[];
  preferredIngredients: string[];
  avoidIngredients: string[];
  note: string;
}

export const AGE_GROUPS = [
  { key: 'blw', label: 'BLW beba (6–12 mes.)', minCal: 600, maxCal: 900, defaultCal: 700 },
  { key: 'toddler', label: 'Malo dete (1–3 god.)', minCal: 900, maxCal: 1400, defaultCal: 1100 },
  { key: 'preschool', label: 'Predškolsko (4–6 god.)', minCal: 1100, maxCal: 1600, defaultCal: 1400 },
  { key: 'school', label: 'Školsko (7–10 god.)', minCal: 1400, maxCal: 2000, defaultCal: 1700 },
  { key: 'preteen', label: 'Mlađi tinejdžer (11–13 god.)', minCal: 1600, maxCal: 2400, defaultCal: 2000 },
  { key: 'teen', label: 'Tinejdžer (14–17 god.)', minCal: 1800, maxCal: 3000, defaultCal: 2200 },
  { key: 'adult', label: 'Odrasli (18+ god.)', minCal: 1200, maxCal: 3500, defaultCal: 2000 },
] as const;

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
  ageGroup: 'adult',
  restrictions: [],
  preferredIngredients: [],
  avoidIngredients: [],
  note: '',
};
