import { Component, inject, signal, computed } from '@angular/core';
import { Router } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { MealDataService } from '../../core/services/meal-data.service';
import { HouseholdService } from '../../core/services/household.service';
import { DocxImportService } from './docx-import.service';
import { JsonExportService } from './json-export.service';
import { MealFormComponent } from './meal-form.component';
import { RecipeFormComponent } from './recipe-form.component';
import { UserAvatarComponent } from '../../shared/components/user-avatar.component';
import { AiPlanFormComponent } from './ai-plan-form.component';
import {
  WeeklyPlan, DayPlan, Meal, MealType, Recipe,
  DAY_NAMES, MEAL_TIMES, IngredientCategory,
} from '../../core/models/meal.model';
import { UserProfile } from '../../core/models/user.model';

type EditorTab = 'meals' | 'recipes' | 'import' | 'ai';

@Component({
  selector: 'app-editor',
  imports: [FormsModule, MealFormComponent, RecipeFormComponent, UserAvatarComponent, AiPlanFormComponent],
  template: `
    <div class="px-4 py-4 pb-24">
      <div class="flex items-center justify-between mb-4">
        <h1 class="text-xl font-bold text-text-primary">Uredi plan</h1>
        <div class="flex gap-2">
          <button
            (click)="exportJson()"
            class="px-3 py-2 bg-white rounded-lg text-sm text-text-secondary shadow-sm min-h-11">
            Izvezi JSON
          </button>
          <button
            (click)="savePlan()"
            class="px-4 py-2 bg-green-primary text-white rounded-lg text-sm font-medium shadow-sm min-h-11">
            Sačuvaj
          </button>
        </div>
      </div>

      <!-- Main tabs: Obroci / Recepti / Uvoz -->
      <div class="flex gap-2 mb-4">
        @for (tab of tabs; track tab.value) {
          <button
            (click)="activeTab.set(tab.value)"
            class="px-4 py-2 rounded-full text-sm font-medium transition-colors min-h-11"
            [class.bg-green-primary]="activeTab() === tab.value"
            [class.text-white]="activeTab() === tab.value"
            [class.bg-white]="activeTab() !== tab.value"
            [class.text-text-secondary]="activeTab() !== tab.value">
            {{ tab.label }}
          </button>
        }
      </div>

      @switch (activeTab()) {
        @case ('meals') {
          <!-- Day tabs -->
          <div class="flex gap-1.5 mb-4 overflow-x-auto pb-1">
            @for (day of dayTabs; track day.index) {
              <button
                (click)="selectedDay.set(day.index)"
                class="px-3 py-1.5 rounded-full text-xs font-medium whitespace-nowrap transition-colors min-h-9"
                [class.bg-orange-primary]="selectedDay() === day.index"
                [class.text-white]="selectedDay() === day.index"
                [class.bg-white]="selectedDay() !== day.index"
                [class.text-text-muted]="selectedDay() !== day.index">
                {{ day.short }}
              </button>
            }
          </div>

          <!-- Meal forms for selected day -->
          @if (currentDayPlan(); as day) {
            @for (meal of day.meals; track meal.type) {
              <app-meal-form
                [meal]="meal"
                (change)="updateMeal(day.dayIndex, meal.type, $event)" />
            }
          }
        }

        @case ('recipes') {
          @for (recipe of editingPlan().recipes; track $index) {
            <app-recipe-form
              [recipe]="recipe"
              (change)="updateRecipe($index, $event)"
              (remove)="removeRecipe($index)" />
          }
          <button
            (click)="addRecipe()"
            class="w-full py-3 border-2 border-dashed border-gray-300 rounded-2xl text-sm text-text-muted hover:border-green-primary hover:text-green-primary transition-colors min-h-11">
            + Dodaj recept
          </button>
        }

        @case ('import') {
          <div class="flex flex-col gap-4">
            <!-- .docx import -->
            <div class="bg-white rounded-2xl shadow-sm p-4">
              <h2 class="font-semibold text-text-primary mb-2">Uvezi iz .docx fajla</h2>
              <p class="text-sm text-text-muted mb-3">
                Učitaj plan ishrane iz Word dokumenta. Format: sekcije za D 9h, U 11h, R 14h, V 18h sa po 7 stavki.
              </p>

              <!-- User assignment for import -->
              @if (isMultiUser()) {
                <div class="mb-3">
                  <p class="text-xs text-text-muted mb-2">Dodeli plan korisniku:</p>
                  <div class="flex gap-2 flex-wrap">
                    @for (member of members(); track member.id) {
                      <button
                        (click)="importTargetUser.set(member)"
                        class="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm transition-colors min-h-11"
                        [class.ring-2]="importTargetUser()?.id === member.id"
                        [style.--tw-ring-color]="member.color"
                        [class.bg-white]="importTargetUser()?.id !== member.id"
                        [class.shadow-sm]="importTargetUser()?.id === member.id">
                        <app-user-avatar [user]="member" size="sm" />
                        <span [style.color]="importTargetUser()?.id === member.id ? member.color : ''">
                          {{ member.name }}
                        </span>
                      </button>
                    }
                  </div>
                </div>
              }

              <input
                type="file"
                accept=".docx"
                (change)="onDocxSelected($event)"
                class="block w-full text-sm text-text-secondary file:mr-3 file:py-2 file:px-4 file:rounded-lg file:border-0 file:bg-green-primary file:text-white file:font-medium file:cursor-pointer file:min-h-11" />

              @if (importStatus()) {
                <p class="mt-2 text-sm" [class.text-green-primary]="!importError()" [class.text-red-500]="importError()">
                  {{ importStatus() }}
                </p>
              }
            </div>

            <!-- JSON import -->
            <div class="bg-white rounded-2xl shadow-sm p-4">
              <h2 class="font-semibold text-text-primary mb-2">Uvezi iz JSON fajla</h2>
              <p class="text-sm text-text-muted mb-3">
                Učitaj prethodno izvezen plan u JSON formatu.
              </p>

              @if (isMultiUser()) {
                <div class="mb-3">
                  <p class="text-xs text-text-muted mb-2">Dodeli plan korisniku:</p>
                  <div class="flex gap-2 flex-wrap">
                    @for (member of members(); track member.id) {
                      <button
                        (click)="importTargetUser.set(member)"
                        class="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm transition-colors min-h-11"
                        [class.ring-2]="importTargetUser()?.id === member.id"
                        [style.--tw-ring-color]="member.color"
                        [class.bg-white]="importTargetUser()?.id !== member.id"
                        [class.shadow-sm]="importTargetUser()?.id === member.id">
                        <app-user-avatar [user]="member" size="sm" />
                        <span [style.color]="importTargetUser()?.id === member.id ? member.color : ''">
                          {{ member.name }}
                        </span>
                      </button>
                    }
                  </div>
                </div>
              }

              <input
                type="file"
                accept=".json"
                (change)="onJsonSelected($event)"
                class="block w-full text-sm text-text-secondary file:mr-3 file:py-2 file:px-4 file:rounded-lg file:border-0 file:bg-green-primary file:text-white file:font-medium file:cursor-pointer file:min-h-11" />
            </div>
          </div>
        }

        @case ('ai') {
          <app-ai-plan-form (planGenerated)="onAiPlanGenerated($event)" />
        }
      }

      <!-- Save status -->
      @if (saveStatus()) {
        <div class="fixed bottom-20 left-4 right-4 bg-green-primary text-white text-sm font-medium px-4 py-3 rounded-xl shadow-lg text-center z-50 animate-pulse">
          {{ saveStatus() }}
        </div>
      }
    </div>
  `,
})
export class EditorComponent {
  private readonly mealData = inject(MealDataService);
  private readonly householdService = inject(HouseholdService);
  private readonly docxImport = inject(DocxImportService);
  private readonly jsonExport = inject(JsonExportService);
  private readonly router = inject(Router);

