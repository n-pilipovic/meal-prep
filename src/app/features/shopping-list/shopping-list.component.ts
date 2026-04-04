import { Component, inject, computed } from '@angular/core';
import { HouseholdService } from '../../core/services/household.service';
import { ShoppingListService } from '../../core/services/shopping-list.service';
import { QuantityPipe } from '../../shared/pipes/quantity.pipe';
import { AssignmentBadgeComponent } from '../../shared/components/assignment-badge.component';
@Component({
  selector: 'app-shopping-list',
  imports: [QuantityPipe, AssignmentBadgeComponent],
  template: `
    <div class="px-4 py-4">
      <h1 class="text-xl font-bold text-text-primary mb-3">Lista za kupovinu</h1>

      <!-- Scope toggle: Danas / Cela nedelja -->
      <div class="flex gap-2 mb-3">
        @for (opt of scopes; track opt.value) {
          <button
            (click)="shoppingService.scope.set(opt.value)"
            [attr.aria-pressed]="shoppingService.scope() === opt.value"
            class="px-4 py-2 rounded-full text-sm font-medium transition-colors min-h-11"
            [class.bg-green-primary]="shoppingService.scope() === opt.value"
            [class.text-white]="shoppingService.scope() === opt.value"
            [class.bg-white]="shoppingService.scope() !== opt.value"
            [class.text-text-secondary]="shoppingService.scope() !== opt.value">
            {{ opt.label }}
          </button>
        }
      </div>

      <!-- Filter toggle: Sve / Moje (only when multi-user) -->
      @if (isMultiUser()) {
        <div class="flex gap-2 mb-4">
          @for (opt of filters; track opt.value) {
            <button
              (click)="shoppingService.filter.set(opt.value)"
              [attr.aria-pressed]="shoppingService.filter() === opt.value"
              class="px-3 py-1.5 rounded-full text-xs font-medium transition-colors min-h-9"
              [class.bg-green-primary]="shoppingService.filter() === opt.value"
              [class.text-white]="shoppingService.filter() === opt.value"
              [class.bg-white]="shoppingService.filter() !== opt.value"
              [class.text-text-muted]="shoppingService.filter() !== opt.value">
              {{ opt.label }}
            </button>
          }
        </div>
      }

      @if (shoppingService.groupedIngredients().length === 0) {
        <p class="text-center text-text-muted py-8">Nema sastojaka za prikaz</p>
      }

      @for (group of shoppingService.groupedIngredients(); track group.category) {
        <h2 class="text-sm font-semibold text-text-muted uppercase tracking-wide mt-4 mb-2">
          {{ group.label }}
        </h2>
        <ul class="flex flex-col gap-1.5">
          @for (ing of group.items; track ing.key) {
            <li class="bg-white rounded-xl shadow-sm">
              <div class="flex items-center gap-3 px-4 py-3">
                <label class="flex items-center gap-3 flex-1 min-w-0 cursor-pointer">
                  <input type="checkbox"
                         [checked]="shoppingService.checked()[ing.key]"
                         (change)="shoppingService.toggleChecked(ing.key)"
                         class="w-5 h-5 rounded accent-green-primary shrink-0" />
                  <div class="flex-1 min-w-0">
                    <span [class.line-through]="shoppingService.checked()[ing.key]"
                          [class.text-text-muted]="shoppingService.checked()[ing.key]"
                          class="text-sm">
                      {{ ing | quantity }}
                    </span>
                    @if (ing.variants.length > 1) {
                      <span class="text-[10px] text-text-muted ml-1">({{ ing.variants.join(', ') }})</span>
                    }
                    @if (isMultiUser() && ing.sources.length > 0) {
                      <div class="flex gap-1 mt-0.5">
                        @for (source of uniqueSources(ing.sources); track source.userId) {
                          <span class="text-[10px] px-1.5 py-0.5 rounded-full"
                                [style.background-color]="getMemberColor(source.userId) + '15'"
                                [style.color]="getMemberColor(source.userId)">
                            {{ source.userName }}
                          </span>
                        }
                      </div>
                    }
                  </div>
                </label>
                <app-assignment-badge
                  [assignedUserId]="shoppingService.assignments()[ing.key]"
                  (assign)="shoppingService.assignToUser(ing.key, $event)" />
              </div>
            </li>
          }
        </ul>
      }
    </div>
  `,
})
export class ShoppingListComponent {
  readonly shoppingService = inject(ShoppingListService);
  private readonly householdService = inject(HouseholdService);

  readonly scopes = [
    { value: 'today' as const, label: 'Danas' },
    { value: 'week' as const, label: 'Cela nedelja' },
  ];

  readonly filters = [
    { value: 'all' as const, label: 'Sve' },
    { value: 'mine' as const, label: 'Moje' },
  ];

  readonly isMultiUser = computed(() => this.householdService.members().length > 1);

  uniqueSources(sources: { userId: string; userName: string }[]): { userId: string; userName: string }[] {
    const seen = new Set<string>();
    return sources.filter(s => {
      if (seen.has(s.userId)) return false;
      seen.add(s.userId);
      return true;
    });
  }

  getMemberColor(userId: string): string {
    const member = this.householdService.members().find(m => m.id === userId);
    return member?.color ?? '#666';
  }
}
