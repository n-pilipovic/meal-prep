import { Component, input, output, inject, computed } from '@angular/core';
import { HouseholdService } from '../../core/services/household.service';
import { UserProfile } from '../../core/models/user.model';
import { UserAvatarComponent } from './user-avatar.component';

@Component({
  selector: 'app-assignment-badge',
  imports: [UserAvatarComponent],
  template: `
    @if (members().length > 1) {
      <div class="flex items-center gap-1">
        @if (assignedUser(); as user) {
          <button
            (click)="cycleAssignment()"
            [attr.aria-label]="'Dodeljeno: ' + user.name + '. Tapni za promenu.'"
            class="flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium min-h-11 min-w-11"
            [style.background-color]="user.color + '15'"
            [style.color]="user.color">
            <app-user-avatar [user]="user" size="sm" />
            {{ user.name }}
          </button>
        } @else {
          <button
            (click)="cycleAssignment()"
            aria-label="Dodeli osobu za pripremu"
            class="flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium text-text-muted bg-gray-100 min-h-11 min-w-11">
            Dodeli
          </button>
        }
      </div>
    }
  `,
})
export class AssignmentBadgeComponent {
  private readonly householdService = inject(HouseholdService);

  /** Currently assigned userId (null = unassigned) */
  readonly assignedUserId = input<string | null>(null);
  /** Emits the new userId to assign, or null to unassign */
  readonly assign = output<string | null>();

  readonly members = computed<UserProfile[]>(() => this.householdService.members());

  readonly assignedUser = computed<UserProfile | null>(() => {
    const uid = this.assignedUserId();
    if (!uid) return null;
    return this.members().find(m => m.id === uid) ?? null;
  });

  /** Cycle through: unassigned → user1 → user2 → ... → unassigned */
  cycleAssignment(): void {
    const allMembers = this.members();
    if (allMembers.length === 0) return;

    const currentId = this.assignedUserId();
    if (!currentId) {
      // Assign to first member
      this.assign.emit(allMembers[0].id);
    } else {
      const idx = allMembers.findIndex(m => m.id === currentId);
      if (idx < allMembers.length - 1) {
        // Next member
        this.assign.emit(allMembers[idx + 1].id);
      } else {
        // Back to unassigned
        this.assign.emit(null);
      }
    }
  }
}
