import { Injectable, inject, signal, computed } from '@angular/core';
import { ApiService } from './api.service';
import { Household, UserProfile } from '../models/user.model';

const STORAGE_KEY_HOUSEHOLD = 'meal-prep:household-code';
const STORAGE_KEY_USER = 'meal-prep:user-id';

@Injectable({ providedIn: 'root' })
export class HouseholdService {
  private readonly api = inject(ApiService);

  private readonly household = signal<Household | null>(null);
  private readonly userId = signal<string | null>(null);

  readonly currentHousehold = this.household.asReadonly();
  readonly currentUserId = this.userId.asReadonly();

  readonly isLoggedIn = computed(() => {
    return this.household() !== null && this.userId() !== null;
  });

  readonly currentUser = computed<UserProfile | null>(() => {
    const h = this.household();
    const uid = this.userId();
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
    this.restoreSession();
  }

  createHousehold(name: string): void {
    this.api.createHousehold(name).subscribe({
      next: ({ code, userId, household }) => {
        this.saveSession(code, userId);
        this.household.set(household);
        this.userId.set(userId);
      },
    });
  }

  joinHousehold(code: string, name: string): void {
    this.api.joinHousehold(code.toUpperCase(), name).subscribe({
      next: ({ userId, household }) => {
        this.saveSession(household.code, userId);
        this.household.set(household);
        this.userId.set(userId);
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
    localStorage.removeItem(STORAGE_KEY_USER);
    this.household.set(null);
    this.userId.set(null);
  }

  private restoreSession(): void {
    const code = localStorage.getItem(STORAGE_KEY_HOUSEHOLD);
    const uid = localStorage.getItem(STORAGE_KEY_USER);
    if (!code || !uid) return;

    this.userId.set(uid);
    this.api.getHousehold(code).subscribe({
      next: (household) => this.household.set(household),
      error: () => {
        // Household not found on server — keep local-only mode
        this.household.set(null);
      },
    });
  }

  private saveSession(code: string, userId: string): void {
    localStorage.setItem(STORAGE_KEY_HOUSEHOLD, code);
    localStorage.setItem(STORAGE_KEY_USER, userId);
  }
}
