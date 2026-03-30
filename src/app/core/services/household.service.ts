import { Injectable, inject, signal, computed, effect } from '@angular/core';
import { ApiService } from './api.service';
import { AuthService } from './auth.service';
import { Household, UserProfile } from '../models/user.model';

const STORAGE_KEY_HOUSEHOLD = 'meal-prep:household-code';

@Injectable({ providedIn: 'root' })
export class HouseholdService {
  private readonly api = inject(ApiService);
  private readonly auth = inject(AuthService);

  private readonly household = signal<Household | null>(null);
  private readonly _sessionReady = signal(false);

  readonly currentHousehold = this.household.asReadonly();
  /** True once the initial auth + household restoration attempt has completed */
  readonly sessionReady = this._sessionReady.asReadonly();

  // User ID comes from Firebase auth
  readonly currentUserId = computed(() => this.auth.uid());

  readonly isLoggedIn = computed(() => {
    return this.auth.isLoggedIn() && this.household() !== null;
  });

  readonly currentUser = computed<UserProfile | null>(() => {
    const h = this.household();
    const uid = this.auth.uid();
    if (!h || !uid) return null;
    return h.members.find(m => m.id === uid) ?? null;
  });

  readonly members = computed<UserProfile[]>(() => {
    return this.household()?.members ?? [];
  });

  readonly householdCode = computed<string | null>(() => {
    return this.household()?.code ?? null;
  });

  constructor() {
    // When Firebase auth state changes, try to restore the household session
    effect(() => {
      const uid = this.auth.uid();
      const ready = this.auth.isReady();
      if (!ready) return;

      if (uid) {
        this.restoreSession();
      } else {
        this.household.set(null);
        this._sessionReady.set(true);
      }
    });
  }

  createHousehold(name: string): void {
    this.api.createHousehold(name).subscribe({
      next: ({ code, household }) => {
        this.saveSession(code);
        this.household.set(household);
      },
    });
  }

  joinHousehold(code: string, name: string): void {
    this.api.joinHousehold(code.toUpperCase(), name).subscribe({
      next: ({ household }) => {
        this.saveSession(household.code);
        this.household.set(household);
      },
    });
  }

  refreshHousehold(): void {
    const code = this.householdCode();
    if (!code) return;
    this.api.getHousehold(code).subscribe({
      next: (household) => this.household.set(household),
    });
  }

  logout(): void {
    localStorage.removeItem(STORAGE_KEY_HOUSEHOLD);
    this.household.set(null);
    this.auth.signOutUser();
  }

  private restoreSession(): void {
    const code = localStorage.getItem(STORAGE_KEY_HOUSEHOLD);
    if (code) {
      // Have a local code — fetch household by code
      this.api.getHousehold(code).subscribe({
        next: (household) => {
          this.household.set(household);
          this._sessionReady.set(true);
        },
        error: () => this.resolveFromServer(),
      });
    } else {
      // No local code — ask server for this user's household
      this.resolveFromServer();
    }
  }

  private resolveFromServer(): void {
    this.api.getMyHousehold().subscribe({
      next: (household) => {
        this.saveSession(household.code);
        this.household.set(household);
        this._sessionReady.set(true);
      },
      error: () => {
        this.household.set(null);
        this._sessionReady.set(true);
      },
    });
  }

  private saveSession(code: string): void {
    localStorage.setItem(STORAGE_KEY_HOUSEHOLD, code);
  }
}
