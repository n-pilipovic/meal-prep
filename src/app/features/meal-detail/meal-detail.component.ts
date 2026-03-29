import { Component, inject, input, computed, signal } from '@angular/core';
import { Location } from '@angular/common';
import { MealDataService } from '../../core/services/meal-data.service';
import { HouseholdService } from '../../core/services/household.service';
import { MealType, MEAL_LABELS, MEAL_TIMES, Recipe } from '../../core/models/meal.model';
import { UserProfile } from '../../core/models/user.model';
import { QuantityPipe } from '../../shared/pipes/quantity.pipe';
import { MealTypeBadgeComponent } from '../../shared/components/meal-type-badge.component';
import { UserAvatarComponent } from '../../shared/components/user-avatar.component';

@Component({
  selector: 'app-meal-detail',
  imports: [QuantityPipe, MealTypeBadgeComponent, UserAvatarComponent],
  template: `
    <div class="px-4 py-4">
      <button (click)="goBack()" class="mb-3 text-green-primary font-medium active:opacity-70 min-h-[44px] flex items-center">
        ‹ Nazad
      </button>

      @if (meal(); as m) {
        <app-meal-type-badge [mealType]="m.type" />

        @if (mealOwner(); as owner) {
          <div class="flex items-center gap-2 mt-2 mb-1">
            <app-user-avatar [user]="owner" size="sm" />
            <span class="text-sm text-text-secondary">{{ owner.name }}</span>
          </div>
        }

        <h1 class="text-2xl font-bold text-text-primary mt-2 mb-1">{{ m.name }}</h1>
        <p class="text-sm text-text-secondary mb-6">{{ m.description }}</p>

        <h2 class="text-base font-semibold text-text-primary mb-3">Sastojci</h2>
        <ul class="flex flex-col gap-2 mb-6">
          @for (ing of m.ingredients; track ing.name) {
            <li class="flex items-center gap-3 bg-white rounded-xl px-4 py-3 shadow-sm">
              <input type="checkbox"
                     [checked]="!!checked()[ing.name]"
                     (change)="toggleIngredient(ing.name)"
                     class="w-5 h-5 rounded accent-green-primary" />
              <span [class.line-through]="checked()[ing.name]"
                    [class.text-text-muted]="checked()[ing.name]"
                    class="text-sm">
                {{ ing | quantity }}
              </span>
            </li>
          }
        </ul>

        @if (recipe(); as r) {
          <h2 class="text-base font-semibold text-text-primary mb-3">Recept: {{ r.name }}</h2>
          <p class="text-xs text-text-muted mb-2">{{ r.servings }}</p>
          <ol class="flex flex-col gap-2 mb-4">
            @for (step of r.instructions; track $index) {
              <li class="flex gap-3 bg-white rounded-xl px-4 py-3 shadow-sm">
                <span class="text-green-primary font-semibold text-sm shrink-0">{{ $index + 1 }}.</span>
                <span class="text-sm text-text-secondary">{{ step }}</span>
              </li>
            }
          </ol>
        }
      } @else {
        <p class="text-center text-text-muted py-8">Obrok nije pronađen</p>
      }
    </div>
  `,
})
export class MealDetailComponent {
  private readonly mealData = inject(MealDataService);
  private readonly householdService = inject(HouseholdService);
  private readonly location = inject(Location);

  readonly dayIndex = input.required<string>();
  readonly mealType = input.required<string>();

  readonly checked = signal<Record<string, boolean>>({});

  readonly mealOwner = computed<UserProfile | null>(() => {
    const user = this.householdService.currentUser();
    return this.householdService.isLoggedIn() ? user : null;
  });

  readonly meal = computed(() => {
    return this.mealData.getMealForDay(Number(this.dayIndex()), this.mealType() as MealType);
  });

  readonly recipe = computed<Recipe | null>(() => {
    const m = this.meal();
    if (!m?.recipeRef) return null;
    return this.mealData.recipes().find(r => r.id === m.recipeRef) ?? null;
  });

  toggleIngredient(name: string): void {
    this.checked.update(c => ({ ...c, [name]: !c[name] }));
  }

  goBack(): void {
    this.location.back();
  }
}
