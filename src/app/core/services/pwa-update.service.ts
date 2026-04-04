import { Injectable, inject, signal } from '@angular/core';
import { SwUpdate, VersionReadyEvent } from '@angular/service-worker';
import { filter } from 'rxjs';

@Injectable({ providedIn: 'root' })
export class PwaUpdateService {
  private readonly swUpdate = inject(SwUpdate);

  readonly updateAvailable = signal(false);

  constructor() {
    if (!this.swUpdate.isEnabled) return;

    this.swUpdate.versionUpdates
      .pipe(filter((e): e is VersionReadyEvent => e.type === 'VERSION_READY'))
      .subscribe(() => this.updateAvailable.set(true));

    // Check immediately on startup (after SW registers)
    this.swUpdate.checkForUpdate();

    // Check when the app returns to foreground (critical for iOS)
    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'visible') {
        this.swUpdate.checkForUpdate();
      }
    });

    // Also check periodically every 5 minutes
    setInterval(() => this.swUpdate.checkForUpdate(), 5 * 60 * 1000);
  }

  reload(): void {
    document.location.reload();
  }
}
