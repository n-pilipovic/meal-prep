import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { HouseholdService } from '../services/household.service';
import { AuthService } from '../services/auth.service';

export const onboardingGuard: CanActivateFn = () => {
  const householdService = inject(HouseholdService);
  const authService = inject(AuthService);
  const router = inject(Router);

  if (householdService.isLoggedIn()) return true;

  // Allow if Firebase-authenticated but no household yet (will be prompted to create/join)
  if (authService.isLoggedIn()) return true;

  // Allow access if user explicitly skipped onboarding
  if (localStorage.getItem('meal-prep:skipped-onboarding') === 'true') return true;

  return router.createUrlTree(['/welcome']);
};
