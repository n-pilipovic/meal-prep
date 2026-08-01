import {
  Component,
  effect,
  input,
  linkedSignal,
  output,
  untracked,
  ChangeDetectionStrategy,
} from '@angular/core';
import { form, required, FormField } from '@angular/forms/signals';
import { Ingredient, IngredientCategory } from '../../core/models/meal.model';

@Component({
  selector: 'app-ingredient-row',
  imports: [FormField],
  changeDetection: ChangeDetectionStrategy.Eager,
  template: `
    <div class="flex flex-wrap sm:flex-nowrap gap-x-2 gap-y-1.5 items-start">
      <input
        type="text"
        [formField]="rowForm.name"
        placeholder="Sastojak"
        class="w-full sm:w-0 sm:flex-1 min-w-0 px-3 py-2 bg-white border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-green-primary/30"
      />
      <input
        type="number"
        [formField]="rowForm.quantity"
        placeholder="Kol."
        class="w-16 px-2 py-2 bg-white border border-gray-200 rounded-lg text-sm text-center focus:outline-none focus:ring-2 focus:ring-green-primary/30"
      />
      <select
        [formField]="rowForm.unit"
        class="flex-1 sm:flex-none sm:w-20 min-w-0 px-2 py-2 bg-white border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-green-primary/30"
      >
        <option value="g">g</option>
        <option value="ml">ml</option>
        <option value="kom">kom</option>
        <option value="kašičica">kašičica</option>
        <option value="kašika">kašika</option>
        <option value="">—</option>
      </select>
      <select
        [formField]="rowForm.category"
        class="flex-1 sm:flex-none sm:w-24 min-w-0 px-2 py-2 bg-white border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-green-primary/30"
      >
        @for (cat of categories; track cat.value) {
          <option [value]="cat.value">{{ cat.label }}</option>
        }
      </select>
      <button
        (click)="remove.emit()"
        class="p-2 text-red-400 hover:text-red-600 min-h-11 flex items-center"
        type="button"
      >
        ✕
      </button>
    </div>
  `,
})
export class IngredientRowComponent {
  readonly ingredient = input.required<Ingredient>();
  readonly change = output<Ingredient>();
  readonly remove = output<void>();

  /**
   * Signal Forms writes into its own model, but the plan is owned by the editor
   * and handed down as an immutable input. So the row edits a local copy that is
   * re-seeded whenever the parent pushes a new value, and reports edits upward.
   */
  readonly model = linkedSignal<Ingredient, Ingredient>({
    source: () => this.ingredient(),
    computation: (incoming) => ({ ...incoming }),
  });

  readonly rowForm = form(this.model, (path) => {
    required(path.name);
  });

  readonly categories = [
    { value: IngredientCategory.Meat, label: 'Meso' },
    { value: IngredientCategory.Dairy, label: 'Mlečno' },
    { value: IngredientCategory.Produce, label: 'Voće/Povrće' },
    { value: IngredientCategory.Grain, label: 'Žitarice' },
    { value: IngredientCategory.Pantry, label: 'Ostava' },
    { value: IngredientCategory.Spice, label: 'Začini' },
    { value: IngredientCategory.Oil, label: 'Ulja' },
  ];

  constructor() {
    effect(() => {
      const edited = this.model();
      // `untracked` keeps this keyed to local edits only — reading the input
      // reactively would re-emit every value the parent hands back.
      const incoming = untracked(() => this.ingredient());
      if (!sameIngredient(edited, incoming)) {
        this.change.emit(edited);
      }
    });
  }
}

function sameIngredient(a: Ingredient, b: Ingredient): boolean {
  return (
    a.name === b.name && a.quantity === b.quantity && a.unit === b.unit && a.category === b.category
  );
}
