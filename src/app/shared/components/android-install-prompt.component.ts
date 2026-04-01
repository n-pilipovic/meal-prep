import { Component, inject, signal } from '@angular/core';
import { PwaInstallService } from '../../core/services/pwa-install.service';

const DISMISSED_KEY = 'meal-prep:android-install-dismissed';

@Component({
  selector: 'app-android-install-prompt',
  template: `
    @if (visible()) {
      <div
        class="fixed inset-0 bg-black/50 z-[100] flex items-end justify-center"
        role="dialog"
        aria-labelledby="android-install-title"
        (click)="dismiss()">
        <div
          class="bg-white rounded-t-3xl w-full max-w-md p-6 pb-10 animate-slide-up"
          (click)="$event.stopPropagation()">
          <div class="flex items-center justify-between mb-4">
            <h2 id="android-install-title" class="text-lg font-bold text-text-primary">
              Instaliraj aplikaciju
            </h2>
            <button
              (click)="dismiss()"
              aria-label="Zatvori"
              class="text-text-muted text-2xl leading-none min-w-11 min-h-11 flex items-center justify-center">
              <span aria-hidden="true">&times;</span>
            </button>
          </div>

          <p class="text-sm text-text-secondary mb-5">
            Dodaj na početni ekran za brži pristup, obaveštenja i offline rad.
          </p>

          <div class="flex flex-col gap-3">
            <button
              (click)="install()"
              class="w-full py-3 bg-green-primary text-white font-semibold rounded-xl min-h-[48px] active:scale-[0.98] transition-transform">
              Instaliraj
            </button>
            <button
              (click)="dismiss()"
              class="w-full py-3 text-text-muted font-medium rounded-xl min-h-[48px]">
              Ne sada
            </button>
          </div>
        </div>
      </div>
    }
  `,
  styles: `
    @keyframes slide-up {
      from {
        transform: translateY(100%);
      }
      to {
        transform: translateY(0);
      }
    }
    .animate-slide-up {
      animation: slide-up 0.3s ease-out;
    }
  `,
})
export class AndroidInstallPromptComponent {
  private readonly pwaInstall = inject(PwaInstallService);

  readonly visible = signal(false);

  constructor() {
    if (typeof window === 'undefined') return;
    if (localStorage.getItem(DISMISSED_KEY)) return;

    // Show after a short delay once the install prompt is available
    const check = setInterval(() => {
      if (this.pwaInstall.canInstall()) {
        clearInterval(check);
        setTimeout(() => this.visible.set(true), 3000);
      }
    }, 500);

    // Stop checking after 30 seconds
    setTimeout(() => clearInterval(check), 30_000);
  }

  async install(): Promise<void> {
    const outcome = await this.pwaInstall.promptInstall();
    if (outcome === 'accepted') {
      this.visible.set(false);
    }
  }

  dismiss(): void {
    this.visible.set(false);
    localStorage.setItem(DISMISSED_KEY, 'true');
  }
}
