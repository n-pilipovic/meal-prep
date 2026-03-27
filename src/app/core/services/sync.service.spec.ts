import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { SyncService } from './sync.service';
import { HouseholdService } from './household.service';
import { ApiService } from './api.service';
import { createEmptySharedState, SharedState } from '../models/user.model';

describe('SyncService', () => {
  let service: SyncService;
  let httpTesting: HttpTestingController;

  function createService() {
    service = TestBed.inject(SyncService);
    httpTesting = TestBed.inject(HttpTestingController);
  }

  beforeEach(() => {
    localStorage.clear();

    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        SyncService,
        HouseholdService,
        ApiService,
      ],
    });
  });

  afterEach(() => {
    service?.stopPolling();
    httpTesting?.verify();
    localStorage.clear();
  });

  it('should start with empty shared state', () => {
    createService();
    const state = service.sharedState();
    expect(state.shoppingChecked).toEqual({});
    expect(state.prepChecked).toEqual({});
    expect(state.prepAssignments.byUserPlan).toEqual({});
  });

  it('should restore shared state from localStorage', () => {
    const stored: SharedState = {
      ...createEmptySharedState(),
      shoppingChecked: { 'hleb_g': true },
    };
    localStorage.setItem('meal-prep:shared-state', JSON.stringify(stored));

    createService();
    expect(service.sharedState().shoppingChecked['hleb_g']).toBe(true);
  });

  it('should update shared state locally and persist', () => {
    createService();
    service.updateSharedState(state => ({
      ...state,
      shoppingChecked: { ...state.shoppingChecked, 'test_item': true },
    }));

    expect(service.sharedState().shoppingChecked['test_item']).toBe(true);

    const stored = JSON.parse(localStorage.getItem('meal-prep:shared-state')!);
    expect(stored.shoppingChecked['test_item']).toBe(true);
  });

  it('should not sync to remote when not logged in', () => {
    createService();
    service.updateSharedState(state => ({
      ...state,
      shoppingChecked: { 'item': true },
    }));

    // No HTTP request should have been made for shared state
    httpTesting.expectNone(r => r.url.includes('/shared'));
  });

  it('should handle malformed localStorage gracefully', () => {
    localStorage.setItem('meal-prep:shared-state', 'invalid json{{{');

    createService();
    const state = service.sharedState();
    expect(state.shoppingChecked).toEqual({});
  });

  it('should not be syncing by default', () => {
    createService();
    expect(service.syncing()).toBe(false);
  });
});
