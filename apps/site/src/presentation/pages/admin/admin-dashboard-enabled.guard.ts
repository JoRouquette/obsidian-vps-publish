import { inject } from '@angular/core';
import { type CanActivateFn, Router } from '@angular/router';

import { ConfigFacade } from '../../../application/facades/config-facade';

/**
 * Prevents navigation to the admin dashboard when it is disabled in the public
 * config, redirecting to the home page. The server remains the source of truth
 * for authorization; this guard only avoids exposing the admin surface.
 */
export const adminDashboardEnabledGuard: CanActivateFn = async () => {
  const config = inject(ConfigFacade);
  const router = inject(Router);

  await config.ensure();

  if (config.cfg()?.adminDashboardEnabled) {
    return true;
  }

  return router.createUrlTree(['/']);
};
