import { Component, computed, inject, input, ChangeDetectionStrategy } from '@angular/core';
import { RouterLink } from '@angular/router';
import { Meal, MealType, MEAL_LABELS } from '../../core/models/meal.model';
import { MealTimeService } from '../../core/services/meal-time.service';

@Component({
  selector: 'app-meal-card',
  imports: [RouterLink],
  changeDetection: ChangeDetectionStrategy.Eager,
  template: `
    <a
      [routerLink]="['/day', dayIndex(), 'meal', meal().type]"
      [queryParams]="userId() ? { user: userId() } : null"
      class="block bg-white rounded-2xl shadow-sm p-4 active:scale-[0.98] transition-transform"
    >
      <div class="flex items-center justify-between mb-2">
        <div class="flex items-center gap-2">
          <span class="text-lg" aria-hidden="true">{{ icon() }}</span>
          <span class="font-semibold text-text-primary">{{ label() }}</span>
        </div>
        <span class="text-xs text-text-muted font-medium px-2 py-0.5 bg-cream rounded-full">
          {{ time() }}
        </span>
      </div>
      <div class="flex items-center gap-2 mb-1.5">
        <h3 class="font-medium text-text-primary">{{ meal().name }}</h3>
        @if (meal().recipeRef) {
          <span
            class="inline-flex items-center gap-1 text-xs font-medium text-green-primary px-2 py-0.5 bg-green-primary/10 rounded-full shrink-0"
            aria-label="Ima recept"
          >
            <span aria-hidden="true">📖</span> Recept
          </span>
        }
      </div>
      <p class="text-sm text-text-secondary line-clamp-2">
        @for (ing of meal().ingredients; track ing.name; let last = $last) {
          {{ ing.name }}
          @if (ing.quantity != null) {
            {{ ing.quantity }}{{ ing.unit }}
          }
          {{ last ? '' : ', ' }}
        }
      </p>
    </a>
  `,
})
export class MealCardComponent {
  private readonly mealTimes = inject(MealTimeService);

  readonly meal = input.required<Meal>();
  readonly dayIndex = input.required<number>();
  /** When set, the routerLink carries `?user=<id>` so the detail page resolves
   *  the meal against this household member's plan instead of the viewer's. */
  readonly userId = input<string | null>(null);

  /** Computed, not a method: it reads the override signal inside MealTimeService. */
  readonly time = computed(() => {
    const meal = this.meal();
    return this.mealTimes.resolve(meal.type as MealType, meal.time);
  });

  label(): string {
    return MEAL_LABELS[this.meal().type as MealType] ?? '';
  }

  icon(): string {
    const icons: Record<string, string> = {
      dorucak: '🍳',
      uzina: '🍎',
      rucak: '🍽️',
      uzina2: '🍪',
      vecera: '🌙',
    };
    return icons[this.meal().type] ?? '';
  }
}
