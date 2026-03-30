import { Component, inject, input, signal, computed, OnInit, ElementRef } from '@angular/core';
import { Router } from '@angular/router';
import { MealDataService } from '../../core/services/meal-data.service';
import { HouseholdService } from '../../core/services/household.service';
import { DayNavigatorComponent } from '../../shared/components/day-navigator.component';
import { UserSwitcherComponent } from '../../shared/components/user-switcher.component';
import { MealCardComponent } from './meal-card.component';
import { DayPlan } from '../../core/models/meal.model';

const SWIPE_THRESHOLD = 50;

@Component({
  selector: 'app-daily-view',
  imports: [DayNavigatorComponent, UserSwitcherComponent, MealCardComponent],
  host: {
    '(touchstart)': 'onTouchStart($event)',
    '(touchend)': 'onTouchEnd($event)',
  },
  template: `
    @if (mealData.loading()) {
      <div class="flex items-center justify-center h-64" role="status" aria-live="polite">
        <span class="text-text-muted">Učitavanje...</span>
      </div>
    } @else {
      <app-user-switcher
        [selectedUserId]="viewingUserId()"
        (selectUser)="viewingUserId.set($event)" />

      <app-day-navigator
        [dayIndex]="mealData.currentDayIndex()"
        (dayChange)="onDayChange($event)" />

      <div class="px-4 flex flex-col gap-3 pb-4">
        @if (activeDayPlan(); as day) {
          @for (meal of day.meals; track meal.type) {
            <app-meal-card [meal]="meal" [dayIndex]="day.dayIndex" />
          }

          <button
            (click)="openChecklist()"
            class="mt-2 w-full py-3 bg-green-primary text-white font-medium rounded-2xl active:scale-[0.98] transition-transform min-h-12">
            Pripremi sastojke
          </button>
        } @else {
          <p class="text-center text-text-muted py-8">Nema plana za ovaj dan</p>
        }
      </div>
    }
  `,
})
export class DailyViewComponent implements OnInit {
  readonly mealData = inject(MealDataService);
  private readonly householdService = inject(HouseholdService);
  private readonly router = inject(Router);

  readonly dayIndex = input<string>();
  readonly viewingUserId = signal<string>('');

  private touchStartX = 0;
  private touchStartY = 0;

  /** Show the selected user's day plan, or the current user's own plan */
  readonly activeDayPlan = computed<DayPlan | null>(() => {
    const uid = this.viewingUserId();
    const currentUid = this.householdService.currentUserId();
    const dayIdx = this.mealData.currentDayIndex();

    // If viewing own plan or not logged in, use the local plan
    if (!uid || uid === currentUid) {
      return this.mealData.currentDayPlan();
    }

    // Viewing another user's plan from KV
    return this.mealData.getDayPlanForUser(uid, dayIdx);
  });

  ngOnInit(): void {
    const idx = this.dayIndex();
    if (idx != null) {
      this.mealData.setDayIndex(Number(idx));
    }

    // Default to current user
    const uid = this.householdService.currentUserId();
    if (uid) {
      this.viewingUserId.set(uid);
    }
  }

  onDayChange(index: number): void {
    this.mealData.setDayIndex(index);
    this.router.navigate(['/day', index]);
  }

  openChecklist(): void {
    this.router.navigate(['/day', this.mealData.currentDayIndex(), 'checklist']);
  }

  onTouchStart(e: TouchEvent): void {
    this.touchStartX = e.touches[0].clientX;
    this.touchStartY = e.touches[0].clientY;
  }

  onTouchEnd(e: TouchEvent): void {
    const dx = e.changedTouches[0].clientX - this.touchStartX;
    const dy = e.changedTouches[0].clientY - this.touchStartY;

    // Only trigger if horizontal swipe is dominant and exceeds threshold
    if (Math.abs(dx) < SWIPE_THRESHOLD || Math.abs(dy) > Math.abs(dx)) return;

    const currentIdx = this.mealData.currentDayIndex();
    if (dx < 0 && currentIdx < 6) {
      this.onDayChange(currentIdx + 1);
    } else if (dx > 0 && currentIdx > 0) {
      this.onDayChange(currentIdx - 1);
    }
  }
}
