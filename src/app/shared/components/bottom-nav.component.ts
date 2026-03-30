import { Component, inject } from '@angular/core';
import { Router, RouterLink, RouterLinkActive } from '@angular/router';

@Component({
  selector: 'app-bottom-nav',
  imports: [RouterLink, RouterLinkActive],
  template: `
    <nav aria-label="Glavna navigacija"
         class="fixed bottom-0 left-0 right-0 bg-white border-t border-border flex justify-around items-start pt-2 z-50"
         style="padding-bottom: env(safe-area-inset-bottom)">
      @for (item of navItems; track item.route) {
        <a [routerLink]="item.route"
           routerLinkActive="text-green-primary"
           [routerLinkActiveOptions]="{ exact: item.exact }"
           [attr.aria-current]="isActive(item.route, item.exact) ? 'page' : null"
           class="flex flex-col items-center justify-center gap-0.5 min-w-[60px] min-h-[44px] text-text-muted transition-colors active:scale-95">
          <span class="text-xl leading-none" aria-hidden="true">{{ item.icon }}</span>
          <span class="text-[10px] font-medium">{{ item.label }}</span>
        </a>
      }
    </nav>
  `,
})
export class BottomNavComponent {
  private readonly router = inject(Router);

  readonly navItems = [
    { route: '/today', label: 'Danas', icon: '📅', exact: false },
    { route: '/week', label: 'Nedelja', icon: '📋', exact: true },
    { route: '/shopping', label: 'Kupovina', icon: '🛒', exact: true },
    { route: '/settings', label: 'Podešavanja', icon: '⚙️', exact: true },
  ];

  isActive(route: string, exact: boolean): boolean {
    return exact
      ? this.router.url === route
      : this.router.url.startsWith(route.replace('/today', '/'));
  }
}
