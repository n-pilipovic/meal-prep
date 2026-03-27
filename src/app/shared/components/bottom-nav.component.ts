import { Component } from '@angular/core';
import { RouterLink, RouterLinkActive } from '@angular/router';

@Component({
  selector: 'app-bottom-nav',
  imports: [RouterLink, RouterLinkActive],
  template: `
    <nav class="fixed bottom-0 left-0 right-0 bg-white border-t border-border flex justify-around items-center h-16 z-50"
         style="padding-bottom: env(safe-area-inset-bottom)">
      @for (item of navItems; track item.route) {
        <a [routerLink]="item.route"
           routerLinkActive="text-green-primary"
           [routerLinkActiveOptions]="{ exact: item.exact }"
           class="flex flex-col items-center justify-center gap-0.5 min-w-[60px] min-h-[44px] text-text-muted transition-colors active:scale-95">
          <span class="text-xl leading-none">{{ item.icon }}</span>
          <span class="text-[10px] font-medium">{{ item.label }}</span>
        </a>
      }
    </nav>
  `,
})
export class BottomNavComponent {
  readonly navItems = [
    { route: '/today', label: 'Danas', icon: '📅', exact: false },
    { route: '/week', label: 'Nedelja', icon: '📋', exact: true },
    { route: '/shopping', label: 'Kupovina', icon: '🛒', exact: true },
    { route: '/settings', label: 'Podešavanja', icon: '⚙️', exact: true },
  ];
}
