import { Component, inject, signal, computed } from '@angular/core';
import { Router } from '@angular/router';
import { MealDataService } from '../../core/services/meal-data.service';
import { HouseholdService } from '../../core/services/household.service';
import { UserSwitcherComponent } from '../../shared/components/user-switcher.component';
import { MEAL_LABELS, MealType, DayPlan } from '../../core/models/meal.model';

@Component({
  selector: 'app-weekly-view',
  imports: [UserSwitcherComponent],
  template: `
    <div class="px-4 py-4">
      <h1 class="text-xl font-bold text-text-primary mb-2">Nedeljni plan</h1>

      <app-user-switcher
        [selectedUserId]="viewingUserId()"
        (selectUser)="viewingUserId.set($event)" />

      <div class="flex flex-col gap-3 mt-3">
        @for (day of activeDays(); track day.dayIndex) {
          <button
            (click)="goToDay(day.dayIndex)"
            class="bg-white rounded-2xl shadow-sm p-4 text-left active:scale-[0.98] transition-transform"
            [class.ring-2]="day.dayIndex === mealData.currentDayIndex()"
            [class.ring-green-primary]="day.dayIndex === mealData.currentDayIndex()">
            <h3 class="font-semibold text-text-primary mb-2">{{ day.dayName }}</h3>
            <div class="grid grid-cols-2 gap-1.5">
              @for (meal of day.meals; track meal.type) {
                <div class="text-xs text-text-secondary truncate">
                  <span class="font-medium">{{ mealLabel(meal.type) }}:</span> {{ meal.name }}
                </div>
              }
            </div>
          </button>
        }
      </div>
    </div>
  `,
})
export class WeeklyViewComponent {
  readonly mealData = inject(MealDataService);
  private readonly householdService = inject(HouseholdService);
  private readonly router = inject(Router);

  readonly viewingUserId = signal<string>(
    this.householdService.currentUserId() ?? '',
  );

  readonly activeDays = computed<DayPlan[]>(() => {
    const uid = this.viewingUserId();
    const currentUid = this.householdService.currentUserId();

    if (!uid || uid === currentUid) {
      return this.mealData.allDays();
    }

    const plans = this.mealData.householdPlans();
    return plans[uid]?.days ?? [];
  });

  mealLabel(type: string): string {
    return MEAL_LABELS[type as MealType] ?? type;
  }

  goToDay(dayIndex: number): void {
    this.mealData.setDayIndex(dayIndex);
    this.router.navigate(['/day', dayIndex]);
  }
}
