import { inject } from '@angular/core';
import { toObservable } from '@angular/core/rxjs-interop';
import { CanActivateFn, Router } from '@angular/router';
import { filter, map, take } from 'rxjs';
import { HouseholdService } from '../services/household.service';
import { AuthService } from '../services/auth.service';

export const onboardingGuard: CanActivateFn = () => {
  const householdService = inject(HouseholdService);
  const authService = inject(AuthService);
  const router = inject(Router);

  // If session restoration is already done, check synchronously
  if (householdService.sessionReady()) {
    return check(householdService, authService, router);
  }

  // Otherwise wait for the session to be restored before deciding
  return toObservable(householdService.sessionReady).pipe(
    filter(ready => ready),
    take(1),
    map(() => check(householdService, authService, router)),
  );
};

function check(
  householdService: HouseholdService,
  authService: AuthService,
  router: Router,
): boolean | ReturnType<Router['createUrlTree']> {
  if (householdService.isLoggedIn()) return true;

  // Allow if Firebase-authenticated but no household yet (will be prompted to create/join)
  if (authService.isLoggedIn()) return true;

  // Allow access if user explicitly skipped onboarding
  if (localStorage.getItem('meal-prep:skipped-onboarding') === 'true') return true;

  return router.createUrlTree(['/welcome']);
}
