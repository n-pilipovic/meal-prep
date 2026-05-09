import { Injectable, inject, computed, signal, effect } from '@angular/core';
import { MealDataService } from './meal-data.service';
import { HouseholdService } from './household.service';
import { SyncService } from './sync.service';
import { ApiService } from './api.service';
import { IngredientCategory, MealType, DayPlan } from '../models/meal.model';
import { UserProfile } from '../models/user.model';
import {
  ShoppingSummaryGroup,
  ShoppingSummaryResponse,
} from '../models/shopping-summary.model';
import { getIngredientKey, getDisplayName } from '../utils/ingredient-normalizer';

export interface AggregatedIngredient {
  key: string;
  name: string;
  quantity: number | null;
  unit: string;
  category: IngredientCategory;
  /** Original distinct names that were merged into this entry */
  variants: string[];
  /** Which users need this ingredient (and from which meals) */
  sources: { userId: string; userName: string; mealType: MealType }[];
}

export interface IngredientGroup {
  category: IngredientCategory;
  label: string;
  items: AggregatedIngredient[];
}

const CATEGORY_LABELS: Record<IngredientCategory, string> = {
  [IngredientCategory.Meat]: 'Meso',
  [IngredientCategory.Dairy]: 'Mlečni proizvodi',
  [IngredientCategory.Produce]: 'Voće i povrće',
  [IngredientCategory.Grain]: 'Žitarice i hleb',
  [IngredientCategory.Pantry]: 'Ostava',
  [IngredientCategory.Spice]: 'Začini',
  [IngredientCategory.Oil]: 'Ulja',
};

const CATEGORY_ORDER: IngredientCategory[] = [
  IngredientCategory.Produce,
  IngredientCategory.Meat,
  IngredientCategory.Dairy,
  IngredientCategory.Grain,
  IngredientCategory.Pantry,
  IngredientCategory.Spice,
  IngredientCategory.Oil,
];

@Injectable({ providedIn: 'root' })
export class ShoppingListService {
  private readonly mealData = inject(MealDataService);
  private readonly householdService = inject(HouseholdService);
  private readonly syncService = inject(SyncService);
  private readonly api = inject(ApiService);

  readonly scope = signal<'today' | 'week'>('today');
  /** 'all' shows ingredients from every household member; a userId narrows to that member's plan */
  readonly filter = signal<'all' | string>('all');
  readonly search = signal('');

  /** 'list' shows the deterministic aggregated list; 'ai' shows the LLM-summarized shopping list */
  readonly viewMode = signal<'list' | 'ai'>('list');
  readonly aiSummary = signal<ShoppingSummaryResponse | null>(null);
  readonly aiLoading = signal(false);
  readonly aiError = signal<string | null>(null);
  /** Local check state for AI items, keyed by item index. Not synced. */
  readonly aiChecked = signal<Record<string, boolean>>({});

  constructor() {
    // If the selected member leaves the household, fall back to "all"
    effect(() => {
      const f = this.filter();
      if (f === 'all') return;
      const stillExists = this.householdService.members().some(m => m.id === f);
      if (!stillExists) this.filter.set('all');
    });

    // Invalidate AI summary whenever the underlying aggregated list changes
    effect(() => {
      this.aggregatedIngredients();
      this.aiSummary.set(null);
      this.aiChecked.set({});
    });
  }

  /** Aggregate ingredients across household members' plans, narrowed by `filter` */
  readonly aggregatedIngredients = computed<AggregatedIngredient[]>(() => {
    const members = this.householdService.members();
    const allPlans = this.mealData.householdPlans();
    const currentPlan = this.mealData.plan();
    const dayIndex = this.mealData.currentDayIndex();
    const filter = this.filter();
    const isMultiUser = members.length > 1 && Object.keys(allPlans).length > 0;

    const map = new Map<string, AggregatedIngredient>();

    if (isMultiUser) {
      const targets = filter === 'all' ? members : members.filter(m => m.id === filter);
      for (const member of targets) {
        const plan = allPlans[member.id];
        if (!plan) continue;
        const days = this.scope() === 'today' ? [plan.days[dayIndex]] : plan.days;
        this.aggregateDays(days, member, map);
      }
    } else {
      // Single-user / offline: use local plan
      if (!currentPlan) return [];
      const days = this.scope() === 'today' ? [currentPlan.days[dayIndex]] : currentPlan.days;
      const fakeUser: UserProfile = {
        id: 'local',
        name: 'Ti',
        color: '#2d6a4f',
      };
      this.aggregateDays(days, fakeUser, map);
    }

    return Array.from(map.values());
  });

