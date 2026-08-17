import { Component, inject, ChangeDetectionStrategy } from '@angular/core';
import { Location } from '@angular/common';
import { CookPlanService } from '../../core/services/cook-plan.service';
import {
  BlockDish,
  BlockIngredient,
  CookBlock,
  PrepStep,
} from '../../core/models/cook-plan.model';

const DAY_SHORT = ['Pon', 'Uto', 'Sre', 'Čet', 'Pet', 'Sub', 'Ned'];

@Component({
  selector: 'app-cook-plan',
  changeDetection: ChangeDetectionStrategy.Eager,
  template: `
    <div class="px-4 py-4">
      <button
        (click)="goBack()"
        aria-label="Nazad"
        class="mb-3 text-green-primary font-medium active:opacity-70 min-h-11 flex items-center"
      >
        <span aria-hidden="true">‹</span>&nbsp;Nazad
      </button>

      <h1 class="text-xl font-bold text-text-primary mb-1">Plan kuvanja</h1>
      <p class="text-sm text-text-muted mb-4">
        Grupiši kuvanje u nekoliko blokova nedeljno — sastojci su sabrani po jelu.
      </p>

      <!-- Cook day picker -->
      <div class="bg-white rounded-2xl shadow-sm p-4 mb-4">
        <h2 class="text-sm font-semibold text-text-primary mb-2">Dani kada kuvam</h2>
        <div class="flex gap-1.5 flex-wrap" role="group" aria-label="Dani kada kuvam">
          @for (day of dayOptions; track day.index) {
            <button
              (click)="toggleDay(day.index)"
              [attr.aria-pressed]="isCookDay(day.index)"
              class="px-3 py-1.5 rounded-full text-xs font-medium transition-colors min-h-9 min-w-11"
              [class.bg-green-primary]="isCookDay(day.index)"
              [class.text-white]="isCookDay(day.index)"
              [class.bg-cream-dark]="!isCookDay(day.index)"
              [class.text-text-muted]="!isCookDay(day.index)"
            >
              {{ day.label }}
            </button>
          }
        </div>
      </div>

      <!-- AI refinement -->
      <div class="bg-white rounded-2xl shadow-sm p-4 mb-4">
        <div class="flex items-center justify-between gap-3">
          <div class="min-w-0">
            <h2 class="text-sm font-semibold text-text-primary">AI analiza jela</h2>
            <p class="text-xs text-text-muted">
              Preciznija podela jela i koraci pripreme za veče pre
            </p>
          </div>
          @if (cookPlan.aiMeta(); as meta) {
            <span class="text-xs font-medium text-green-primary whitespace-nowrap">✓ Aktivna</span>
          } @else {
            <button
              (click)="cookPlan.loadAiRefinement()"
              [disabled]="cookPlan.aiLoading()"
              class="px-4 py-2 bg-orange-primary text-white text-sm font-medium rounded-lg min-h-11 disabled:opacity-40 whitespace-nowrap"
            >
              @if (cookPlan.aiLoading()) {
                Analiziram…
              } @else {
                ✨ Analiziraj
              }
            </button>
          }
        </div>
        @if (cookPlan.aiError(); as error) {
          <p class="text-xs text-orange-primary mt-2" role="alert">{{ error }}</p>
        }
        @if (cookPlan.aiIncomplete()) {
          <p class="text-xs text-orange-primary mt-2">
            Analiza je delimična — neka jela koriste ugrađena pravila. Pokušaj ponovo kasnije.
          </p>
        }
      </div>

      @if (cookPlan.noCookMealCount() > 0) {
        <p class="text-xs text-text-muted mb-4 px-1">
          {{ cookPlan.noCookMealCount() }} obroka se sprema odmah pre jela (bez kuvanja) i nije u
          blokovima.
        </p>
      }

      @for (block of cookPlan.blocks(); track block.id) {
        <section class="bg-white rounded-2xl shadow-sm p-4 mb-4" [attr.aria-label]="block.label">
          <div class="flex items-center justify-between mb-1">
            <h2 class="font-semibold text-text-primary">🍳 {{ block.label }}</h2>
            <span class="text-xs font-semibold text-green-primary" aria-live="polite">
              {{ checkedCount(block) }}/{{ totalCount(block) }}
            </span>
          </div>
          <p class="text-xs text-text-muted mb-3">Pokriva: {{ coversLabel(block) }}</p>

          <!-- Dishes -->
          <h3 class="text-sm font-semibold text-text-muted uppercase tracking-wide mb-1.5">
            Jela ({{ block.dishes.length }})
          </h3>
          <ul class="flex flex-col gap-1.5 mb-4">
            @for (dish of block.dishes; track dish.key) {
              <li class="bg-cream-light rounded-xl">
                <label class="flex items-start gap-3 px-3 py-2.5 cursor-pointer">
                  <input
                    type="checkbox"
                    [checked]="isChecked(dishKey(block, dish))"
                    (change)="toggle(dishKey(block, dish))"
                    class="w-5 h-5 rounded accent-green-primary shrink-0 mt-0.5"
                  />
                  <span class="flex-1 min-w-0">
                    <span
                      class="text-sm font-medium block"
                      [class.line-through]="isChecked(dishKey(block, dish))"
                      [class.text-text-muted]="isChecked(dishKey(block, dish))"
                    >
                      {{ dish.name }}
                    </span>
                    <span class="text-xs text-text-muted block">{{ dishMeta(dish) }}</span>
                    @if (dish.freshnessWarning) {
                      <span class="text-xs text-orange-primary block">
                        ⚠ Neki obroci su van roka svežine — razmisli o zamrzavanju
                      </span>
                    }
                  </span>
                </label>
              </li>
            }
          </ul>

          <!-- Grouped ingredients -->
          <h3 class="text-sm font-semibold text-text-muted uppercase tracking-wide mb-1.5">
            Sastojci — grupisano
          </h3>
          <ul class="flex flex-col gap-1 mb-4">
            @for (ing of block.ingredients; track ing.key) {
              <li class="px-1 py-1">
                <div class="flex items-baseline justify-between gap-2">
                  <span class="text-sm text-text-primary">{{ ing.name }}</span>
                  <span class="text-sm font-semibold text-text-primary whitespace-nowrap">
                    {{ formatQuantity(ing.quantity, ing.unit) }}
                  </span>
                </div>
                @if (ing.contributions.length > 1) {
                  <p class="text-xs text-text-muted">{{ breakdown(ing) }}</p>
                }
              </li>
            }
          </ul>

          <!-- Night-before prep: AI steps when available, produce fallback otherwise -->
          @if (block.prepSteps.length > 0) {
            <h3 class="text-sm font-semibold text-text-muted uppercase tracking-wide mb-1.5">
              Veče pre — priprema
            </h3>
            <ul class="flex flex-col gap-1.5">
              @for (step of block.prepSteps; track step.key) {
                <li class="bg-cream-light rounded-xl">
                  <label class="flex items-center gap-3 px-3 py-2.5 cursor-pointer">
                    <input
                      type="checkbox"
                      [checked]="isChecked(stepKey(block, step))"
                      (change)="toggle(stepKey(block, step))"
                      class="w-5 h-5 rounded accent-green-primary shrink-0"
                    />
                    <span
                      class="text-sm flex-1"
                      [class.line-through]="isChecked(stepKey(block, step))"
                      [class.text-text-muted]="isChecked(stepKey(block, step))"
                    >
                      {{ step.label }}
                      <span class="text-xs text-text-muted">({{ step.dishName }})</span>
                    </span>
                  </label>
                </li>
              }
            </ul>
          } @else if (block.prepAhead.length > 0) {
            <h3 class="text-sm font-semibold text-text-muted uppercase tracking-wide mb-1.5">
              Veče pre — operi, oljušti, iseckaj
            </h3>
            <ul class="flex flex-col gap-1.5">
              @for (item of block.prepAhead; track item.key) {
                <li class="bg-cream-light rounded-xl">
                  <label class="flex items-center gap-3 px-3 py-2.5 cursor-pointer">
                    <input
                      type="checkbox"
                      [checked]="isChecked(prepKey(block, item))"
                      (change)="toggle(prepKey(block, item))"
                      class="w-5 h-5 rounded accent-green-primary shrink-0"
                    />
                    <span
                      class="text-sm flex-1"
                      [class.line-through]="isChecked(prepKey(block, item))"
                      [class.text-text-muted]="isChecked(prepKey(block, item))"
                    >
                      {{ item.name }} {{ formatQuantity(item.quantity, item.unit) }}
                    </span>
                  </label>
                </li>
              }
            </ul>
          }
        </section>
      } @empty {
        <div class="bg-white rounded-2xl shadow-sm p-6 text-center">
          @if (cookPlan.settings().cookDayIndexes.length === 0) {
            <p class="text-text-muted text-sm">Izaberi bar jedan dan kuvanja iznad.</p>
          } @else {
            <p class="text-text-muted text-sm">Nema jela za kuvanje u ovonedeljnom planu.</p>
          }
        </div>
      }
    </div>
  `,
})
export class CookPlanComponent {
  readonly cookPlan = inject(CookPlanService);
  private readonly location = inject(Location);

