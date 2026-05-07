import { Component, inject, input, computed, signal, OnDestroy } from '@angular/core';
import { Location } from '@angular/common';
import { MealDataService } from '../../core/services/meal-data.service';
import { HouseholdService } from '../../core/services/household.service';
import { MealType, MEAL_LABELS, MEAL_TIMES, Recipe } from '../../core/models/meal.model';
import { UserProfile } from '../../core/models/user.model';
import { QuantityPipe } from '../../shared/pipes/quantity.pipe';
import { MealTypeBadgeComponent } from '../../shared/components/meal-type-badge.component';
import { UserAvatarComponent } from '../../shared/components/user-avatar.component';

@Component({
  selector: 'app-meal-detail',
  imports: [QuantityPipe, MealTypeBadgeComponent, UserAvatarComponent],
  template: `
    <div class="px-4 py-4" [class.cook-mode]="cookMode()">
      @if (!cookMode()) {
        <button (click)="goBack()" aria-label="Nazad" class="mb-3 text-green-primary font-medium active:opacity-70 min-h-[44px] flex items-center">
          <span aria-hidden="true">‹</span>&nbsp;Nazad
        </button>
      }

      @if (meal(); as m) {
        @if (!cookMode()) {
          <app-meal-type-badge [mealType]="m.type" />

          @if (mealOwner(); as owner) {
            <div class="flex items-center gap-2 mt-2 mb-1">
              <app-user-avatar [user]="owner" size="sm" />
              <span class="text-sm text-text-secondary">{{ owner.name }}</span>
            </div>
          }

          <h1 class="text-2xl font-bold text-text-primary mt-2 mb-1">{{ m.name }}</h1>
          <p class="text-sm text-text-secondary mb-6">{{ m.description }}</p>

          <h2 class="text-base font-semibold text-text-primary mb-3">Sastojci</h2>
          <ul class="flex flex-col gap-2 mb-6">
            @for (ing of m.ingredients; track ing.name) {
              <li class="bg-white rounded-xl shadow-sm">
                <label class="flex items-center gap-3 px-4 py-3 cursor-pointer">
                  <input type="checkbox"
                         [checked]="!!checked()[ing.name]"
                         (change)="toggleIngredient(ing.name)"
                         class="w-5 h-5 rounded accent-green-primary" />
                  <span [class.line-through]="checked()[ing.name]"
                        [class.text-text-muted]="checked()[ing.name]"
                        class="text-sm">
                    {{ ing | quantity }}
                  </span>
                </label>
              </li>
            }
          </ul>
        }

        @if (recipe(); as r) {
          @if (!cookMode()) {
            <div class="flex items-center justify-between mb-3">
              <h2 class="text-base font-semibold text-text-primary">Recept: {{ r.name }}</h2>
              <button
                (click)="enterCookMode()"
                class="px-4 py-2 bg-orange-primary text-white text-sm font-medium rounded-xl active:scale-95 transition-transform min-h-[44px]"
                aria-label="Uđi u režim kuvanja">
                🍳 Kuvaj
              </button>
            </div>
            <p class="text-xs text-text-muted mb-2">{{ r.servings }}</p>
            <ol class="flex flex-col gap-2 mb-4">
              @for (step of r.instructions; track $index) {
                <li
                  (click)="setActiveStep($index)"
                  class="flex gap-3 bg-white rounded-xl px-4 py-3 shadow-sm cursor-pointer transition-all duration-200"
                  [class.ring-2]="activeStep() === $index"
                  [class.ring-green-primary]="activeStep() === $index"
                  [class.opacity-40]="activeStep() !== null && completedSteps()[$index]">
                  <span class="text-green-primary font-semibold text-sm shrink-0">{{ $index + 1 }}.</span>
                  <span class="text-sm text-text-secondary"
                        [class.line-through]="completedSteps()[$index]">{{ step }}</span>
                </li>
              }
            </ol>
          } @else {
            <!-- Cook Mode UI -->
            <div class="cook-mode-header flex items-center justify-between mb-4 sticky top-0 bg-cream z-10 py-3 -mx-4 px-4">
              <button
                (click)="exitCookMode()"
                class="text-green-primary font-medium active:opacity-70 min-h-[44px] flex items-center"
                aria-label="Izađi iz režima kuvanja">
                <span aria-hidden="true">‹</span>&nbsp;Nazad
              </button>
              <span class="text-sm font-semibold text-text-primary">{{ r.name }}</span>
              <span class="text-xs text-text-muted font-medium px-2 py-1 bg-white rounded-full">
                {{ cookProgress() }}
              </span>
            </div>

            <!-- Cook Mode Steps -->
            <ol class="flex flex-col gap-3 mb-6">
              @for (step of r.instructions; track $index) {
                <li
                  [id]="'cook-step-' + $index"
                  (click)="toggleStepComplete($index)"
                  class="rounded-2xl px-5 py-4 shadow-sm cursor-pointer transition-all duration-200"
                  [class]="cookStepClasses($index)"
                  role="button"
                  [attr.aria-label]="'Korak ' + ($index + 1) + (completedSteps()[$index] ? ', završen' : activeStep() === $index ? ', trenutni' : '')">
                  <div class="flex gap-3 items-start">
                    <span class="font-bold shrink-0 text-lg" [class.text-white]="activeStep() === $index" [class.text-green-primary]="activeStep() !== $index">
                      {{ $index + 1 }}.
                    </span>
                    <span class="leading-relaxed"
                          [class.text-lg]="activeStep() === $index"
                          [class.text-base]="activeStep() !== $index"
                          [class.line-through]="completedSteps()[$index]">
                      {{ step }}
                    </span>
                  </div>
                </li>
              }
            </ol>

            <!-- Cook Mode Navigation -->
            <div class="sticky bottom-4 flex gap-3">
              <button
                (click)="prevStep()"
                [disabled]="activeStep() === 0 || activeStep() === null"
                class="flex-1 py-3 bg-white text-green-primary font-medium rounded-2xl shadow-sm active:scale-[0.98] transition-transform min-h-12 disabled:opacity-30">
                ← Prethodni
              </button>
              @if (activeStep() !== null && activeStep()! < r.instructions.length - 1) {
                <button
                  (click)="nextStep()"
                  class="flex-1 py-3 bg-green-primary text-white font-medium rounded-2xl shadow-sm active:scale-[0.98] transition-transform min-h-12">
                  Sledeći →
                </button>
              } @else {
                <button
                  (click)="exitCookMode()"
                  class="flex-1 py-3 bg-orange-primary text-white font-medium rounded-2xl shadow-sm active:scale-[0.98] transition-transform min-h-12">
                  Završi ✓
                </button>
              }
            </div>
          }
        }
      } @else {
        <p class="text-center text-text-muted py-8">Obrok nije pronađen</p>
      }
    </div>
  `,
  styles: `
    :host {
      display: block;
    }
    .cook-mode {
      min-height: 100dvh;
      padding-bottom: 5rem;
    }
  `,
})
export class MealDetailComponent implements OnDestroy {
  private readonly mealData = inject(MealDataService);
  private readonly householdService = inject(HouseholdService);
  private readonly location = inject(Location);

