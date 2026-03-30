import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting } from '@angular/common/http/testing';
import { SwPush } from '@angular/service-worker';
import { NotificationService } from './notification.service';
import { HouseholdService } from './household.service';
import { MealDataService } from './meal-data.service';
import { ApiService } from './api.service';
import { MealType } from '../models/meal.model';

const mockSwPush = {
  requestSubscription: () => Promise.reject('not supported in test'),
  messages: { subscribe: () => ({}) },
  notificationClicks: { subscribe: () => ({}) },
};

function setup(preLocalStorage?: () => void) {
  localStorage.clear();
  preLocalStorage?.();

  // Mock window.matchMedia for standalone detection
  if (typeof window !== 'undefined' && !window.matchMedia) {
    (window as any).matchMedia = () => ({ matches: false, addListener: () => {}, removeListener: () => {} });
  }

  TestBed.configureTestingModule({
    providers: [
      provideHttpClient(),
      provideHttpClientTesting(),
      { provide: SwPush, useValue: mockSwPush },
      HouseholdService,
      ApiService,
      MealDataService,
      NotificationService,
    ],
  });

  const service = TestBed.inject(NotificationService);
  return { service };
}

describe('NotificationService', () => {
  afterEach(() => {
    localStorage.clear();
    TestBed.resetTestingModule();
  });

  it('should create with default preferences', () => {
    const { service } = setup();
    const prefs = service.preferences();
    expect(prefs.enabled).toBe(false);
    expect(prefs.dailySummary).toBe(true);
    expect(prefs.mealReminders).toBe(true);
  });

  it('should load saved preferences from localStorage', () => {
    const saved = {
      enabled: true,
      dailySummary: false,
      mealReminders: false,
    };

    const { service } = setup(() => {
      localStorage.setItem('meal-prep:notification-prefs', JSON.stringify(saved));
    });

    expect(service.preferences().enabled).toBe(true);
    expect(service.preferences().dailySummary).toBe(false);
    expect(service.preferences().mealReminders).toBe(false);
  });

  it('should update preferences and persist to localStorage', () => {
    const { service } = setup();
    const updated = {
      ...service.preferences(),
      enabled: true,
      dailySummary: false,
    };

    service.updatePreferences(updated);

    expect(service.preferences().enabled).toBe(true);
    expect(service.preferences().dailySummary).toBe(false);

    const stored = JSON.parse(localStorage.getItem('meal-prep:notification-prefs')!);
    expect(stored.enabled).toBe(true);
    expect(stored.dailySummary).toBe(false);
  });

  it('should detect iOS by user agent', () => {
    const { service } = setup();
    // In test environment, navigator.userAgent won't match iOS
    expect(service.isIOS()).toBe(false);
  });

  it('should compute canRequestPermission based on support and permission', () => {
    const { service } = setup();
    // In test env, pushSupported is false (no PushManager), so canRequestPermission should be false
    expect(service.canRequestPermission()).toBe(false);
  });

  it('should return false from requestPermissionAndSubscribe when push not supported', async () => {
    const { service } = setup();
    const result = await service.requestPermissionAndSubscribe();
    expect(result).toBe(false);
  });

  it('should handle corrupted localStorage preferences gracefully', () => {
    const { service } = setup(() => {
      localStorage.setItem('meal-prep:notification-prefs', 'not-json{{{');
    });

    // Should fall back to defaults
    expect(service.preferences().enabled).toBe(false);
    expect(service.preferences().dailySummary).toBe(true);
  });

  it('should compute needsInstallPrompt as false for non-iOS', () => {
    const { service } = setup();
    expect(service.needsInstallPrompt()).toBe(false);
  });

  it('should start with isSubscribed false', () => {
    const { service } = setup();
    expect(service.isSubscribed()).toBe(false);
  });
});
