import { Component, input, output } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Recipe, Ingredient, IngredientCategory } from '../../core/models/meal.model';
import { IngredientRowComponent } from './ingredient-row.component';

@Component({
  selector: 'app-recipe-form',
  imports: [FormsModule, IngredientRowComponent],
  template: `
    <div class="bg-white rounded-2xl shadow-sm p-4 mb-3">
      <div class="flex items-center justify-between mb-3">
        <input
          type="text"
          [ngModel]="recipe().name"
          (ngModelChange)="updateField('name', $event)"
          placeholder="Naziv recepta"
          class="font-semibold text-text-primary bg-transparent border-b border-gray-200 focus:border-green-primary focus:outline-none py-1 flex-1" />
        <button
          (click)="remove.emit()"
          type="button"
          class="ml-2 p-2 text-red-400 hover:text-red-600 min-h-11">
          ✕
        </button>
      </div>

      <input
        type="text"
        [ngModel]="recipe().servings"
        (ngModelChange)="updateField('servings', $event)"
        placeholder="Porcije (npr. 2 porcije)"
        class="w-full px-3 py-2 bg-cream-light border border-gray-200 rounded-lg text-sm mb-3 focus:outline-none focus:ring-2 focus:ring-green-primary/30" />

      <p class="text-xs text-text-muted mb-2">Sastojci</p>
      <div class="flex flex-col gap-2 mb-2">
        @for (ing of recipe().ingredients; track $index) {
          <app-ingredient-row
            [ingredient]="ing"
            (change)="updateIngredient($index, $event)"
            (remove)="removeIngredient($index)" />
        }
      </div>
      <button
        (click)="addIngredient()"
        type="button"
        class="text-green-primary text-sm font-medium px-3 py-2 rounded-lg hover:bg-green-primary/5 transition-colors min-h-11 mb-3">
        + Dodaj sastojak
      </button>

      <p class="text-xs text-text-muted mb-2">Koraci</p>
      <div class="flex flex-col gap-2 mb-2">
        @for (step of recipe().instructions; track $index) {
          <div class="flex gap-2 items-start">
            <span class="text-xs text-text-muted mt-2.5 w-5 text-right shrink-0">{{ $index + 1 }}.</span>
            <textarea
              [ngModel]="step"
              (ngModelChange)="updateInstruction($index, $event)"
              rows="2"
              class="flex-1 px-3 py-2 bg-cream-light border border-gray-200 rounded-lg text-sm resize-none focus:outline-none focus:ring-2 focus:ring-green-primary/30">
            </textarea>
            <button
              (click)="removeInstruction($index)"
              type="button"
              class="p-2 text-red-400 hover:text-red-600 min-h-11">
              ✕
            </button>
          </div>
        }
      </div>
      <button
        (click)="addInstruction()"
        type="button"
        class="text-green-primary text-sm font-medium px-3 py-2 rounded-lg hover:bg-green-primary/5 transition-colors min-h-11">
        + Dodaj korak
      </button>
    </div>
  `,
})
export class RecipeFormComponent {
  readonly recipe = input.required<Recipe>();
  readonly change = output<Recipe>();
  readonly remove = output<void>();

  updateField(field: keyof Recipe, value: string): void {
    this.change.emit({ ...this.recipe(), [field]: value });
  }

  updateIngredient(index: number, updated: Ingredient): void {
    const ingredients = [...this.recipe().ingredients];
    ingredients[index] = updated;
    this.change.emit({ ...this.recipe(), ingredients });
  }

  removeIngredient(index: number): void {
    const ingredients = this.recipe().ingredients.filter((_, i) => i !== index);
    this.change.emit({ ...this.recipe(), ingredients });
  }

  addIngredient(): void {
    const ingredients = [
      ...this.recipe().ingredients,
      { name: '', quantity: null, unit: 'g', category: IngredientCategory.Pantry },
    ];
    this.change.emit({ ...this.recipe(), ingredients });
  }

  updateInstruction(index: number, value: string): void {
    const instructions = [...this.recipe().instructions];
    instructions[index] = value;
    this.change.emit({ ...this.recipe(), instructions });
  }

  removeInstruction(index: number): void {
    const instructions = this.recipe().instructions.filter((_, i) => i !== index);
    this.change.emit({ ...this.recipe(), instructions });
  }

  addInstruction(): void {
    const instructions = [...this.recipe().instructions, ''];
    this.change.emit({ ...this.recipe(), instructions });
  }
}
