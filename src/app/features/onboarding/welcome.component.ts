import { Component, inject, signal, effect } from '@angular/core';
import { Router } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { AuthService } from '../../core/services/auth.service';
import { HouseholdService } from '../../core/services/household.service';

type Mode = 'choice' | 'create' | 'join';
type AuthMode = 'initial' | 'login' | 'register';

@Component({
  selector: 'app-welcome',
  imports: [FormsModule],
  template: `
    <div class="min-h-screen flex flex-col items-center justify-center px-6 bg-cream">
      <div class="w-full max-w-sm">
        <div class="text-center mb-8">
          <span class="text-5xl mb-3 block" aria-hidden="true">🍽️</span>
          <h1 class="text-2xl font-bold text-text-primary">Priprema Obroka</h1>
          <p class="text-sm text-text-secondary mt-1">Planiraj, pripremi, podeli</p>
        </div>

        @if (!auth.isLoggedIn()) {
          <!-- Step 1: Sign in -->
          @switch (authMode()) {
            @case ('initial') {
              <div class="flex flex-col gap-3">
                <button
                  (click)="signInWithGoogle()"
                  [disabled]="loading()"
                  class="w-full py-4 bg-white text-text-primary font-semibold rounded-2xl border border-border active:scale-[0.98] transition-transform flex items-center justify-center gap-3 min-h-13 disabled:opacity-50">
                  <svg viewBox="0 0 24 24" class="w-5 h-5" xmlns="http://www.w3.org/2000/svg">
                    <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z" fill="#4285F4"/>
                    <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
                    <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/>
                    <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
                  </svg>
                  Prijavi se sa Google nalogom
                </button>

                <button
                  (click)="authMode.set('login')"
                  class="w-full py-4 bg-white text-text-primary font-semibold rounded-2xl border border-border active:scale-[0.98] transition-transform flex items-center justify-center gap-3 min-h-13">
                  Prijavi se sa email-om
                </button>

                <button
                  (click)="skipOnboarding()"
                  class="w-full py-3 text-text-muted text-sm active:opacity-70 min-h-11">
                  Nastavi bez naloga
                </button>
              </div>
            }

            @case ('login') {
              <div class="flex flex-col gap-4">
                <button (click)="authMode.set('initial')" class="text-green-primary font-medium text-sm active:opacity-70 self-start min-h-11">
                  ‹ Nazad
                </button>
                <h2 class="text-lg font-semibold text-text-primary">Prijava</h2>
                <label>
                  <span class="sr-only">Email adresa</span>
                  <input
                    type="email"
                    [(ngModel)]="emailInput"
                    placeholder="Email adresa"
                    autocomplete="email"
                    class="w-full px-4 py-3 bg-white rounded-xl border border-border text-text-primary placeholder:text-text-muted focus:outline-none focus:ring-2 focus:ring-green-primary min-h-12" />
                </label>
                <label>
                  <span class="sr-only">Lozinka</span>
                  <input
                    type="password"
                    [(ngModel)]="passwordInput"
                    placeholder="Lozinka"
                    autocomplete="current-password"
                    class="w-full px-4 py-3 bg-white rounded-xl border border-border text-text-primary placeholder:text-text-muted focus:outline-none focus:ring-2 focus:ring-green-primary min-h-12" />
                </label>
                <button
                  (click)="signInWithEmail()"
                  [disabled]="!emailInput().trim() || passwordInput().length < 6 || loading()"
                  class="w-full py-4 bg-green-primary text-white font-semibold rounded-2xl active:scale-[0.98] transition-transform disabled:opacity-40 min-h-13">
                  Prijavi se
                </button>
                <button
                  (click)="authMode.set('register')"
                  class="text-green-primary text-sm font-medium active:opacity-70 min-h-11">
                  Nemaš nalog? Registruj se
                </button>
              </div>
            }

            @case ('register') {
              <div class="flex flex-col gap-4">
                <button (click)="authMode.set('login')" class="text-green-primary font-medium text-sm active:opacity-70 self-start min-h-11">
                  ‹ Nazad
                </button>
                <h2 class="text-lg font-semibold text-text-primary">Registracija</h2>
                <label>
                  <span class="sr-only">Tvoje ime</span>
                  <input
                    type="text"
                    [(ngModel)]="nameInput"
                    placeholder="Tvoje ime"
                    autocomplete="name"
                    class="w-full px-4 py-3 bg-white rounded-xl border border-border text-text-primary placeholder:text-text-muted focus:outline-none focus:ring-2 focus:ring-green-primary min-h-12" />
                </label>
                <label>
                  <span class="sr-only">Email adresa</span>
                  <input
                    type="email"
                    [(ngModel)]="emailInput"
                    placeholder="Email adresa"
                    autocomplete="email"
                    class="w-full px-4 py-3 bg-white rounded-xl border border-border text-text-primary placeholder:text-text-muted focus:outline-none focus:ring-2 focus:ring-green-primary min-h-12" />
                </label>
                <label>
                  <span class="sr-only">Lozinka (min. 6 karaktera)</span>
                  <input
                    type="password"
                    [(ngModel)]="passwordInput"
                    placeholder="Lozinka (min. 6 karaktera)"
                    autocomplete="new-password"
                    class="w-full px-4 py-3 bg-white rounded-xl border border-border text-text-primary placeholder:text-text-muted focus:outline-none focus:ring-2 focus:ring-green-primary min-h-12" />
                </label>
                <button
                  (click)="registerWithEmail()"
                  [disabled]="!nameInput().trim() || !emailInput().trim() || passwordInput().length < 6 || loading()"
                  class="w-full py-4 bg-green-primary text-white font-semibold rounded-2xl active:scale-[0.98] transition-transform disabled:opacity-40 min-h-13">
                  Registruj se
                </button>

                @if (error()) {
                  <p role="alert" class="text-red-500 text-sm text-center">{{ error() }}</p>
                }
              </div>
            }
          }

        } @else if (!householdService.sessionReady()) {
          <!-- Session restoring — wait before showing household options -->
          <div class="flex flex-col items-center gap-3 py-8">
            <div class="w-8 h-8 border-3 border-green-primary border-t-transparent rounded-full animate-spin"></div>
            <p class="text-sm text-text-secondary">Učitavanje...</p>
          </div>
        } @else {
          <!-- Step 2: Create or join household -->
          @switch (mode()) {
            @case ('choice') {
              <div class="flex flex-col gap-3">
                <div class="flex items-center gap-3 bg-white rounded-2xl p-4 mb-2">
                  @if (auth.photoURL()) {
                    <img [src]="auth.photoURL()" class="w-10 h-10 rounded-full" alt="" />
                  }
                  <div>
                    <p class="font-semibold text-text-primary">{{ auth.displayName() }}</p>
                    <p class="text-xs text-text-muted">{{ auth.email() }}</p>
                  </div>
                </div>

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
              </div>
            }

            @case ('create') {
              <div class="flex flex-col gap-4">
                <button (click)="mode.set('choice')" class="text-green-primary font-medium text-sm active:opacity-70 self-start min-h-[44px]">
                  ‹ Nazad
                </button>
                <h2 class="text-lg font-semibold text-text-primary">Kreiraj domaćinstvo</h2>
                <div class="flex items-center gap-3 bg-cream-light rounded-xl p-3">
                  @if (auth.photoURL()) {
                    <img [src]="auth.photoURL()" class="w-8 h-8 rounded-full" alt="" />
                  }
                  <span class="text-sm text-text-secondary">{{ auth.displayName() }}</span>
                </div>
                <button
                  (click)="create()"
                  [disabled]="loading()"
                  class="w-full py-4 bg-green-primary text-white font-semibold rounded-2xl active:scale-[0.98] transition-transform disabled:opacity-40 min-h-[52px]">
                  Kreiraj
                </button>

                @if (error()) {
                  <p role="alert" class="text-red-500 text-sm text-center">{{ error() }}</p>
                }
              </div>
            }

            @case ('join') {
              <div class="flex flex-col gap-4">
                <button (click)="mode.set('choice')" class="text-green-primary font-medium text-sm active:opacity-70 self-start min-h-[44px]">
                  ‹ Nazad
                </button>
                <h2 class="text-lg font-semibold text-text-primary">Pridruži se domaćinstvu</h2>
                <label>
                  <span class="sr-only">Kod domaćinstva</span>
                  <input
                    type="text"
                    [(ngModel)]="joinCode"
                    placeholder="Kod domaćinstva"
                    maxlength="6"
                    autocomplete="off"
                    class="w-full px-4 py-3 bg-white rounded-xl border border-border text-text-primary placeholder:text-text-muted focus:outline-none focus:ring-2 focus:ring-green-primary uppercase tracking-widest text-center text-lg font-mono min-h-[48px]" />
                </label>
                <button
                  (click)="join()"
                  [disabled]="joinCode().length < 6 || loading()"
                  class="w-full py-4 bg-green-primary text-white font-semibold rounded-2xl active:scale-[0.98] transition-transform disabled:opacity-40 min-h-[52px]">
                  Pridruži se
                </button>

                @if (error()) {
                  <p role="alert" class="text-red-500 text-sm text-center">{{ error() }}</p>
                }
              </div>
            }
          }
        }

      </div>
    </div>
  `,
})
export class WelcomeComponent {
  readonly auth = inject(AuthService);
  readonly householdService = inject(HouseholdService);
  private readonly router = inject(Router);

