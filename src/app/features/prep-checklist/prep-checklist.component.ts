import { Component, inject, input, computed, signal } from '@angular/core';
import { Location } from '@angular/common';
import { MealDataService } from '../../core/services/meal-data.service';
import { HouseholdService } from '../../core/services/household.service';
import { SyncService } from '../../core/services/sync.service';
import { MealType, MEAL_LABELS, Ingredient } from '../../core/models/meal.model';
import { UserProfile } from '../../core/models/user.model';
import { QuantityPipe } from '../../shared/pipes/quantity.pipe';
import { AssignmentBadgeComponent } from '../../shared/components/assignment-badge.component';
import { UserAvatarComponent } from '../../shared/components/user-avatar.component';

interface PrepItem {
  ingredient: Ingredient;
  key: string;
  userId: string;
  userName: string;
}

interface PrepMealGroup {
  mealType: MealType;
  label: string;
  items: PrepItem[];
}

interface PrepUserSection {
  user: UserProfile;
  mealGroups: PrepMealGroup[];
}

@Component({
  selector: 'app-prep-checklist',
  imports: [QuantityPipe, AssignmentBadgeComponent, UserAvatarComponent],
  template: `
    <div class="px-4 py-4">
      <button (click)="goBack()" class="mb-3 text-green-primary font-medium active:opacity-70 min-h-11 flex items-center">
        ‹ Nazad
      </button>

      <h1 class="text-xl font-bold text-text-primary mb-1">Priprema za danas</h1>

      @if (dayPlan(); as day) {
        <p class="text-sm text-text-muted mb-4">{{ day.dayName }}</p>

        <!-- Filter: Sve / Moje (multi-user only) -->
        @if (isMultiUser()) {
          <div class="flex gap-2 mb-3">
            @for (opt of filterOptions; track opt.value) {
              <button
                (click)="filter.set(opt.value)"
                class="px-3 py-1.5 rounded-full text-xs font-medium transition-colors min-h-9"
                [class.bg-green-primary]="filter() === opt.value"
                [class.text-white]="filter() === opt.value"
                [class.bg-white]="filter() !== opt.value"
                [class.text-text-muted]="filter() !== opt.value">
                {{ opt.label }}
              </button>
            }
          </div>
        }

        <!-- Progress bar -->
        <div class="bg-white rounded-2xl shadow-sm p-4 mb-4">
          <div class="flex justify-between items-center">
            <span class="text-sm text-text-secondary">Napredak</span>
            <span class="text-sm font-semibold text-green-primary">
              {{ checkedCount() }}/{{ totalCount() }}
            </span>
          </div>
          <div class="mt-2 h-2 bg-cream-dark rounded-full overflow-hidden">
            <div class="h-full bg-green-primary rounded-full transition-all duration-300"
                 [style.width.%]="progressPercent()"></div>
          </div>
        </div>

        <!-- Division mode toggle (multi-user) -->
        @if (isMultiUser()) {
          <div class="flex gap-1.5 mb-4 overflow-x-auto">
            @for (opt of divisionModes; track opt.value) {
              <button
                (click)="divisionMode.set(opt.value)"
                class="px-3 py-1.5 rounded-full text-[11px] font-medium transition-colors whitespace-nowrap min-h-9"
                [class.bg-orange-primary]="divisionMode() === opt.value"
                [class.text-white]="divisionMode() === opt.value"
                [class.bg-white]="divisionMode() !== opt.value"
                [class.text-text-muted]="divisionMode() !== opt.value">
                {{ opt.label }}
              </button>
            }
          </div>
        }

        @if (isMultiUser()) {
          <!-- Multi-user: show per-user sections -->
          @for (section of filteredUserSections(); track section.user.id) {
            <div class="mb-4">
              <!-- User plan-level assignment -->
              @if (divisionMode() === 'byUserPlan') {
                <div class="flex items-center justify-between mb-2 bg-white rounded-xl px-4 py-2 shadow-sm">
                  <div class="flex items-center gap-2">
                    <app-user-avatar [user]="section.user" size="sm" />
                    <span class="text-sm font-semibold" [style.color]="section.user.color">
                      Plan: {{ section.user.name }}
                    </span>
                  </div>
                  <app-assignment-badge
                    [assignedUserId]="getUserPlanAssignee(section.user.id)"
                    (assign)="assignUserPlan(section.user.id, $event)" />
                </div>
              } @else {
                <div class="flex items-center gap-2 mb-2">
                  <app-user-avatar [user]="section.user" size="sm" />
                  <span class="text-sm font-semibold" [style.color]="section.user.color">
                    {{ section.user.name }}
                  </span>
                </div>
              }

              @for (group of section.mealGroups; track group.mealType) {
                <div class="flex items-center justify-between mt-3 mb-1.5">
                  <h2 class="text-sm font-semibold text-text-muted uppercase tracking-wide">
                    {{ group.label }}
                  </h2>
                  <!-- Meal-level assignment -->
                  @if (divisionMode() === 'byMeal') {
                    <app-assignment-badge
                      [assignedUserId]="getMealAssignee(group.mealType)"
                      (assign)="assignMeal(group.mealType, $event)" />
                  }
                </div>
                <ul class="flex flex-col gap-1.5">
                  @for (item of group.items; track item.key) {
                    <li class="flex items-center gap-3 bg-white rounded-xl px-4 py-3 shadow-sm">
                      <input type="checkbox"
                             [checked]="isChecked(item.key)"
                             (change)="toggleCheck(item.key)"
                             class="w-5 h-5 rounded accent-green-primary shrink-0" />
                      <span [class.line-through]="isChecked(item.key)"
                            [class.text-text-muted]="isChecked(item.key)"
                            class="text-sm flex-1">
                        {{ item.ingredient | quantity }}
                      </span>
                      <!-- Item-level assignment -->
                      @if (divisionMode() === 'byItem') {
                        <app-assignment-badge
                          [assignedUserId]="getItemAssignee(item.key)"
                          (assign)="assignItem(item.key, $event)" />
                      }
                    </li>
                  }
                </ul>
              }
            </div>
          }
        } @else {
          <!-- Single-user mode -->
          @for (group of mealGroups(); track group.mealType) {
            <h2 class="text-sm font-semibold text-text-muted uppercase tracking-wide mt-4 mb-2">
              {{ group.label }}
            </h2>
            <ul class="flex flex-col gap-1.5">
              @for (item of group.items; track item.key) {
                <li class="flex items-center gap-3 bg-white rounded-xl px-4 py-3 shadow-sm">
                  <input type="checkbox"
                         [checked]="isChecked(item.key)"
                         (change)="toggleCheck(item.key)"
                         class="w-5 h-5 rounded accent-green-primary shrink-0" />
                  <span [class.line-through]="isChecked(item.key)"
                        [class.text-text-muted]="isChecked(item.key)"
                        class="text-sm">
                    {{ item.ingredient | quantity }}
                  </span>
                </li>
              }
            </ul>
          }
        }
      } @else {
        <p class="text-center text-text-muted py-8">Nema plana za ovaj dan</p>
      }
    </div>
  `,
})
export class PrepChecklistComponent {
  private readonly mealData = inject(MealDataService);
  private readonly householdService = inject(HouseholdService);
  private readonly syncService = inject(SyncService);
  private readonly location = inject(Location);

