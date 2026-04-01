import { Component, input, output } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Ingredient, IngredientCategory } from '../../core/models/meal.model';

@Component({
  selector: 'app-ingredient-row',
  imports: [FormsModule],
  template: `
    <div class="flex flex-wrap sm:flex-nowrap gap-x-2 gap-y-1.5 items-start">
      <input
        type="text"
        [ngModel]="ingredient().name"
        (ngModelChange)="emitChange('name', $event)"
        placeholder="Sastojak"
        class="w-full sm:w-0 sm:flex-1 min-w-0 px-3 py-2 bg-white border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-green-primary/30" />
      <input
        type="number"
        [ngModel]="ingredient().quantity"
        (ngModelChange)="emitChange('quantity', $event)"
        placeholder="Kol."
        class="w-16 px-2 py-2 bg-white border border-gray-200 rounded-lg text-sm text-center focus:outline-none focus:ring-2 focus:ring-green-primary/30" />
      <select
        [ngModel]="ingredient().unit"
        (ngModelChange)="emitChange('unit', $event)"
        class="flex-1 sm:flex-none sm:w-20 min-w-0 px-2 py-2 bg-white border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-green-primary/30">
        <option value="g">g</option>
        <option value="ml">ml</option>
        <option value="kom">kom</option>
        <option value="kašičica">kašičica</option>
        <option value="kašika">kašika</option>
        <option value="">—</option>
      </select>
      <select
        [ngModel]="ingredient().category"
        (ngModelChange)="emitChange('category', $event)"
        class="flex-1 sm:flex-none sm:w-24 min-w-0 px-2 py-2 bg-white border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-green-primary/30">
        @for (cat of categories; track cat.value) {
          <option [value]="cat.value">{{ cat.label }}</option>
        }
      </select>
      <button
        (click)="remove.emit()"
        class="p-2 text-red-400 hover:text-red-600 min-h-11 flex items-center"
        type="button">
        ✕
      </button>
    </div>
  `,
})
export class IngredientRowComponent {
  readonly ingredient = input.required<Ingredient>();
  readonly change = output<Ingredient>();
  readonly remove = output<void>();

  readonly categories = [
    { value: IngredientCategory.Meat, label: 'Meso' },
    { value: IngredientCategory.Dairy, label: 'Mlečno' },
    { value: IngredientCategory.Produce, label: 'Voće/Povrće' },
    { value: IngredientCategory.Grain, label: 'Žitarice' },
    { value: IngredientCategory.Pantry, label: 'Ostava' },
    { value: IngredientCategory.Spice, label: 'Začini' },
    { value: IngredientCategory.Oil, label: 'Ulja' },
  ];

  emitChange(field: keyof Ingredient, value: any): void {
    this.change.emit({ ...this.ingredient(), [field]: value });
  }
}
