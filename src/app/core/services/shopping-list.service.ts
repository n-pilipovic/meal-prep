import { Injectable, inject, computed, signal } from '@angular/core';
import { MealDataService } from './meal-data.service';
import { HouseholdService } from './household.service';
import { SyncService } from './sync.service';
import { Ingredient, IngredientCategory, MealType, MEAL_LABELS, DayPlan } from '../models/meal.model';
import { UserProfile } from '../models/user.model';

export interface AggregatedIngredient {
  key: string;
  name: string;
  quantity: number | null;
  unit: string;
  category: IngredientCategory;
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

@Injectable({ providedIn: 'root' })
export class ShoppingListService {
  private readonly mealData = inject(MealDataService);
  private readonly householdService = inject(HouseholdService);
  private readonly syncService = inject(SyncService);

  readonly scope = signal<'today' | 'week'>('today');
  readonly filter = signal<'all' | 'mine'>('all');

  /** Aggregate ingredients across all users' plans */
  readonly aggregatedIngredients = computed<AggregatedIngredient[]>(() => {
    const members = this.householdService.members();
    const allPlans = this.mealData.householdPlans();
    const currentPlan = this.mealData.plan();
    const dayIndex = this.mealData.currentDayIndex();
    const isMultiUser = members.length > 1 && Object.keys(allPlans).length > 0;

    const map = new Map<string, AggregatedIngredient>();

    if (isMultiUser) {
      // Multi-user: aggregate from all household members' plans
      for (const member of members) {
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

  /** Filtered by "Sve" / "Moje" assignment filter */
  readonly filteredIngredients = computed<AggregatedIngredient[]>(() => {
    const all = this.aggregatedIngredients();
    if (this.filter() === 'all') return all;

    const userId = this.householdService.currentUserId();
    if (!userId) return all;

    const assignments = this.syncService.sharedState().shoppingAssignments;
    return all.filter(ing => {
      const assignedTo = assignments[ing.key];
      // Show unassigned items + items assigned to me
      return !assignedTo || assignedTo === userId;
    });
  });

  /** Grouped by category */
  readonly groupedIngredients = computed<IngredientGroup[]>(() => {
    const items = this.filteredIngredients();
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

  private aggregateDays(
    days: (DayPlan | undefined)[],
    user: UserProfile,
    map: Map<string, AggregatedIngredient>,
  ): void {
    for (const day of days) {
      if (!day) continue;
      for (const meal of day.meals) {
        for (const ing of meal.ingredients) {
          const key = `${ing.name.toLowerCase()}_${ing.unit}`;
          const existing = map.get(key);
          if (existing) {
            if (existing.quantity != null && ing.quantity != null) {
              existing.quantity += ing.quantity;
            }
            existing.sources.push({ userId: user.id, userName: user.name, mealType: meal.type as MealType });
          } else {
            map.set(key, {
              ...ing,
              key,
              sources: [{ userId: user.id, userName: user.name, mealType: meal.type as MealType }],
            });
          }
        }
      }
    }
  }
}
