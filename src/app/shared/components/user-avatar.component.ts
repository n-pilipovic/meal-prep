import { Component, input } from '@angular/core';
import { UserProfile } from '../../core/models/user.model';

@Component({
  selector: 'app-user-avatar',
  template: `
    <span
      class="inline-flex items-center justify-center rounded-full font-semibold shrink-0 select-none"
      [class]="sizeClass()"
      [style.background-color]="user().color + '20'"
      [style.color]="user().color">
      {{ initials() }}
    </span>
  `,
})
export class UserAvatarComponent {
  readonly user = input.required<UserProfile>();
  readonly size = input<'sm' | 'md' | 'lg'>('md');

  initials(): string {
    const name = this.user().name;
    return name.substring(0, 2).toUpperCase();
  }

  sizeClass(): string {
    const sizes = {
      sm: 'w-7 h-7 text-xs',
      md: 'w-9 h-9 text-sm',
      lg: 'w-12 h-12 text-base',
    };
    return sizes[this.size()];
  }
}
