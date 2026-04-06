import { Component, input, signal } from '@angular/core';
import { UserProfile } from '../../core/models/user.model';

@Component({
  selector: 'app-user-avatar',
  template: `
    <span
      class="inline-flex items-center justify-center rounded-full font-semibold shrink-0 select-none overflow-hidden"
      [class]="sizeClass()"
      [style.background-color]="user().color + '20'"
      [style.color]="user().color">
      @if (user().avatar && !imgError()) {
        <img
          [src]="user().avatar"
          [alt]="user().name"
          referrerpolicy="no-referrer"
          class="w-full h-full object-cover"
          (error)="imgError.set(true)" />
      } @else {
        {{ initials() }}
      }
    </span>
  `,
})
export class UserAvatarComponent {
  readonly user = input.required<UserProfile>();
  readonly size = input<'sm' | 'md' | 'lg'>('md');
  readonly imgError = signal(false);

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
