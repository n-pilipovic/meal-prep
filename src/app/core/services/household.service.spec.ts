import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { HouseholdService } from './household.service';
import { ApiService } from './api.service';

function setup(preLocalStorage?: () => void) {
  localStorage.clear();
  preLocalStorage?.();

  TestBed.configureTestingModule({
    providers: [
      provideHttpClient(),
      provideHttpClientTesting(),
      HouseholdService,
      ApiService,
    ],
  });

  const httpTesting = TestBed.inject(HttpTestingController);
  const service = TestBed.inject(HouseholdService);
  return { service, httpTesting };
}

describe('HouseholdService', () => {
  afterEach(() => {
    localStorage.clear();
    TestBed.resetTestingModule();
  });

  it('should start as not logged in', () => {
    const { service, httpTesting } = setup();
    expect(service.isLoggedIn()).toBe(false);
    expect(service.currentUser()).toBeNull();
    expect(service.members()).toEqual([]);
    expect(service.householdCode()).toBeNull();
    httpTesting.verify();
  });

  it('should create a household', () => {
    const { service, httpTesting } = setup();

    service.createHousehold('Novica');

    const req = httpTesting.expectOne(r => r.url.includes('/api/household') && r.method === 'POST');
    expect(req.request.body).toEqual({ name: 'Novica' });

    req.flush({
      code: 'ABC123',
      userId: 'user-1',
      household: {
        code: 'ABC123',
        members: [{ id: 'user-1', name: 'Novica', color: '#2d6a4f' }],
        createdAt: '2026-03-27T00:00:00Z',
      },
    });

    expect(service.isLoggedIn()).toBe(true);
    expect(service.currentUser()!.name).toBe('Novica');
    expect(service.householdCode()).toBe('ABC123');
    expect(localStorage.getItem('meal-prep:household-code')).toBe('ABC123');
    expect(localStorage.getItem('meal-prep:user-id')).toBe('user-1');
    httpTesting.verify();
  });

  it('should join a household', () => {
    const { service, httpTesting } = setup();

    service.joinHousehold('ABC123', 'Ivana');

    const req = httpTesting.expectOne(r => r.url.includes('/api/household/ABC123/join'));
    expect(req.request.body).toEqual({ name: 'Ivana' });

    req.flush({
      userId: 'user-2',
      household: {
        code: 'ABC123',
        members: [
          { id: 'user-1', name: 'Novica', color: '#2d6a4f' },
          { id: 'user-2', name: 'Ivana', color: '#e76f51' },
        ],
        createdAt: '2026-03-27T00:00:00Z',
      },
    });

    expect(service.isLoggedIn()).toBe(true);
    expect(service.currentUser()!.name).toBe('Ivana');
    expect(service.members().length).toBe(2);
    httpTesting.verify();
  });

  it('should restore session from localStorage', () => {
    const { service, httpTesting } = setup(() => {
      localStorage.setItem('meal-prep:household-code', 'XYZ789');
      localStorage.setItem('meal-prep:user-id', 'user-99');
    });

    const req = httpTesting.expectOne(r => r.url.includes('/api/household/XYZ789') && r.method === 'GET');
    req.flush({
      code: 'XYZ789',
      members: [{ id: 'user-99', name: 'Test', color: '#264653' }],
      createdAt: '2026-03-27T00:00:00Z',
    });

    expect(service.isLoggedIn()).toBe(true);
    expect(service.currentUserId()).toBe('user-99');
    httpTesting.verify();
  });

  it('should handle restore failure gracefully', () => {
    const { service, httpTesting } = setup(() => {
      localStorage.setItem('meal-prep:household-code', 'INVALID');
      localStorage.setItem('meal-prep:user-id', 'user-99');
    });

    const req = httpTesting.expectOne(r => r.url.includes('/api/household/INVALID'));
    req.error(new ProgressEvent('error'), { status: 404 });

    expect(service.currentHousehold()).toBeNull();
    httpTesting.verify();
  });

  it('should logout and clear storage', () => {
    const { service, httpTesting } = setup();

    service.createHousehold('Test');
    httpTesting.expectOne(r => r.method === 'POST').flush({
      code: 'AAA111',
      userId: 'u1',
      household: {
        code: 'AAA111',
        members: [{ id: 'u1', name: 'Test', color: '#2d6a4f' }],
        createdAt: '2026-03-27T00:00:00Z',
      },
    });

    expect(service.isLoggedIn()).toBe(true);

    service.logout();

    expect(service.isLoggedIn()).toBe(false);
    expect(service.currentUser()).toBeNull();
    expect(localStorage.getItem('meal-prep:household-code')).toBeNull();
    expect(localStorage.getItem('meal-prep:user-id')).toBeNull();
    httpTesting.verify();
  });

  it('should uppercase join code', () => {
    const { service, httpTesting } = setup();

    service.joinHousehold('abc123', 'Test');

    const req = httpTesting.expectOne(r => r.url.includes('/api/household/ABC123/join'));
    req.flush({
      userId: 'u2',
      household: {
        code: 'ABC123',
        members: [{ id: 'u2', name: 'Test', color: '#2d6a4f' }],
        createdAt: '2026-03-27T00:00:00Z',
      },
    });
    httpTesting.verify();
  });

  it('should refresh household data', () => {
    const { service, httpTesting } = setup();

    service.createHousehold('User');
    httpTesting.expectOne(r => r.method === 'POST').flush({
      code: 'BBB222',
      userId: 'u1',
      household: {
        code: 'BBB222',
        members: [{ id: 'u1', name: 'User', color: '#2d6a4f' }],
        createdAt: '2026-03-27T00:00:00Z',
      },
    });

    service.refreshHousehold();

    const req = httpTesting.expectOne(r => r.url.includes('/api/household/BBB222') && r.method === 'GET');
    req.flush({
      code: 'BBB222',
      members: [
        { id: 'u1', name: 'User', color: '#2d6a4f' },
        { id: 'u2', name: 'New Member', color: '#e76f51' },
      ],
      createdAt: '2026-03-27T00:00:00Z',
    });

    expect(service.members().length).toBe(2);
    httpTesting.verify();
  });
});
