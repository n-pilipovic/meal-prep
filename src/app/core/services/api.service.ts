import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { Household, SharedState, NotificationPreferences } from '../models/user.model';
import { WeeklyPlan } from '../models/meal.model';
import { MealPlanPreferences } from '../models/ai-plan.model';
import { IssueDetail, IssueRecord } from '../models/issue.model';

import { environment } from '../../../environments/environment';

@Injectable({ providedIn: 'root' })
export class ApiService {
  private readonly http = inject(HttpClient);
  private readonly baseUrl = environment.apiUrl;

  createHousehold(name: string, avatar?: string | null): Observable<{ code: string; userId: string; household: Household }> {
    return this.http.post<{ code: string; userId: string; household: Household }>(
      `${this.baseUrl}/api/household`,
      { name, avatar: avatar ?? undefined },
    );
  }

  joinHousehold(code: string, name: string, avatar?: string | null): Observable<{ userId: string; household: Household }> {
    return this.http.post<{ userId: string; household: Household }>(
      `${this.baseUrl}/api/household/${code}/join`,
      { name, avatar: avatar ?? undefined },
    );
  }

  getHousehold(code: string): Observable<Household> {
    return this.http.get<Household>(`${this.baseUrl}/api/household/${code}`);
  }

  getMyHousehold(): Observable<Household> {
    return this.http.get<Household>(`${this.baseUrl}/api/me/household`);
  }

  updateProfile(avatar: string | null): Observable<{ ok: boolean; household: Household }> {
    return this.http.put<{ ok: boolean; household: Household }>(
      `${this.baseUrl}/api/me/profile`,
      { avatar: avatar ?? undefined },
    );
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

  deleteSubscription(userId: string): Observable<{ ok: boolean }> {
    return this.http.delete<{ ok: boolean }>(
      `${this.baseUrl}/api/user/${userId}/subscription`,
    );
  }

  saveNotificationPrefs(userId: string, prefs: NotificationPreferences): Observable<{ ok: boolean }> {
    return this.http.put<{ ok: boolean }>(
      `${this.baseUrl}/api/user/${userId}/notification-prefs`,
      prefs,
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

  generatePlan(prefs: MealPlanPreferences): Observable<WeeklyPlan> {
    return this.http.post<WeeklyPlan>(
      `${this.baseUrl}/api/generate-plan`,
      prefs,
    );
  }

  submitIssue(form: FormData): Observable<{ number: number; githubUrl: string }> {
    return this.http.post<{ number: number; githubUrl: string }>(
      `${this.baseUrl}/api/issues`,
      form,
    );
  }

  getMyIssues(): Observable<IssueRecord[]> {
    return this.http.get<IssueRecord[]>(`${this.baseUrl}/api/me/issues`);
  }

  getHouseholdSuggestions(code: string): Observable<IssueRecord[]> {
    return this.http.get<IssueRecord[]>(
      `${this.baseUrl}/api/household/${code}/suggestions`,
    );
  }

  getIssueDetail(number: number): Observable<IssueDetail> {
    return this.http.get<IssueDetail>(`${this.baseUrl}/api/issues/${number}`);
  }

  toggleIssueUpvote(number: number): Observable<{ upvotes: number; upvotedByMe: boolean }> {
    return this.http.post<{ upvotes: number; upvotedByMe: boolean }>(
      `${this.baseUrl}/api/issues/${number}/upvote`,
      {},
    );
  }
}