  readonly dayIndex = input.required<string>();
  readonly filter = signal<'all' | 'mine'>('all');
  readonly divisionMode = signal<'byUserPlan' | 'byMeal' | 'byItem'>('byUserPlan');

  readonly filterOptions = [
    { value: 'all' as const, label: 'Sve' },
    { value: 'mine' as const, label: 'Moje' },
  ];

  readonly divisionModes = [
    { value: 'byUserPlan' as const, label: 'Po planu' },
    { value: 'byMeal' as const, label: 'Po obroku' },
    { value: 'byItem' as const, label: 'Po sastojku' },
  ];

  readonly isMultiUser = computed(() => this.householdService.members().length > 1);

  readonly dayPlan = computed(() => {
    const plan = this.mealData.plan();
    return plan?.days[Number(this.dayIndex())] ?? null;
  });

  /** Single-user meal groups (local plan only) */
  readonly mealGroups = computed<PrepMealGroup[]>(() => {
    const day = this.dayPlan();
    if (!day) return [];
    return day.meals.map(m => ({
      mealType: m.type as MealType,
      label: MEAL_LABELS[m.type as MealType] ?? m.type,
      items: m.ingredients.map(ing => ({
        ingredient: ing,
        key: `${this.dayIndex()}_${m.type}_${ing.name}`,
        userId: 'local',
        userName: 'Ti',
      })),
    }));
  });

  /** Multi-user: sections per user with their meal groups */
  readonly userSections = computed<PrepUserSection[]>(() => {
    const members = this.householdService.members();
    const allPlans = this.mealData.householdPlans();
    const idx = Number(this.dayIndex());
    const sections: PrepUserSection[] = [];

    for (const member of members) {
      const plan = allPlans[member.id];
      if (!plan) continue;
      const day = plan.days[idx];
      if (!day) continue;

      const mealGroups: PrepMealGroup[] = day.meals
        .filter(m => m.ingredients.length > 0)
        .map(m => ({
          mealType: m.type as MealType,
          label: MEAL_LABELS[m.type as MealType] ?? m.type,
          items: m.ingredients.map(ing => ({
            ingredient: ing,
            key: `${idx}_${member.id}_${m.type}_${ing.name}`,
            userId: member.id,
            userName: member.name,
          })),
        }));

      if (mealGroups.length > 0) {
        sections.push({ user: member, mealGroups });
      }
    }

    // Fallback: if no household plans, use local plan
    if (sections.length === 0) {
      const day = this.dayPlan();
      if (day) {
        const localUser: UserProfile = { id: 'local', name: 'Ti', color: '#2d6a4f' };
        sections.push({
          user: localUser,
          mealGroups: this.mealGroups(),
        });
      }
    }

    return sections;
  });

