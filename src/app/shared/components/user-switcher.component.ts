import { Component, inject, input, output, computed } from '@angular/core';
import { HouseholdService } from '../../core/services/household.service';
import { UserProfile } from '../../core/models/user.model';
import { UserAvatarComponent } from './user-avatar.component';

@Component({
  selector: 'app-user-switcher',
  imports: [UserAvatarComponent],
  template: `
    @if (members().length > 1) {
      <div class="flex gap-2 px-4 py-2 overflow-x-auto" role="group" aria-label="Izbor korisnika">
        @for (member of members(); track member.id) {
          <button
            (click)="selectUser.emit(member.id)"
            [attr.aria-pressed]="selectedUserId() === member.id"
            class="flex items-center gap-2 px-3 py-1.5 rounded-full transition-all min-h-11 shrink-0"
            [class.bg-white]="selectedUserId() === member.id"
            [class.shadow-sm]="selectedUserId() === member.id"
            [class.ring-2]="selectedUserId() === member.id"
            [style.--tw-ring-color]="selectedUserId() === member.id ? member.color : 'transparent'">
            <app-user-avatar [user]="member" size="sm" />
            <span class="text-sm font-medium"
                  [style.color]="selectedUserId() === member.id ? member.color : ''">
              {{ member.name }}
            </span>
            @if (isCurrentUser(member.id)) {
              <span class="text-[10px] text-text-muted">(ti)</span>
            }
          </button>
        }
      </div>
    }
  `,
})
export class UserSwitcherComponent {
  private readonly householdService = inject(HouseholdService);

  readonly selectedUserId = input.required<string>();
  readonly selectUser = output<string>();

  readonly members = computed<UserProfile[]>(() => {
    return this.householdService.members();
  });

  isCurrentUser(id: string): boolean {
    return id === this.householdService.currentUserId();
  }
}
