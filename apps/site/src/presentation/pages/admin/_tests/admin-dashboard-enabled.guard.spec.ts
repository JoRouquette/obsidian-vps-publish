import { TestBed } from '@angular/core/testing';
import { Router, type UrlTree } from '@angular/router';

import { ConfigFacade } from '../../../../application/facades/config-facade';
import { adminDashboardEnabledGuard } from '../admin-dashboard-enabled.guard';

describe('adminDashboardEnabledGuard', () => {
  const urlTree = {} as UrlTree;
  let routerStub: { createUrlTree: jest.Mock };

  function configure(adminDashboardEnabled: boolean): void {
    const configStub = {
      ensure: jest.fn().mockResolvedValue(undefined),
      cfg: () => ({ adminDashboardEnabled }),
    };
    routerStub = { createUrlTree: jest.fn(() => urlTree) };

    TestBed.configureTestingModule({
      providers: [
        { provide: ConfigFacade, useValue: configStub },
        { provide: Router, useValue: routerStub },
      ],
    });
  }

  const run = () =>
    TestBed.runInInjectionContext(() =>
      adminDashboardEnabledGuard({} as never, {} as never)
    ) as Promise<boolean | UrlTree>;

  afterEach(() => TestBed.resetTestingModule());

  it('allows navigation when the dashboard is enabled', async () => {
    configure(true);

    await expect(run()).resolves.toBe(true);
    expect(routerStub.createUrlTree).not.toHaveBeenCalled();
  });

  it('redirects to home when the dashboard is disabled', async () => {
    configure(false);

    await expect(run()).resolves.toBe(urlTree);
    expect(routerStub.createUrlTree).toHaveBeenCalledWith(['/']);
  });
});
