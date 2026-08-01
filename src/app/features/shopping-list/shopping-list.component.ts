import { Component, inject, computed, ChangeDetectionStrategy } from '@angular/core';
import { HouseholdService } from '../../core/services/household.service';
import { ShoppingListService } from '../../core/services/shopping-list.service';
import { ShoppingSummaryItem } from '../../core/models/shopping-summary.model';
import { QuantityPipe } from '../../shared/pipes/quantity.pipe';
import { AssignmentBadgeComponent } from '../../shared/components/assignment-badge.component';
@Component({
  selector: 'app-shopping-list',
  imports: [QuantityPipe, AssignmentBadgeComponent],
  changeDetection: ChangeDetectionStrategy.Eager,
  template: `
    <div class="px-4 py-4">
      <h1 class="text-xl font-bold text-text-primary mb-3">Lista za kupovinu</h1>

      <!-- Scope toggle: Danas / Cela nedelja -->
      <div class="flex gap-2 mb-3 items-center">
        @for (opt of scopes; track opt.value) {
          <button
            (click)="shoppingService.scope.set(opt.value)"
            [attr.aria-pressed]="shoppingService.scope() === opt.value"
            class="px-4 py-2 rounded-full text-sm font-medium transition-colors min-h-11"
            [class.bg-green-primary]="shoppingService.scope() === opt.value"
            [class.text-white]="shoppingService.scope() === opt.value"
            [class.bg-white]="shoppingService.scope() !== opt.value"
            [class.text-text-secondary]="shoppingService.scope() !== opt.value"
          >
            {{ opt.label }}
          </button>
        }
        <button
          (click)="toggleAiMode()"
          [attr.aria-pressed]="shoppingService.viewMode() === 'ai'"
          class="ml-auto px-3 py-2 rounded-full text-sm font-medium transition-colors min-h-11 inline-flex items-center gap-1.5"
          [class.bg-orange-primary]="shoppingService.viewMode() === 'ai'"
          [class.text-white]="shoppingService.viewMode() === 'ai'"
          [class.bg-white]="shoppingService.viewMode() !== 'ai'"
          [class.text-orange-primary]="shoppingService.viewMode() !== 'ai'"
          [class.border]="shoppingService.viewMode() !== 'ai'"
          [class.border-orange-primary]="shoppingService.viewMode() !== 'ai'"
        >
          <svg
            class="w-4 h-4"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            stroke-width="2"
          >
            <path
              stroke-linecap="round"
              stroke-linejoin="round"
              d="M12 3l1.5 4.5L18 9l-4.5 1.5L12 15l-1.5-4.5L6 9l4.5-1.5L12 3zM18 14l1 3 3 1-3 1-1 3-1-3-3-1 3-1 1-3z"
            />
          </svg>
          Pametna lista
        </button>
      </div>

      <!-- Person filter: Sve + per-member chips (only when multi-user) -->
      @if (isMultiUser()) {
        <div class="flex gap-2 mb-4 overflow-x-auto -mx-4 px-4 pb-1">
          <button
            (click)="shoppingService.filter.set('all')"
            [attr.aria-pressed]="shoppingService.filter() === 'all'"
            class="shrink-0 px-3 py-1.5 rounded-full text-xs font-medium transition-colors min-h-9"
            [class.bg-green-primary]="shoppingService.filter() === 'all'"
            [class.text-white]="shoppingService.filter() === 'all'"
            [class.bg-white]="shoppingService.filter() !== 'all'"
            [class.text-text-muted]="shoppingService.filter() !== 'all'"
          >
            Svi
          </button>
          @for (member of householdMembers(); track member.id) {
            <button
              (click)="shoppingService.filter.set(member.id)"
              [attr.aria-pressed]="shoppingService.filter() === member.id"
              class="shrink-0 px-3 py-1.5 rounded-full text-xs font-medium transition-colors min-h-9 border"
              [style.background-color]="
                shoppingService.filter() === member.id ? member.color : 'white'
              "
              [style.color]="shoppingService.filter() === member.id ? 'white' : member.color"
              [style.border-color]="member.color"
            >
              {{ member.name }}{{ member.id === currentUserId() ? ' (ja)' : '' }}
            </button>
          }
        </div>
      }

      <!-- Search -->
      <div class="relative mb-3">
        <svg
          class="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-text-muted pointer-events-none"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
          stroke-width="2"
        >
          <circle cx="11" cy="11" r="8" />
          <path d="m21 21-4.3-4.3" />
        </svg>
        <input
          type="search"
          [value]="shoppingService.search()"
          (input)="shoppingService.search.set(searchInput.value)"
          #searchInput
          placeholder="Pretraži sastojke..."
          class="w-full pl-9 pr-3 py-2 bg-white rounded-xl border border-border text-sm text-text-primary placeholder:text-text-muted focus:outline-none focus:ring-2 focus:ring-green-primary min-h-11"
        />
      </div>

      @if (shoppingService.viewMode() === 'ai') {
        <!-- AI summary view -->
        @if (shoppingService.aiError(); as error) {
          <div
            class="bg-red-50 border border-red-200 text-red-700 rounded-xl px-4 py-3 mb-3 text-sm"
            role="alert"
          >
            {{ error }}
          </div>
        }

        @if (shoppingService.aiLoading()) {
          <div class="flex items-center justify-center py-12 gap-2 text-text-muted">
            <svg class="w-5 h-5 animate-spin" fill="none" viewBox="0 0 24 24">
              <circle
                class="opacity-25"
                cx="12"
                cy="12"
                r="10"
                stroke="currentColor"
                stroke-width="4"
              />
              <path
                class="opacity-75"
                fill="currentColor"
                d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z"
              />
            </svg>
            <span class="text-sm">Generišem listu...</span>
          </div>
        } @else if (shoppingService.aiSummary() === null) {
          <div class="bg-white rounded-xl px-4 py-6 text-center">
            <p class="text-sm text-text-secondary mb-3">
              AI će spojiti slične sastojke, predložiti realne kupovne količine i grupisati ih po
              odeljenjima prodavnice.
            </p>
            <button
              (click)="shoppingService.loadAiSummary()"
              class="px-4 py-2 bg-orange-primary text-white rounded-full text-sm font-medium min-h-11"
            >
              Generiši AI listu
            </button>
          </div>
        } @else if (shoppingService.aiGroupedSummary().length === 0) {
          <p class="text-center text-text-muted py-8">Nema sastojaka za prikaz</p>
        } @else {
          <div class="flex justify-end mb-2">
            <button
              (click)="shoppingService.loadAiSummary()"
              class="text-xs text-text-muted underline min-h-9 px-2"
            >
              Osveži
            </button>
          </div>
          @for (group of shoppingService.aiGroupedSummary(); track group.category) {
            <h2 class="text-sm font-semibold text-text-muted uppercase tracking-wide mt-4 mb-2">
              {{ group.label }}
            </h2>
            <ul class="flex flex-col gap-1.5">
              @for (item of group.items; track item) {
                <li class="bg-white rounded-xl shadow-sm">
                  <label class="flex items-center gap-3 px-4 py-3 cursor-pointer">
                    <input
                      type="checkbox"
                      [checked]="shoppingService.aiChecked()[aiItemKey(item)]"
                      (change)="shoppingService.toggleAiChecked(aiItemKey(item))"
                      class="w-5 h-5 rounded accent-orange-primary shrink-0"
                    />
                    <div class="flex-1 min-w-0">
                      <span
                        [class.line-through]="shoppingService.aiChecked()[aiItemKey(item)]"
                        [class.text-text-muted]="shoppingService.aiChecked()[aiItemKey(item)]"
                        class="text-sm"
                      >
                        {{ formatAiItem(item) }}
                      </span>
                      @if (item.note) {
                        <div class="text-[11px] text-text-muted mt-0.5">{{ item.note }}</div>
                      }
                    </div>
                  </label>
                </li>
              }
            </ul>
          }
        }
      } @else if (shoppingService.groupedIngredients().length === 0) {
        <p class="text-center text-text-muted py-8">Nema sastojaka za prikaz</p>
      }

      @if (shoppingService.viewMode() === 'list') {
        @for (group of shoppingService.groupedIngredients(); track group.category) {
          <h2 class="text-sm font-semibold text-text-muted uppercase tracking-wide mt-4 mb-2">
            {{ group.label }}
          </h2>
          <ul class="flex flex-col gap-1.5">
            @for (ing of group.items; track ing.key) {
              <li class="bg-white rounded-xl shadow-sm">
                <div class="flex items-center gap-3 px-4 py-3">
                  <label class="flex items-center gap-3 flex-1 min-w-0 cursor-pointer">
                    <input
                      type="checkbox"
                      [checked]="shoppingService.checked()[ing.key]"
                      (change)="shoppingService.toggleChecked(ing.key)"
                      class="w-5 h-5 rounded accent-green-primary shrink-0"
                    />
                    <div class="flex-1 min-w-0">
                      <span
                        [class.line-through]="shoppingService.checked()[ing.key]"
                        [class.text-text-muted]="shoppingService.checked()[ing.key]"
                        class="text-sm"
                      >
                        {{ ing | quantity }}
                      </span>
                      @if (ing.variants.length > 1) {
                        <span class="text-[10px] text-text-muted ml-1"
                          >({{ ing.variants.join(', ') }})</span
                        >
                      }
                      @if (isMultiUser() && ing.sources.length > 0) {
                        <div class="flex gap-1 mt-0.5">
                          @for (source of uniqueSources(ing.sources); track source.userId) {
                            <span
                              class="text-[10px] px-1.5 py-0.5 rounded-full"
                              [style.background-color]="getMemberColor(source.userId) + '15'"
                              [style.color]="getMemberColor(source.userId)"
                            >
                              {{ source.userName }}
                            </span>
                          }
                        </div>
                      }
                    </div>
                  </label>
                  <app-assignment-badge
                    [assignedUserId]="shoppingService.assignments()[ing.key]"
                    (assign)="shoppingService.assignToUser(ing.key, $event)"
                  />
                </div>
              </li>
            }
          </ul>
        }
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

  readonly householdMembers = this.householdService.members;
  readonly currentUserId = this.householdService.currentUserId;
  readonly isMultiUser = computed(() => this.householdService.members().length > 1);

  toggleAiMode(): void {
    const next = this.shoppingService.viewMode() === 'ai' ? 'list' : 'ai';
    this.shoppingService.viewMode.set(next);
  }

  aiItemKey(item: ShoppingSummaryItem): string {
    return item.sourceKeys.length > 0 ? item.sourceKeys.join('|') : item.name;
  }

  formatAiItem(item: ShoppingSummaryItem): string {
    if (item.quantity == null) return item.name;
    return `${item.name} — ${item.quantity} ${item.unit}`;
  }

  uniqueSources(
    sources: { userId: string; userName: string }[],
  ): { userId: string; userName: string }[] {
    const seen = new Set<string>();
    return sources.filter((s) => {
      if (seen.has(s.userId)) return false;
      seen.add(s.userId);
      return true;
    });
  }

  getMemberColor(userId: string): string {
    const member = this.householdService.members().find((m) => m.id === userId);
    return member?.color ?? '#666';
  }
}
