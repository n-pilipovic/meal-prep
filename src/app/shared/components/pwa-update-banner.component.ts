import { Component, inject } from '@angular/core';
import { PwaUpdateService } from '../../core/services/pwa-update.service';

@Component({
  selector: 'app-pwa-update-banner',
  template: `
    @if (updateService.updateAvailable()) {
      <div
        class="fixed top-0 left-0 right-0 z-50 flex items-center justify-between gap-3 bg-green-primary px-4 pb-3 text-white shadow-lg pt-[calc(env(safe-area-inset-top)+0.75rem)]"
        role="alert"
      >
        <span class="text-sm font-medium">Nova verzija je dostupna!</span>
        <button
          (click)="updateService.reload()"
          class="shrink-0 rounded-lg bg-white px-4 py-2 text-sm font-semibold text-green-primary active:bg-cream-dark"
        >
          Ažuriraj
        </button>
      </div>
    }
  `,
})
export class PwaUpdateBannerComponent {
  readonly updateService = inject(PwaUpdateService);
}