  constructor() {
    // If the user already has a household (returning user), redirect away
    effect(() => {
      if (this.householdService.isLoggedIn()) {
        this.router.navigate(['/today']);
      }
    });
  }

  readonly authMode = signal<AuthMode>('initial');
  readonly mode = signal<Mode>('choice');
  readonly joinCode = signal('');
  readonly emailInput = signal('');
  readonly passwordInput = signal('');
  readonly nameInput = signal('');
  readonly error = signal('');
  readonly loading = signal(false);

  async signInWithGoogle(): Promise<void> {
    this.loading.set(true);
    this.error.set('');
    try {
      await this.auth.signInWithGoogle();
    } catch (err: any) {
      if (err.code !== 'auth/popup-closed-by-user') {
        this.error.set('Greška pri prijavi. Pokušajte ponovo.');
      }
    } finally {
      this.loading.set(false);
    }
  }

  async signInWithEmail(): Promise<void> {
    this.loading.set(true);
    this.error.set('');
    try {
      await this.auth.signInWithEmail(this.emailInput().trim(), this.passwordInput());
    } catch (err: any) {
      const code = err.code ?? '';
      let msg: string;
      if (code === 'auth/invalid-credential' || code === 'auth/invalid-login-credentials') {
        msg = 'Pogrešan email ili lozinka.';
      } else if (code === 'auth/user-not-found') {
        msg = 'Nalog ne postoji. Registrujte se.';
      } else if (code === 'auth/invalid-email') {
        msg = 'Neispravna email adresa.';
      } else {
        msg = 'Greška pri prijavi. Pokušajte ponovo.';
      }
      this.error.set(msg);
    } finally {
      this.loading.set(false);
    }
  }

