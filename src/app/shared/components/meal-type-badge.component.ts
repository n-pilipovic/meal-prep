import { Component, input } from '@angular/core';
import { MealType, MEAL_LABELS, MEAL_TIMES } from '../../core/models/meal.model';

@Component({
  selector: 'app-meal-type-badge',
  template: `
    <span class="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium"
          [class]="badgeClass()">
      <span>{{ icon() }}</span>
      <span>{{ label() }}</span>
      <span class="text-text-muted">{{ time() }}</span>
    </span>
  `,
})
export class MealTypeBadgeComponent {
  readonly mealType = input.required<MealType>();

  label(): string {
    return MEAL_LABELS[this.mealType()] ?? '';
  }

  time(): string {
    return MEAL_TIMES[this.mealType()] ?? '';
  }

  icon(): string {
    const icons: Record<MealType, string> = {
      [MealType.Breakfast]: '🍳',
      [MealType.Snack]: '🍎',
      [MealType.Lunch]: '🍽️',
      [MealType.Dinner]: '🌙',
    };
    return icons[this.mealType()] ?? '';
  }

  badgeClass(): string {
    const classes: Record<MealType, string> = {
      [MealType.Breakfast]: 'bg-amber-50 text-amber-800',
      [MealType.Snack]: 'bg-green-50 text-green-800',
      [MealType.Lunch]: 'bg-blue-50 text-blue-800',
      [MealType.Dinner]: 'bg-purple-50 text-purple-800',
    };
    return classes[this.mealType()] ?? '';
  }
}