  readonly dayOptions = DAY_SHORT.map((label, index) => ({ index, label }));

  goBack(): void {
    this.location.back();
  }

  isCookDay(index: number): boolean {
    return this.cookPlan.settings().cookDayIndexes.includes(index);
  }

  toggleDay(index: number): void {
    const current = this.cookPlan.settings().cookDayIndexes;
    const next = current.includes(index)
      ? current.filter(d => d !== index)
      : [...current, index];
    this.cookPlan.setCookDays(next);
  }

  isChecked(key: string): boolean {
    return !!this.cookPlan.checked()[key];
  }

  toggle(key: string): void {
    this.cookPlan.toggleChecked(key);
  }

  dishKey(block: CookBlock, dish: BlockDish): string {
    return `cook:${block.id}:dish:${dish.key}`;
  }

  prepKey(block: CookBlock, item: BlockIngredient): string {
    return `cook:${block.id}:prep:${item.key}`;
  }

  stepKey(block: CookBlock, step: PrepStep): string {
    return `cook:${block.id}:aistep:${step.key}`;
  }

  checkedCount(block: CookBlock): number {
    const prepChecked =
      block.prepSteps.length > 0
        ? block.prepSteps.filter(s => this.isChecked(this.stepKey(block, s))).length
        : block.prepAhead.filter(i => this.isChecked(this.prepKey(block, i))).length;
    return block.dishes.filter(d => this.isChecked(this.dishKey(block, d))).length + prepChecked;
  }

  totalCount(block: CookBlock): number {
    const prepTotal = block.prepSteps.length > 0 ? block.prepSteps.length : block.prepAhead.length;
    return block.dishes.length + prepTotal;
  }

  coversLabel(block: CookBlock): string {
    return block.coversDayIndexes.map(d => DAY_SHORT[d]).join(', ');
  }

  dishMeta(dish: BlockDish): string {
    const portions = dish.portions === 1 ? '1 porcija' : `${dish.portions} porcije`;
    const days = Array.from(new Set(dish.sources.map(s => DAY_SHORT[s.dayIndex]))).join(', ');
    const users = Array.from(new Set(dish.sources.map(s => s.userName))).filter(
      n => n !== 'Ti',
    );
    const who = users.length > 0 ? ` · ${users.join(', ')}` : '';
    return `${portions} · ${days}${who}`;
  }

  formatQuantity(quantity: number | null, unit: string): string {
    return quantity == null ? '' : `${quantity}${unit}`;
  }

  breakdown(ing: BlockIngredient): string {
    return ing.contributions
      .map(c =>
        c.quantity == null ? c.dishName : `${c.quantity}${c.unit} ${c.dishName}`,
      )
      .join(' + ');
  }
}