  async registerWithEmail(): Promise<void> {
    this.loading.set(true);
    this.error.set('');
    try {
      await this.auth.registerWithEmail(
        this.emailInput().trim(),
        this.passwordInput(),
        this.nameInput().trim(),
      );
    } catch (err: any) {
      const code = err.code ?? '';
      let msg: string;
      if (code === 'auth/email-already-in-use') {
        msg = 'Email je već registrovan. Prijavite se.';
      } else if (code === 'auth/weak-password') {
        msg = 'Lozinka mora imati najmanje 6 karaktera.';
      } else if (code === 'auth/invalid-email') {
        msg = 'Neispravna email adresa.';
      } else if (code === 'auth/invalid-login-credentials' || code === 'auth/invalid-credential') {
        msg = 'Neispravni podaci za prijavu. Proverite email i lozinku.';
      } else {
        msg = 'Greška pri registraciji. Pokušajte ponovo.';
      }
      this.error.set(msg);
    } finally {
      this.loading.set(false);
    }
  }

  create(): void {
    const name = this.auth.displayName() ?? 'Korisnik';
    this.error.set('');
    this.loading.set(true);
    this.householdService.createHousehold(name, this.auth.photoURL());
    this.waitForLogin();
  }

  join(): void {
    const code = this.joinCode().trim().toUpperCase();
    if (code.length < 6) return;

    const name = this.auth.displayName() ?? 'Korisnik';
    this.error.set('');
    this.loading.set(true);
    this.householdService.joinHousehold(code, name, this.auth.photoURL());
    this.waitForLogin();
  }

  skipOnboarding(): void {
    localStorage.setItem('meal-prep:skipped-onboarding', 'true');
    this.router.navigate(['/today']);
  }

  private waitForLogin(): void {
    const check = setInterval(() => {
      if (this.householdService.isLoggedIn()) {
        clearInterval(check);
        this.loading.set(false);
        this.router.navigate(['/today']);
      }
    }, 100);

    setTimeout(() => {
      clearInterval(check);
      this.loading.set(false);
      if (!this.householdService.isLoggedIn()) {
        this.error.set('Greška pri povezivanju. Proverite konekciju.');
      }
    }, 10_000);
  }
}
