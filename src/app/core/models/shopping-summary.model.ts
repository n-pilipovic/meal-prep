import { IngredientCategory } from './meal.model';

export interface ShoppingSummaryInputItem {
  key: string;
  name: string;
  quantity: number | null;
  unit: string;
  category: IngredientCategory;
  variants?: string[];
}

export interface ShoppingSummaryItem {
  name: string;
  quantity: number | null;
  unit: string;
  category: IngredientCategory;
  note?: string;
  sourceKeys: string[];
}

export interface ShoppingSummaryGroup {
  category: IngredientCategory;
  items: ShoppingSummaryItem[];
}

export interface ShoppingSummaryResponse {
  groups: ShoppingSummaryGroup[];
}