  readonly dayIndex = input.required<string>();
  readonly mealType = input.required<string>();
  /** Bound from the `?user=<id>` query param via withComponentInputBinding().
   *  When set, the detail view resolves the meal + owner against this
   *  household member's plan instead of the viewer's. */
  readonly user = input<string | undefined>(undefined);

  readonly checked = signal<Record<string, boolean>>({});
  readonly cookMode = signal(false);
  readonly activeStep = signal<number | null>(null);
  readonly completedSteps = signal<Record<number, boolean>>({});

  private wakeLock: WakeLockSentinel | null = null;

  readonly cookProgress = computed(() => {
    const recipe = this.recipe();
    if (!recipe) return '';
    const total = recipe.instructions.length;
    const done = Object.values(this.completedSteps()).filter(Boolean).length;
    return `${done}/${total}`;
  });

  readonly mealOwner = computed<UserProfile | null>(() => {
    if (!this.householdService.isLoggedIn()) return null;
    const otherUid = this.user();
    if (otherUid) {
      return this.householdService.members().find(m => m.id === otherUid) ?? null;
    }
    return this.householdService.currentUser();
  });

  readonly meal = computed(() => {
    const day = Number(this.dayIndex());
    const type = this.mealType() as MealType;
    const otherUid = this.user();
    if (otherUid) {
      return this.mealData.getMealForUser(otherUid, day, type);
    }
    return this.mealData.getMealForDay(day, type);
  });

  readonly recipe = computed<Recipe | null>(() => {
    const m = this.meal();
    if (!m?.recipeRef) return null;
    return this.mealData.recipes().find(r => r.id === m.recipeRef) ?? null;
  });

  ngOnDestroy(): void {
    this.releaseWakeLock();
  }

  enterCookMode(): void {
    this.cookMode.set(true);
    this.activeStep.set(0);
    this.requestWakeLock();
    this.scrollToStep(0);
  }

  exitCookMode(): void {
    this.cookMode.set(false);
    this.releaseWakeLock();
  }

  setActiveStep(index: number): void {
    this.activeStep.set(index);
  }

  toggleStepComplete(index: number): void {
    this.completedSteps.update(s => ({ ...s, [index]: !s[index] }));
    // Auto-advance to next incomplete step
    const recipe = this.recipe();
    if (recipe && !this.completedSteps()[index]) {
      // Step was just uncompleted, keep focus
      return;
    }
    if (recipe) {
      const next = this.findNextIncompleteStep(index + 1, recipe.instructions.length);
      if (next !== null) {
        this.activeStep.set(next);
        this.scrollToStep(next);
      }
    }
  }

  nextStep(): void {
    const current = this.activeStep();
    const recipe = this.recipe();
    if (current === null || !recipe) return;
    if (current < recipe.instructions.length - 1) {
      const next = current + 1;
      this.activeStep.set(next);
      this.scrollToStep(next);
    }
  }

  prevStep(): void {
    const current = this.activeStep();
    if (current === null || current <= 0) return;
    const prev = current - 1;
    this.activeStep.set(prev);
    this.scrollToStep(prev);
  }

  cookStepClasses(index: number): string {
    const isActive = this.activeStep() === index;
    const isCompleted = this.completedSteps()[index];
    if (isActive && !isCompleted) return 'bg-green-primary text-white shadow-md';
    if (isCompleted) return 'bg-white text-text-muted opacity-60';
    return 'bg-white text-text-secondary';
  }

  toggleIngredient(name: string): void {
    this.checked.update(c => ({ ...c, [name]: !c[name] }));
  }

  goBack(): void {
    this.location.back();
  }

  private findNextIncompleteStep(from: number, total: number): number | null {
    for (let i = from; i < total; i++) {
      if (!this.completedSteps()[i]) return i;
    }
    return null;
  }

  private scrollToStep(index: number): void {
    setTimeout(() => {
      document.getElementById(`cook-step-${index}`)?.scrollIntoView({ behavior: 'smooth', block: 'center' });
    });
  }

  private async requestWakeLock(): Promise<void> {
    try {
      if ('wakeLock' in navigator) {
        this.wakeLock = await navigator.wakeLock.request('screen');
      }
    } catch {
      // Wake Lock not supported or denied — non-critical
    }
  }

  private releaseWakeLock(): void {
    this.wakeLock?.release();
    this.wakeLock = null;
  }
}
