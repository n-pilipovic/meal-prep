import { Routes } from '@angular/router';
import { onboardingGuard } from './core/guards/onboarding.guard';

export const routes: Routes = [
  { path: '', redirectTo: 'today', pathMatch: 'full' },
  {
    path: 'welcome',
    loadComponent: () =>
      import('./features/onboarding/welcome.component').then(m => m.WelcomeComponent),
  },
  {
    path: 'today',
    canActivate: [onboardingGuard],
    loadComponent: () =>
      import('./features/daily-view/daily-view.component').then(m => m.DailyViewComponent),
  },
  {
    path: 'day/:dayIndex',
    canActivate: [onboardingGuard],
    loadComponent: () =>
      import('./features/daily-view/daily-view.component').then(m => m.DailyViewComponent),
  },
  {
    path: 'day/:dayIndex/meal/:mealType',
    canActivate: [onboardingGuard],
    loadComponent: () =>
      import('./features/meal-detail/meal-detail.component').then(m => m.MealDetailComponent),
  },
  {
    path: 'week',
    canActivate: [onboardingGuard],
    loadComponent: () =>
      import('./features/weekly-view/weekly-view.component').then(m => m.WeeklyViewComponent),
  },
  {
    path: 'shopping',
    canActivate: [onboardingGuard],
    loadComponent: () =>
      import('./features/shopping-list/shopping-list.component').then(m => m.ShoppingListComponent),
  },
  {
    path: 'day/:dayIndex/checklist',
    canActivate: [onboardingGuard],
    loadComponent: () =>
      import('./features/prep-checklist/prep-checklist.component').then(m => m.PrepChecklistComponent),
  },
  {
    path: 'settings',
    canActivate: [onboardingGuard],
    loadComponent: () =>
      import('./features/settings/settings.component').then(m => m.SettingsComponent),
  },
  {
    path: 'editor',
    canActivate: [onboardingGuard],
    loadComponent: () =>
      import('./features/editor/editor.component').then(m => m.EditorComponent),
  },
  {
    path: 'report-issue',
    canActivate: [onboardingGuard],
    loadComponent: () =>
      import('./features/report-issue/report-issue.component').then(m => m.ReportIssueComponent),
  },
  {
    path: 'my-issues',
    canActivate: [onboardingGuard],
    loadComponent: () =>
      import('./features/my-issues/my-issues.component').then(m => m.MyIssuesComponent),
  },
  {
    path: 'issue/:number',
    canActivate: [onboardingGuard],
    loadComponent: () =>
      import('./features/my-issues/issue-detail.component').then(m => m.IssueDetailComponent),
  },
];
