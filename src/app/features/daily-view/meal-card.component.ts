import { Component, input } from '@angular/core';
import { RouterLink } from '@angular/router';
import { Meal, MealType, MEAL_LABELS, MEAL_TIMES } from '../../core/models/meal.model';

@Component({
  selector: 'app-meal-card',
  imports: [RouterLink],
  template: `
    <a [routerLink]="['/day', dayIndex(), 'meal', meal().type]"
       class="block bg-white rounded-2xl shadow-sm p-4 active:scale-[0.98] transition-transform">
      <div class="flex items-center justify-between mb-2">
        <div class="flex items-center gap-2">
          <span class="text-lg">{{ icon() }}</span>
          <span class="font-semibold text-text-primary">{{ label() }}</span>
        </div>
        <span class="text-xs text-text-muted font-medium px-2 py-0.5 bg-cream rounded-full">
          {{ time() }}
        </span>
      </div>
      <h3 class="font-medium text-text-primary mb-1.5">{{ meal().name }}</h3>
      <p class="text-sm text-text-secondary line-clamp-2">
        @for (ing of meal().ingredients; track ing.name; let last = $last) {
          {{ ing.name }}@if (ing.quantity != null) { {{ ing.quantity }}{{ ing.unit }}}{{ last ? '' : ', ' }}
        }
      </p>
    </a>
  `,
})
export class MealCardComponent {
  readonly meal = input.required<Meal>();
  readonly dayIndex = input.required<number>();

  label(): string {
    return MEAL_LABELS[this.meal().type as MealType] ?? '';
  }

  time(): string {
    return MEAL_TIMES[this.meal().type as MealType] ?? '';
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
