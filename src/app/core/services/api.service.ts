import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { Household, SharedState } from '../models/user.model';
import { WeeklyPlan } from '../models/meal.model';

import { environment } from '../../../environments/environment';

@Injectable({ providedIn: 'root' })
export class ApiService {
  private readonly http = inject(HttpClient);
  private readonly baseUrl = environment.apiUrl;

  createHousehold(name: string): Observable<{ code: string; userId: string; household: Household }> {
    return this.http.post<{ code: string; userId: string; household: Household }>(
      `${this.baseUrl}/api/household`,
      { name },
    );
  }

  joinHousehold(code: string, name: string): Observable<{ userId: string; household: Household }> {
    return this.http.post<{ userId: string; household: Household }>(
      `${this.baseUrl}/api/household/${code}/join`,
      { name },
    );
  }

  getHousehold(code: string): Observable<Household> {
    return this.http.get<Household>(`${this.baseUrl}/api/household/${code}`);
  }

  savePlan(userId: string, plan: WeeklyPlan): Observable<{ ok: boolean }> {
    return this.http.put<{ ok: boolean }>(
      `${this.baseUrl}/api/user/${userId}/plan`,
      plan,
    );
  }

  getHouseholdPlans(code: string): Observable<Record<string, WeeklyPlan>> {
    return this.http.get<Record<string, WeeklyPlan>>(
      `${this.baseUrl}/api/household/${code}/plans`,
    );
  }

  saveSubscription(userId: string, subscription: PushSubscriptionJSON): Observable<{ ok: boolean }> {
    return this.http.post<{ ok: boolean }>(
      `${this.baseUrl}/api/user/${userId}/subscription`,
      subscription,
    );
  }

  getSharedState(code: string): Observable<SharedState> {
    return this.http.get<SharedState>(
      `${this.baseUrl}/api/household/${code}/shared`,
    );
  }

  updateSharedState(code: string, state: SharedState): Observable<{ ok: boolean }> {
    return this.http.put<{ ok: boolean }>(
      `${this.baseUrl}/api/household/${code}/shared`,
      state,
    );
  }
}
