import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { HouseholdService } from '../services/household.service';

export const onboardingGuard: CanActivateFn = () => {
  const householdService = inject(HouseholdService);
  const router = inject(Router);

  if (householdService.isLoggedIn()) return true;

  // Allow access if user explicitly skipped onboarding
  if (localStorage.getItem('meal-prep:skipped-onboarding') === 'true') return true;

  return router.createUrlTree(['/welcome']);
};
