import { Component, inject, signal, output } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ApiService } from '../../core/services/api.service';
import { WeeklyPlan } from '../../core/models/meal.model';
import {
  MealPlanPreferences,
  DIETARY_RESTRICTIONS,
  DEFAULT_PREFERENCES,
} from '../../core/models/ai-plan.model';

@Component({
  selector: 'app-ai-plan-form',
  imports: [FormsModule],
  template: `
    <div class="flex flex-col gap-4">
      <div class="bg-white rounded-2xl shadow-sm p-4">
        <h2 class="font-semibold text-text-primary mb-1">Generiši AI plan</h2>
        <p class="text-sm text-text-muted mb-4">
          Gemini AI kreira nedeljni plan ishrane po tvojim zahtevima.
        </p>

        <!-- Calories -->
        <div class="mb-4">
          <label class="block text-sm font-medium text-text-primary mb-1">
            Kalorijski cilj: {{ calories() }} kcal
          </label>
          <input
            type="range"
            [min]="1200"
            [max]="3500"
            [step]="100"
            [ngModel]="calories()"
            (ngModelChange)="calories.set($event)"
            class="w-full accent-green-primary" />
          <div class="flex justify-between text-xs text-text-muted mt-1">
            <span>1200</span>
            <span>3500</span>
          </div>
        </div>

        <!-- Dietary restrictions -->
        <div class="mb-4">
          <label class="block text-sm font-medium text-text-primary mb-2">Ograničenja</label>
          <div class="flex flex-wrap gap-2">
            @for (r of restrictions; track r.key) {
              <button
                (click)="toggleRestriction(r.key)"
                class="px-3 py-1.5 rounded-full text-sm transition-colors min-h-9"
                [class.bg-green-primary]="selectedRestrictions().includes(r.key)"
                [class.text-white]="selectedRestrictions().includes(r.key)"
                [class.bg-cream-light]="!selectedRestrictions().includes(r.key)"
                [class.text-text-secondary]="!selectedRestrictions().includes(r.key)">
                {{ r.label }}
              </button>
            }
          </div>
        </div>

        <!-- Preferred ingredients -->
        <div class="mb-4">
          <label class="block text-sm font-medium text-text-primary mb-1">
            Poželjni sastojci
          </label>
          <div class="flex gap-2">
            <input
              type="text"
              [(ngModel)]="preferredInput"
              (keydown.enter)="addPreferred()"
              placeholder="npr. piletina, brokoli..."
              class="flex-1 px-3 py-2 border border-border rounded-lg text-sm min-h-11" />
            <button
              (click)="addPreferred()"
              class="px-3 py-2 bg-green-primary text-white rounded-lg text-sm min-h-11">
              +
            </button>
          </div>
          @if (preferred().length > 0) {
            <div class="flex flex-wrap gap-1.5 mt-2">
              @for (item of preferred(); track item) {
                <span class="inline-flex items-center gap-1 px-2.5 py-1 bg-green-50 text-green-800 rounded-full text-xs">
                  {{ item }}
                  <button (click)="removePreferred(item)" class="text-green-600 hover:text-green-900">&times;</button>
                </span>
              }
            </div>
          }
        </div>

        <!-- Avoid ingredients -->
        <div class="mb-4">
          <label class="block text-sm font-medium text-text-primary mb-1">
            Izbegavati
          </label>
          <div class="flex gap-2">
            <input
              type="text"
              [(ngModel)]="avoidInput"
              (keydown.enter)="addAvoid()"
              placeholder="npr. ljuto, gljive..."
              class="flex-1 px-3 py-2 border border-border rounded-lg text-sm min-h-11" />
            <button
              (click)="addAvoid()"
              class="px-3 py-2 bg-orange-primary text-white rounded-lg text-sm min-h-11">
              +
            </button>
          </div>
          @if (avoided().length > 0) {
            <div class="flex flex-wrap gap-1.5 mt-2">
              @for (item of avoided(); track item) {
                <span class="inline-flex items-center gap-1 px-2.5 py-1 bg-red-50 text-red-800 rounded-full text-xs">
                  {{ item }}
                  <button (click)="removeAvoid(item)" class="text-red-600 hover:text-red-900">&times;</button>
                </span>
              }
            </div>
          }
        </div>

        <!-- Free-text note -->
        <div class="mb-4">
          <label class="block text-sm font-medium text-text-primary mb-1">
            Napomena
          </label>
          <textarea
            [(ngModel)]="note"
            rows="2"
            placeholder="npr. više proteina, budžet prijateljski, brza priprema..."
            class="w-full px-3 py-2 border border-border rounded-lg text-sm resize-none">
          </textarea>
        </div>

        <!-- Generate button -->
        <button
          (click)="generate()"
          [disabled]="loading()"
          class="w-full py-3 bg-green-primary text-white font-medium rounded-xl min-h-11 disabled:opacity-40 flex items-center justify-center gap-2">
          @if (loading()) {
            <span class="inline-block w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></span>
            <span>Generisanje...</span>
          } @else {
            <span>Generiši plan</span>
          }
        </button>

        @if (error()) {
          <p class="mt-3 text-sm text-red-500">{{ error() }}</p>
        }
      </div>
    </div>
  `,
})
export class AiPlanFormComponent {
  private readonly api = inject(ApiService);

  readonly planGenerated = output<WeeklyPlan>();

  readonly restrictions = DIETARY_RESTRICTIONS;

  readonly calories = signal(DEFAULT_PREFERENCES.calories);
  readonly selectedRestrictions = signal<string[]>([]);
  readonly preferred = signal<string[]>([]);
  readonly avoided = signal<string[]>([]);
  note = '';
  preferredInput = '';
  avoidInput = '';

  readonly loading = signal(false);
  readonly error = signal('');

  toggleRestriction(key: string): void {
    this.selectedRestrictions.update(list =>
      list.includes(key) ? list.filter(k => k !== key) : [...list, key],
    );
  }

  addPreferred(): void {
    const val = this.preferredInput.trim();
    if (val && !this.preferred().includes(val)) {
      this.preferred.update(list => [...list, val]);
    }
    this.preferredInput = '';
  }

  removePreferred(item: string): void {
    this.preferred.update(list => list.filter(i => i !== item));
  }

  addAvoid(): void {
    const val = this.avoidInput.trim();
    if (val && !this.avoided().includes(val)) {
      this.avoided.update(list => [...list, val]);
    }
    this.avoidInput = '';
  }

  removeAvoid(item: string): void {
    this.avoided.update(list => list.filter(i => i !== item));
  }

  generate(): void {
    this.loading.set(true);
    this.error.set('');

    const prefs: MealPlanPreferences = {
      calories: this.calories(),
      restrictions: this.selectedRestrictions(),
      preferredIngredients: this.preferred(),
      avoidIngredients: this.avoided(),
      note: this.note.trim(),
    };

    this.api.generatePlan(prefs).subscribe({
      next: (plan) => {
        this.loading.set(false);
        this.planGenerated.emit(plan);
      },
      error: (err) => {
        this.loading.set(false);
        this.error.set(err.error?.error ?? 'Greška pri generisanju plana. Pokušaj ponovo.');
      },
    });
  }
}
