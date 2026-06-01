import { Component, input, output } from '@angular/core';
import { DAY_NAMES } from '../../core/models/meal.model';

@Component({
  selector: 'app-day-navigator',
  template: `
    <div class="flex items-center justify-between px-4 py-3">
      <button
        (click)="prev()"
        aria-label="Prethodni dan"
        class="w-11 h-11 flex items-center justify-center rounded-full bg-white shadow-sm active:scale-95 transition-transform">
        <span class="text-lg" aria-hidden="true">‹</span>
      </button>
      <div class="text-center" aria-live="polite">
        <h2 class="text-lg font-semibold text-text-primary">{{ dayName() }}</h2>
      </div>
      <button
        (click)="next()"
        aria-label="Sledeći dan"
        class="w-11 h-11 flex items-center justify-center rounded-full bg-white shadow-sm active:scale-95 transition-transform">
        <span class="text-lg" aria-hidden="true">›</span>
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

  /** Wraps around: from Monday (0) goes to Sunday (6). */
  prev(): void {
    this.dayChange.emit((this.dayIndex() + 6) % 7);
  }

  /** Wraps around: from Sunday (6) goes to Monday (0). */
  next(): void {
    this.dayChange.emit((this.dayIndex() + 1) % 7);
  }
}
