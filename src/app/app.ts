import { Component, inject, DestroyRef } from '@angular/core';
import { Router, RouterOutlet, NavigationEnd } from '@angular/router';
import { filter } from 'rxjs';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { BottomNavComponent } from './shared/components/bottom-nav.component';
import { IosInstallPromptComponent } from './shared/components/ios-install-prompt.component';
import { AndroidInstallPromptComponent } from './shared/components/android-install-prompt.component';
import { PwaUpdateBannerComponent } from './shared/components/pwa-update-banner.component';

@Component({
  selector: 'app-root',
  imports: [RouterOutlet, BottomNavComponent, IosInstallPromptComponent, AndroidInstallPromptComponent, PwaUpdateBannerComponent],
  template: `
    <app-pwa-update-banner />
    <main id="main-content" tabindex="-1" [class.pb-20]="showNav()">
      <router-outlet />
    </main>
    @if (showNav()) {
      <app-bottom-nav />
    }
    <app-ios-install-prompt />
    <app-android-install-prompt />
  `,
  styles: `
    :host {
      display: block;
      min-height: 100vh;
    }
    #main-content:focus {
      outline: none;
    }
  `,
})
export class App {
  private readonly router = inject(Router);
  private readonly destroyRef = inject(DestroyRef);

  constructor() {
    this.router.events
      .pipe(
        filter(e => e instanceof NavigationEnd),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe(() => {
        const main = document.getElementById('main-content');
        main?.focus({ preventScroll: false });
      });
  }

  showNav(): boolean {
    return !this.router.url.startsWith('/welcome');
  }
}
