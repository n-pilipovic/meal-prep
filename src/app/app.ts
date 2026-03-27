import { Component, inject } from '@angular/core';
import { Router, RouterOutlet } from '@angular/router';
import { BottomNavComponent } from './shared/components/bottom-nav.component';
import { IosInstallPromptComponent } from './shared/components/ios-install-prompt.component';

@Component({
  selector: 'app-root',
  imports: [RouterOutlet, BottomNavComponent, IosInstallPromptComponent],
  template: `
    <main [class.pb-20]="showNav()">
      <router-outlet />
    </main>
    @if (showNav()) {
      <app-bottom-nav />
    }
    <app-ios-install-prompt />
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
