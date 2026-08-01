import { Component, computed, inject, input, ChangeDetectionStrategy } from '@angular/core';
import { MealType, MEAL_LABELS } from '../../core/models/meal.model';
import { MealTimeService } from '../../core/services/meal-time.service';

@Component({
  selector: 'app-meal-type-badge',
  changeDetection: ChangeDetectionStrategy.Eager,
  template: `
    <span
      class="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium"
      [class]="badgeClass()"
    >
      <span>{{ icon() }}</span>
      <span>{{ label() }}</span>
      <span class="text-text-muted">{{ time() }}</span>
    </span>
  `,
})
export class MealTypeBadgeComponent {
  private readonly mealTimes = inject(MealTimeService);

  readonly mealType = input.required<MealType>();
  /** The rendered meal's own `time`, when the caller has it. */
  readonly planTime = input<string | null>(null);

  readonly time = computed(() => this.mealTimes.resolve(this.mealType(), this.planTime()));

  label(): string {
    return MEAL_LABELS[this.mealType()] ?? '';
  }

  icon(): string {
    const icons: Record<MealType, string> = {
      [MealType.Breakfast]: '🍳',
      [MealType.Snack]: '🍎',
      [MealType.Lunch]: '🍽️',
      [MealType.AfternoonSnack]: '🍪',
      [MealType.Dinner]: '🌙',
    };
    return icons[this.mealType()] ?? '';
  }

  badgeClass(): string {
    const classes: Record<MealType, string> = {
      [MealType.Breakfast]: 'bg-amber-50 text-amber-800',
      [MealType.Snack]: 'bg-green-50 text-green-800',
      [MealType.Lunch]: 'bg-blue-50 text-blue-800',
      [MealType.AfternoonSnack]: 'bg-orange-50 text-orange-800',
      [MealType.Dinner]: 'bg-purple-50 text-purple-800',
    };
    return classes[this.mealType()] ?? '';
  }
}
