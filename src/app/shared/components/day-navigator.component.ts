import { Component, input, output } from '@angular/core';
import { DAY_NAMES } from '../../core/models/meal.model';

@Component({
  selector: 'app-day-navigator',
  template: `
    <div class="flex items-center justify-between px-4 py-3">
      <button
        (click)="prev()"
        class="w-11 h-11 flex items-center justify-center rounded-full bg-white shadow-sm active:scale-95 transition-transform"
        [disabled]="dayIndex() <= 0">
        <span class="text-lg">‹</span>
      </button>
      <div class="text-center">
        <h2 class="text-lg font-semibold text-text-primary">{{ dayName() }}</h2>
      </div>
      <button
        (click)="next()"
        class="w-11 h-11 flex items-center justify-center rounded-full bg-white shadow-sm active:scale-95 transition-transform"
        [disabled]="dayIndex() >= 6">
        <span class="text-lg">›</span>
      </button>
    </div>
  `,
})
export class DayNavigatorComponent {
  readonly dayIndex = input.required<number>();
  readonly dayChange = output<number>();

  dayName(): string {
    return DAY_NAMES[this.dayIndex()] ?? '';
  }

  prev(): void {
    const idx = this.dayIndex();
    if (idx > 0) this.dayChange.emit(idx - 1);
  }

  next(): void {
    const idx = this.dayIndex();
    if (idx < 6) this.dayChange.emit(idx + 1);
  }
}
