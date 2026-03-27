import { Injectable, inject, signal, OnDestroy } from '@angular/core';
import { ApiService } from './api.service';
import { HouseholdService } from './household.service';
import { SharedState, createEmptySharedState } from '../models/user.model';

const POLL_INTERVAL = 30_000;
const STORAGE_KEY = 'meal-prep:shared-state';

@Injectable({ providedIn: 'root' })
export class SyncService implements OnDestroy {
  private readonly api = inject(ApiService);
  private readonly householdService = inject(HouseholdService);

  private pollTimer: ReturnType<typeof setInterval> | null = null;
  private focusHandler = () => this.fetchSharedState();

  readonly sharedState = signal<SharedState>(this.restoreLocal());
  readonly syncing = signal(false);

  startPolling(): void {
    this.stopPolling();
    this.fetchSharedState();
    this.pollTimer = setInterval(() => this.fetchSharedState(), POLL_INTERVAL);
    document.addEventListener('visibilitychange', this.onVisibilityChange);
  }

  stopPolling(): void {
    if (this.pollTimer) {
      clearInterval(this.pollTimer);
      this.pollTimer = null;
    }
    document.removeEventListener('visibilitychange', this.onVisibilityChange);
  }

  ngOnDestroy(): void {
    this.stopPolling();
  }

  updateSharedState(updater: (state: SharedState) => SharedState): void {
    const newState = updater(this.sharedState());
    this.sharedState.set(newState);
    this.saveLocal(newState);

    const code = this.householdService.householdCode();
    if (code) {
      this.api.updateSharedState(code, newState).subscribe();
    }
  }

  private fetchSharedState(): void {
    const code = this.householdService.householdCode();
    if (!code) return;

    this.syncing.set(true);
    this.api.getSharedState(code).subscribe({
      next: (state) => {
        this.sharedState.set(state);
        this.saveLocal(state);
        this.syncing.set(false);
      },
      error: () => this.syncing.set(false),
    });
  }

  private onVisibilityChange = (): void => {
    if (document.visibilityState === 'visible') {
      this.fetchSharedState();
    }
  };

  private saveLocal(state: SharedState): void {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  }

  private restoreLocal(): SharedState {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      try {
        return JSON.parse(raw);
      } catch {
        // fall through
      }
    }
    return createEmptySharedState();
  }
}