  /** Apply "Moje" filter to user sections */
  readonly filteredUserSections = computed<PrepUserSection[]>(() => {
    const sections = this.userSections();
    if (this.filter() === 'all') return sections;

    const myId = this.householdService.currentUserId();
    if (!myId) return sections;

    const assignments = this.syncService.sharedState().prepAssignments;

    return sections
      .map(section => ({
        ...section,
        mealGroups: section.mealGroups
          .filter(group => {
            // byUserPlan: show section if I'm assigned to this user's plan
            const userPlanAssignee = assignments.byUserPlan[`${this.dayIndex()}_${section.user.id}`];
            if (userPlanAssignee && userPlanAssignee !== myId) return false;

            // byMeal: show meal if I'm assigned
            const mealAssignee = assignments.byMeal[`${this.dayIndex()}_${group.mealType}`];
            if (mealAssignee && mealAssignee !== myId) return false;

            return true;
          })
          .map(group => ({
            ...group,
            items: group.items.filter(item => {
              // byItem: show item if I'm assigned
              const itemAssignee = assignments.byItem[item.key];
              if (itemAssignee && itemAssignee !== myId) return false;
              return true;
            }),
          }))
          .filter(group => group.items.length > 0),
      }))
      .filter(section => section.mealGroups.length > 0);
  });

  /** All items across all visible sections */
  private readonly allVisibleItems = computed<PrepItem[]>(() => {
    if (this.isMultiUser()) {
      return this.filteredUserSections().flatMap(s => s.mealGroups.flatMap(g => g.items));
    }
    return this.mealGroups().flatMap(g => g.items);
  });

  readonly totalCount = computed(() => this.allVisibleItems().length);

  readonly checkedCount = computed(() => {
    const prepChecked = this.syncService.sharedState().prepChecked;
    return this.allVisibleItems().filter(item => prepChecked[item.key]).length;
  });

  readonly progressPercent = computed(() => {
    const total = this.totalCount();
    return total > 0 ? (this.checkedCount() / total) * 100 : 0;
  });

  isChecked(key: string): boolean {
    return this.syncService.sharedState().prepChecked[key] ?? false;
  }

  toggleCheck(key: string): void {
    this.syncService.updateSharedState(state => ({
      ...state,
      prepChecked: {
        ...state.prepChecked,
        [key]: !state.prepChecked[key],
      },
    }));
  }

  getUserPlanAssignee(targetUserId: string): string | null {
    const key = `${this.dayIndex()}_${targetUserId}`;
    return this.syncService.sharedState().prepAssignments.byUserPlan[key] ?? null;
  }

  assignUserPlan(targetUserId: string, assigneeId: string | null): void {
    const key = `${this.dayIndex()}_${targetUserId}`;
    this.syncService.updateSharedState(state => {
      const newByUserPlan = { ...state.prepAssignments.byUserPlan };
      if (assigneeId) {
        newByUserPlan[key] = assigneeId;
      } else {
        delete newByUserPlan[key];
      }
      return {
        ...state,
        prepAssignments: { ...state.prepAssignments, byUserPlan: newByUserPlan },
      };
    });
  }

  getMealAssignee(mealType: MealType): string | null {
    const key = `${this.dayIndex()}_${mealType}`;
    return this.syncService.sharedState().prepAssignments.byMeal[key] ?? null;
  }

  assignMeal(mealType: MealType, assigneeId: string | null): void {
    const key = `${this.dayIndex()}_${mealType}`;
    this.syncService.updateSharedState(state => {
      const newByMeal = { ...state.prepAssignments.byMeal };
      if (assigneeId) {
        newByMeal[key] = assigneeId;
      } else {
        delete newByMeal[key];
      }
      return {
        ...state,
        prepAssignments: { ...state.prepAssignments, byMeal: newByMeal },
      };
    });
  }

  getItemAssignee(itemKey: string): string | null {
    return this.syncService.sharedState().prepAssignments.byItem[itemKey] ?? null;
  }

  assignItem(itemKey: string, assigneeId: string | null): void {
    this.syncService.updateSharedState(state => {
      const newByItem = { ...state.prepAssignments.byItem };
      if (assigneeId) {
        newByItem[itemKey] = assigneeId;
      } else {
        delete newByItem[itemKey];
      }
      return {
        ...state,
        prepAssignments: { ...state.prepAssignments, byItem: newByItem },
      };
    });
  }

  goBack(): void {
    this.location.back();
  }
}
