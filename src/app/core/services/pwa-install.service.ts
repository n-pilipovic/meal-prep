import { Injectable, signal, computed } from '@angular/core';

@Injectable({ providedIn: 'root' })
export class PwaInstallService {
  private readonly deferredPrompt = signal<Event | null>(null);

  readonly canInstall = computed(() => !!this.deferredPrompt());
  readonly isStandalone = signal(this.checkStandalone());

  constructor() {
    if (typeof window === 'undefined') return;

    window.addEventListener('beforeinstallprompt', (e: Event) => {
      e.preventDefault();
      this.deferredPrompt.set(e);
    });

    window.addEventListener('appinstalled', () => {
      this.deferredPrompt.set(null);
      this.isStandalone.set(true);
    });
  }

  async promptInstall(): Promise<'accepted' | 'dismissed'> {
    const prompt = this.deferredPrompt() as any;
    if (!prompt) return 'dismissed';

    prompt.prompt();
    const result = await prompt.userChoice;
    this.deferredPrompt.set(null);
    return result.outcome;
  }

  private checkStandalone(): boolean {
    if (typeof window === 'undefined') return false;
    return (
      window.matchMedia('(display-mode: standalone)').matches ||
      (navigator as any).standalone === true
    );
  }
}
