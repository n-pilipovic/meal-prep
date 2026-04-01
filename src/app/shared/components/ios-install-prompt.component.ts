import { Component, inject, signal } from '@angular/core';
import { NotificationService } from '../../core/services/notification.service';
import { PwaInstallService } from '../../core/services/pwa-install.service';

const DISMISSED_KEY = 'meal-prep:ios-install-dismissed';

@Component({
  selector: 'app-ios-install-prompt',
  template: `
    @if (visible()) {
      <div class="fixed inset-0 bg-black/50 z-[100] flex items-end justify-center"
           role="dialog"
           aria-labelledby="ios-install-title"
           (click)="dismiss()">
        <div class="bg-white rounded-t-3xl w-full max-w-md p-6 pb-10 animate-slide-up"
             (click)="$event.stopPropagation()">
          <div class="flex items-center justify-between mb-4">
            <h2 id="ios-install-title" class="text-lg font-bold text-text-primary">Instaliraj aplikaciju</h2>
            <button (click)="dismiss()"
                    aria-label="Zatvori"
                    class="text-text-muted text-2xl leading-none min-w-11 min-h-11 flex items-center justify-center">
              <span aria-hidden="true">×</span>
            </button>
          </div>

          <p class="text-sm text-text-secondary mb-5">
            Za najbolje iskustvo i obaveštenja, dodaj aplikaciju na početni ekran:
          </p>

          <ol class="space-y-4 mb-6">
            <li class="flex items-start gap-3">
              <span class="flex-shrink-0 w-8 h-8 bg-green-primary text-white rounded-full flex items-center justify-center text-sm font-bold">1</span>
              <div>
                <p class="text-sm font-medium text-text-primary">Tapni na dugme za deljenje</p>
                <p class="text-xs text-text-secondary mt-0.5">
                  U Safari-ju, tapni na <span class="inline-block text-base leading-none align-middle">⬆️</span> ikonu na dnu ekrana
                </p>
              </div>
            </li>
            <li class="flex items-start gap-3">
              <span class="flex-shrink-0 w-8 h-8 bg-green-primary text-white rounded-full flex items-center justify-center text-sm font-bold">2</span>
              <div>
                <p class="text-sm font-medium text-text-primary">Izaberi "Add to Home Screen"</p>
                <p class="text-xs text-text-secondary mt-0.5">Skroluj dole u meniju ako ne vidiš opciju</p>
              </div>
            </li>
            <li class="flex items-start gap-3">
              <span class="flex-shrink-0 w-8 h-8 bg-green-primary text-white rounded-full flex items-center justify-center text-sm font-bold">3</span>
              <div>
                <p class="text-sm font-medium text-text-primary">Tapni "Add"</p>
                <p class="text-xs text-text-secondary mt-0.5">Aplikacija će se pojaviti na početnom ekranu</p>
              </div>
            </li>
          </ol>

          <button (click)="dismiss()"
                  class="w-full py-3 bg-green-primary text-white font-semibold rounded-xl min-h-[48px] active:scale-[0.98] transition-transform">
            Razumem
          </button>
        </div>
      </div>
    }
  `,
  styles: `
    @keyframes slide-up {
      from { transform: translateY(100%); }
      to { transform: translateY(0); }
    }
    .animate-slide-up {
      animation: slide-up 0.3s ease-out;
    }
  `,
})
export class IosInstallPromptComponent {
  private readonly notificationService = inject(NotificationService);
  private readonly pwaInstall = inject(PwaInstallService);

  readonly visible = signal(this.shouldShow());

  dismiss(): void {
    this.visible.set(false);
    localStorage.setItem(DISMISSED_KEY, 'true');
  }

  private shouldShow(): boolean {
    if (typeof window === 'undefined') return false;
    if (localStorage.getItem(DISMISSED_KEY)) return false;
    return this.notificationService.isIOS() && !this.pwaInstall.isStandalone();
  }
}
