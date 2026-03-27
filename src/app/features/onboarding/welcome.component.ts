import { Component, inject, signal } from '@angular/core';
import { Router } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { HouseholdService } from '../../core/services/household.service';

type Mode = 'choice' | 'create' | 'join';

@Component({
  selector: 'app-welcome',
  imports: [FormsModule],
  template: `
    <div class="min-h-screen flex flex-col items-center justify-center px-6 bg-cream">
      <div class="w-full max-w-sm">
        <div class="text-center mb-8">
          <span class="text-5xl mb-3 block">🍽️</span>
          <h1 class="text-2xl font-bold text-text-primary">Priprema Obroka</h1>
          <p class="text-sm text-text-secondary mt-1">Planiraj, pripremi, podeli</p>
        </div>

        @switch (mode()) {
          @case ('choice') {
            <div class="flex flex-col gap-3">
              <button
                (click)="mode.set('create')"
                class="w-full py-4 bg-green-primary text-white font-semibold rounded-2xl active:scale-[0.98] transition-transform min-h-[52px]">
                Kreiraj domaćinstvo
              </button>
              <button
                (click)="mode.set('join')"
                class="w-full py-4 bg-white text-green-primary font-semibold rounded-2xl border-2 border-green-primary active:scale-[0.98] transition-transform min-h-[52px]">
                Pridruži se
              </button>
              <button
                (click)="skipOnboarding()"
                class="w-full py-3 text-text-muted text-sm active:opacity-70 min-h-[44px]">
                Nastavi bez naloga
              </button>
            </div>
          }

          @case ('create') {
            <div class="flex flex-col gap-4">
              <button (click)="mode.set('choice')" class="text-green-primary font-medium text-sm active:opacity-70 self-start min-h-[44px]">
                ‹ Nazad
              </button>
              <h2 class="text-lg font-semibold text-text-primary">Kreiraj domaćinstvo</h2>
              <input
                type="text"
                [(ngModel)]="name"
                placeholder="Tvoje ime"
                class="w-full px-4 py-3 bg-white rounded-xl border border-border text-text-primary placeholder:text-text-muted focus:outline-none focus:ring-2 focus:ring-green-primary min-h-[48px]" />
              <button
                (click)="create()"
                [disabled]="!name().trim()"
                class="w-full py-4 bg-green-primary text-white font-semibold rounded-2xl active:scale-[0.98] transition-transform disabled:opacity-40 min-h-[52px]">
                Kreiraj
              </button>

              @if (error()) {
                <p class="text-red-500 text-sm text-center">{{ error() }}</p>
              }
            </div>
          }

          @case ('join') {
            <div class="flex flex-col gap-4">
              <button (click)="mode.set('choice')" class="text-green-primary font-medium text-sm active:opacity-70 self-start min-h-[44px]">
                ‹ Nazad
              </button>
              <h2 class="text-lg font-semibold text-text-primary">Pridruži se domaćinstvu</h2>
              <input
                type="text"
                [(ngModel)]="joinCode"
                placeholder="Kod domaćinstva"
                maxlength="6"
                class="w-full px-4 py-3 bg-white rounded-xl border border-border text-text-primary placeholder:text-text-muted focus:outline-none focus:ring-2 focus:ring-green-primary uppercase tracking-widest text-center text-lg font-mono min-h-[48px]" />
              <input
                type="text"
                [(ngModel)]="name"
                placeholder="Tvoje ime"
                class="w-full px-4 py-3 bg-white rounded-xl border border-border text-text-primary placeholder:text-text-muted focus:outline-none focus:ring-2 focus:ring-green-primary min-h-[48px]" />
              <button
                (click)="join()"
                [disabled]="!name().trim() || joinCode().length < 6"
                class="w-full py-4 bg-green-primary text-white font-semibold rounded-2xl active:scale-[0.98] transition-transform disabled:opacity-40 min-h-[52px]">
                Pridruži se
              </button>

              @if (error()) {
                <p class="text-red-500 text-sm text-center">{{ error() }}</p>
              }
            </div>
          }
        }
      </div>
    </div>
  `,
})
export class WelcomeComponent {
  private readonly householdService = inject(HouseholdService);
  private readonly router = inject(Router);

  readonly mode = signal<Mode>('choice');
  readonly name = signal('');
  readonly joinCode = signal('');
  readonly error = signal('');

  create(): void {
    const n = this.name().trim();
    if (!n) return;

    this.error.set('');
    this.householdService.createHousehold(n);

    // Watch for login state to navigate
    const check = setInterval(() => {
      if (this.householdService.isLoggedIn()) {
        clearInterval(check);
        this.router.navigate(['/today']);
      }
    }, 100);

    // Timeout after 10s
    setTimeout(() => {
      clearInterval(check);
      if (!this.householdService.isLoggedIn()) {
        this.error.set('Greška pri kreiranju. Proverite konekciju.');
      }
    }, 10_000);
  }

  join(): void {
    const n = this.name().trim();
    const code = this.joinCode().trim().toUpperCase();
    if (!n || code.length < 6) return;

    this.error.set('');
    this.householdService.joinHousehold(code, n);

    const check = setInterval(() => {
      if (this.householdService.isLoggedIn()) {
        clearInterval(check);
        this.router.navigate(['/today']);
      }
    }, 100);

    setTimeout(() => {
      clearInterval(check);
      if (!this.householdService.isLoggedIn()) {
        this.error.set('Kod nije pronađen ili greška pri povezivanju.');
      }
    }, 10_000);
  }

  skipOnboarding(): void {
    localStorage.setItem('meal-prep:skipped-onboarding', 'true');
    this.router.navigate(['/today']);
  }
}
