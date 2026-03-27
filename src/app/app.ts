import { Component, inject } from '@angular/core';
import { Router, RouterOutlet } from '@angular/router';
import { BottomNavComponent } from './shared/components/bottom-nav.component';

@Component({
  selector: 'app-root',
  imports: [RouterOutlet, BottomNavComponent],
  template: `
    <main [class.pb-20]="showNav()">
      <router-outlet />
    </main>
    @if (showNav()) {
      <app-bottom-nav />
    }
  `,
  styles: `
    :host {
      display: block;
      min-height: 100vh;
    }
  `,
})
export class App {
  private readonly router = inject(Router);

  showNav(): boolean {
    return !this.router.url.startsWith('/welcome');
  }
}