  readonly activeTab = signal<EditorTab>('meals');
  readonly selectedDay = signal(0);
  readonly importStatus = signal('');
  readonly importError = signal(false);
  readonly saveStatus = signal('');
  readonly importTargetUser = signal<UserProfile | null>(null);

  readonly tabs: { value: EditorTab; label: string }[] = [
    { value: 'meals', label: 'Obroci' },
    { value: 'recipes', label: 'Recepti' },
    { value: 'import', label: 'Uvoz' },
    { value: 'ai', label: 'AI Plan' },
  ];

  readonly dayTabs = DAY_NAMES.map((name, i) => ({
    index: i,
    short: name.substring(0, 3),
  }));

  /** Working copy of the plan being edited */
  readonly editingPlan = signal<WeeklyPlan>(this.initEditingPlan());

  readonly currentDayPlan = computed<DayPlan | null>(() => {
    return this.editingPlan().days[this.selectedDay()] ?? null;
  });

  readonly isMultiUser = computed(() => this.householdService.members().length > 1);
  readonly members = computed(() => this.householdService.members());

  constructor() {
    // Default import target to current user
    const currentUser = this.householdService.currentUser();
    if (currentUser) {
      this.importTargetUser.set(currentUser);
    }
  }

  updateMeal(dayIndex: number, mealType: MealType, updated: Meal): void {
    this.editingPlan.update(plan => {
      const days = [...plan.days];
      const day = { ...days[dayIndex], meals: [...days[dayIndex].meals] };
      const mealIdx = day.meals.findIndex(m => m.type === mealType);
      if (mealIdx >= 0) {
        day.meals[mealIdx] = updated;
      }
      days[dayIndex] = day;
      return { ...plan, days };
    });
  }

