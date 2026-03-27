import { Component, input, output } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Meal, MEAL_LABELS, MealType, Ingredient, IngredientCategory } from '../../core/models/meal.model';
import { IngredientRowComponent } from './ingredient-row.component';

@Component({
  selector: 'app-meal-form',
  imports: [FormsModule, IngredientRowComponent],
  template: `
    <div class="bg-white rounded-2xl shadow-sm p-4 mb-3">
      <div class="flex items-center justify-between mb-3">
        <h3 class="text-sm font-semibold text-text-muted uppercase tracking-wide">
          {{ mealLabel() }} · {{ meal().time }}
        </h3>
      </div>

      <input
        type="text"
        [ngModel]="meal().name"
        (ngModelChange)="updateField('name', $event)"
        placeholder="Naziv obroka"
        class="w-full px-3 py-2 bg-cream-light border border-gray-200 rounded-lg text-sm mb-2 focus:outline-none focus:ring-2 focus:ring-green-primary/30" />

      <textarea
        [ngModel]="meal().description"
        (ngModelChange)="updateField('description', $event)"
        placeholder="Opis / napomena"
        rows="2"
        class="w-full px-3 py-2 bg-cream-light border border-gray-200 rounded-lg text-sm mb-3 resize-none focus:outline-none focus:ring-2 focus:ring-green-primary/30">
      </textarea>

      <p class="text-xs text-text-muted mb-2">Sastojci</p>
      <div class="flex flex-col gap-2 mb-2">
        @for (ing of meal().ingredients; track $index) {
          <app-ingredient-row
            [ingredient]="ing"
            (change)="updateIngredient($index, $event)"
            (remove)="removeIngredient($index)" />
        }
      </div>

      <button
        (click)="addIngredient()"
        type="button"
        class="text-green-primary text-sm font-medium px-3 py-2 rounded-lg hover:bg-green-primary/5 transition-colors min-h-11">
        + Dodaj sastojak
      </button>
    </div>
  `,
})
export class MealFormComponent {
  readonly meal = input.required<Meal>();
  readonly change = output<Meal>();

  mealLabel(): string {
    return MEAL_LABELS[this.meal().type as MealType] ?? this.meal().type;
  }

  updateField(field: keyof Meal, value: string): void {
    this.change.emit({ ...this.meal(), [field]: value });
  }

  updateIngredient(index: number, updated: Ingredient): void {
    const ingredients = [...this.meal().ingredients];
    ingredients[index] = updated;
    this.change.emit({ ...this.meal(), ingredients });
  }

  removeIngredient(index: number): void {
    const ingredients = this.meal().ingredients.filter((_, i) => i !== index);
    this.change.emit({ ...this.meal(), ingredients });
  }

  addIngredient(): void {
    const ingredients = [
      ...this.meal().ingredients,
      { name: '', quantity: null, unit: 'g', category: IngredientCategory.Pantry },
    ];
    this.change.emit({ ...this.meal(), ingredients });
  }
}