  /** Filtered by search query */
  readonly searchedIngredients = computed<AggregatedIngredient[]>(() => {
    const items = this.aggregatedIngredients();
    const query = this.search().trim().toLowerCase();
    if (!query) return items;
    return items.filter(ing =>
      ing.name.toLowerCase().includes(query) ||
      ing.variants.some(v => v.toLowerCase().includes(query)),
    );
  });

  /** Grouped by category */
  readonly groupedIngredients = computed<IngredientGroup[]>(() => {
    const items = this.searchedIngredients();
    const groups = new Map<IngredientCategory, AggregatedIngredient[]>();

    for (const item of items) {
      const list = groups.get(item.category) ?? [];
      list.push(item);
      groups.set(item.category, list);
    }

    return Array.from(groups.entries()).map(([category, items]) => ({
      category,
      label: CATEGORY_LABELS[category] ?? category,
      items: items.sort((a, b) => a.name.localeCompare(b.name)),
    }));
  });

  /** Check state from shared sync */
  readonly checked = computed<Record<string, boolean>>(() => {
    return this.syncService.sharedState().shoppingChecked;
  });

  /** Assignments from shared sync */
  readonly assignments = computed<Record<string, string>>(() => {
    return this.syncService.sharedState().shoppingAssignments;
  });

  toggleChecked(key: string): void {
    this.syncService.updateSharedState(state => ({
      ...state,
      shoppingChecked: {
        ...state.shoppingChecked,
        [key]: !state.shoppingChecked[key],
      },
    }));
  }

  assignToUser(key: string, userId: string | null): void {
    this.syncService.updateSharedState(state => {
      const newAssignments = { ...state.shoppingAssignments };
      if (userId) {
        newAssignments[key] = userId;
      } else {
        delete newAssignments[key];
      }
      return { ...state, shoppingAssignments: newAssignments };
    });
  }

  /** AI summary grouped by category, sorted in shopping-aisle order with Serbian labels */
  readonly aiGroupedSummary = computed<({ label: string } & ShoppingSummaryGroup)[]>(() => {
    const summary = this.aiSummary();
    if (!summary) return [];

    return [...summary.groups]
      .sort((a, b) => {
        const ai = CATEGORY_ORDER.indexOf(a.category);
        const bi = CATEGORY_ORDER.indexOf(b.category);
        return (ai === -1 ? 999 : ai) - (bi === -1 ? 999 : bi);
      })
      .map(group => ({
        ...group,
        label: CATEGORY_LABELS[group.category] ?? group.category,
      }));
  });

  loadAiSummary(): void {
    if (this.aiLoading()) return;
    const items = this.searchedIngredients().map(ing => ({
      key: ing.key,
      name: ing.name,
      quantity: ing.quantity,
      unit: ing.unit,
      category: ing.category,
      variants: ing.variants,
    }));

    if (items.length === 0) {
      this.aiSummary.set({ groups: [] });
      return;
    }

    this.aiLoading.set(true);
    this.aiError.set(null);
    this.api.summarizeShoppingList(items).subscribe({
      next: (response) => {
        this.aiSummary.set(response);
        this.aiChecked.set({});
        this.aiLoading.set(false);
      },
      error: (err) => {
        this.aiError.set(err.error?.error ?? 'Sumarizacija nije uspela. Pokušaj ponovo.');
        this.aiLoading.set(false);
      },
    });
  }

  toggleAiChecked(itemKey: string): void {
    this.aiChecked.update(state => ({ ...state, [itemKey]: !state[itemKey] }));
  }

  private aggregateDays(
    days: (DayPlan | undefined)[],
    user: UserProfile,
    map: Map<string, AggregatedIngredient>,
  ): void {
    for (const day of days) {
      if (!day) continue;
      for (const meal of day.meals) {
        for (const ing of meal.ingredients) {
          const key = getIngredientKey(ing.name, ing.unit);
          const existing = map.get(key);
          if (existing) {
            if (existing.quantity != null && ing.quantity != null) {
              existing.quantity += ing.quantity;
            }
            if (!existing.variants.includes(ing.name)) {
              existing.variants.push(ing.name);
            }
            existing.sources.push({ userId: user.id, userName: user.name, mealType: meal.type as MealType });
          } else {
            map.set(key, {
              ...ing,
              name: getDisplayName(key.replace(/_[^_]*$/, '')),
              key,
              variants: [ing.name],
              sources: [{ userId: user.id, userName: user.name, mealType: meal.type as MealType }],
            });
          }
        }
      }
    }
  }
}