  updateRecipe(index: number, updated: Recipe): void {
    this.editingPlan.update(plan => {
      const recipes = [...plan.recipes];
      recipes[index] = updated;
      return { ...plan, recipes };
    });
  }

  removeRecipe(index: number): void {
    this.editingPlan.update(plan => ({
      ...plan,
      recipes: plan.recipes.filter((_, i) => i !== index),
    }));
  }

  addRecipe(): void {
    this.editingPlan.update(plan => ({
      ...plan,
      recipes: [
        ...plan.recipes,
        {
          id: `recipe-${Date.now()}`,
          name: '',
          servings: '',
          ingredients: [],
          instructions: [],
        },
      ],
    }));
  }

  async onDocxSelected(event: Event): Promise<void> {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    if (!file) return;

    this.importStatus.set('Učitavanje...');
    this.importError.set(false);

    try {
      const plan = await this.docxImport.parseDocx(file);
      this.applyImportedPlan(plan);
      this.importStatus.set(`Uspešno uvezeno! ${plan.days.filter(d => d.meals.some(m => m.name)).length} dana sa obrocima.`);
      this.activeTab.set('meals');
    } catch (err) {
      this.importError.set(true);
      this.importStatus.set('Greška pri uvozu. Proverite format dokumenta.');
    }

    input.value = '';
  }

  async onJsonSelected(event: Event): Promise<void> {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    if (!file) return;

    try {
      const plan = await this.jsonExport.importPlan(file);
      this.applyImportedPlan(plan);
      this.importStatus.set('JSON plan uspešno učitan!');
      this.importError.set(false);
      this.activeTab.set('meals');
    } catch (err: any) {
      this.importError.set(true);
      this.importStatus.set(err.message ?? 'Greška pri uvozu JSON fajla.');
    }

    input.value = '';
  }

  savePlan(): void {
    const plan = this.editingPlan();
    const targetUser = this.importTargetUser();

    if (this.isMultiUser() && targetUser) {
      // Save to specific user via API
      this.mealData.savePlanForUser(targetUser.id, plan);
      this.saveStatus.set(`Plan sačuvan za ${targetUser.name}!`);
    } else {
      // Save to local / current user
      this.mealData.savePlanToLocalStorage(plan);
      this.saveStatus.set('Plan sačuvan!');
    }

    setTimeout(() => this.saveStatus.set(''), 2000);
  }

  exportJson(): void {
    this.jsonExport.exportPlan(this.editingPlan());
  }

  onAiPlanGenerated(plan: WeeklyPlan): void {
    this.applyImportedPlan(plan);
    this.saveStatus.set('AI plan generisan!');
    this.activeTab.set('meals');
    setTimeout(() => this.saveStatus.set(''), 2000);
  }

  private applyImportedPlan(plan: WeeklyPlan): void {
    const targetUser = this.importTargetUser();

    if (this.isMultiUser() && targetUser) {
      // When importing for a specific user, save directly to that user
      this.mealData.savePlanForUser(targetUser.id, plan);
      // Also load into editor
      this.editingPlan.set(plan);
    } else {
      this.editingPlan.set(plan);
    }
  }

  private initEditingPlan(): WeeklyPlan {
    const existing = this.mealData.plan();
    if (existing) {
      return JSON.parse(JSON.stringify(existing));
    }

    return {
      weekLabel: 'Novi plan',
      days: Array.from({ length: 7 }, (_, i) => ({
        dayIndex: i,
        dayName: DAY_NAMES[i],
        meals: [
          { type: MealType.Breakfast, time: MEAL_TIMES[MealType.Breakfast], name: '', description: '', ingredients: [] },
          { type: MealType.Snack, time: MEAL_TIMES[MealType.Snack], name: '', description: '', ingredients: [] },
          { type: MealType.Lunch, time: MEAL_TIMES[MealType.Lunch], name: '', description: '', ingredients: [] },
          { type: MealType.AfternoonSnack, time: MEAL_TIMES[MealType.AfternoonSnack], name: '', description: '', ingredients: [] },
          { type: MealType.Dinner, time: MEAL_TIMES[MealType.Dinner], name: '', description: '', ingredients: [] },
        ],
      })),
      recipes: [],
    };
  }
}
