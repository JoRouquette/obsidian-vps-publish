import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { PLATFORM_ID } from '@angular/core';
import { TestBed } from '@angular/core/testing';

import { ConfigFacade } from '../../facades/config-facade';
import { AdminDashboardService } from '../admin-dashboard.service';

const ADMIN_API_PATH = '/admin-api';
const STORAGE_KEY = 'vps-admin-session';

const tick = () => new Promise<void>((resolve) => setTimeout(resolve, 0));

describe('AdminDashboardService', () => {
  let service: AdminDashboardService;
  let httpTestingController: HttpTestingController;

  beforeEach(() => {
    sessionStorage.clear();

    const configFacadeStub = {
      cfg: () => ({ adminApiPath: ADMIN_API_PATH, adminDashboardEnabled: true }),
    };

    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        AdminDashboardService,
        { provide: ConfigFacade, useValue: configFacadeStub },
        { provide: PLATFORM_ID, useValue: 'browser' },
      ],
    });

    service = TestBed.inject(AdminDashboardService);
    httpTestingController = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    httpTestingController.verify();
    sessionStorage.clear();
  });

  it('exchanges credentials for a session token and authenticates subsequent calls', async () => {
    const loginPromise = service.login('admin', 'secret');

    const loginRequest = httpTestingController.expectOne(`${ADMIN_API_PATH}/login`);
    expect(loginRequest.request.method).toBe('POST');
    expect(loginRequest.request.body).toEqual({ user: 'admin', mdp: 'secret' });
    loginRequest.flush({
      token: 'tok-123',
      expiresAt: new Date(Date.now() + 3_600_000).toISOString(),
    });

    await tick();

    const summaryRequest = httpTestingController.expectOne(
      (r) => r.url === `${ADMIN_API_PATH}/summary`
    );
    expect(summaryRequest.request.headers.get('Authorization')).toBe('Bearer tok-123');
    expect(summaryRequest.request.headers.has('x-admin-mdp')).toBe(false);
    summaryRequest.flush({ notifications: [], history: { recentSessions: [] } });

    const logsRequest = httpTestingController.expectOne((r) =>
      r.url.startsWith(`${ADMIN_API_PATH}/logs`)
    );
    logsRequest.flush({ lines: [] });

    const ok = await loginPromise;

    expect(ok).toBe(true);
    expect(service.isAuthenticated()).toBe(true);
    expect(service.sessionToken()).toBe('tok-123');
    expect(sessionStorage.getItem(STORAGE_KEY)).toBe('tok-123');
  });

  it('never sends the password after login (only the bearer token)', async () => {
    const loginPromise = service.login('admin', 'secret');
    httpTestingController.expectOne(`${ADMIN_API_PATH}/login`).flush({
      token: 'tok-xyz',
      expiresAt: new Date(Date.now() + 3_600_000).toISOString(),
    });
    await tick();

    const summaryRequest = httpTestingController.expectOne(
      (r) => r.url === `${ADMIN_API_PATH}/summary`
    );
    expect(summaryRequest.request.headers.get('Authorization')).toBe('Bearer tok-xyz');
    summaryRequest.flush({ notifications: [], history: { recentSessions: [] } });
    httpTestingController
      .expectOne((r) => r.url.startsWith(`${ADMIN_API_PATH}/logs`))
      .flush({ lines: [] });

    await loginPromise;

    expect(sessionStorage.getItem(STORAGE_KEY)).toBe('tok-xyz');
    // The plaintext password is never persisted.
    expect(JSON.stringify(sessionStorage)).not.toContain('secret');
  });

  it('clears the session token when the API rejects the token', async () => {
    const loginPromise = service.login('admin', 'secret');
    httpTestingController.expectOne(`${ADMIN_API_PATH}/login`).flush({
      token: 'tok-expired',
      expiresAt: new Date(Date.now() + 3_600_000).toISOString(),
    });
    await tick();

    httpTestingController
      .match((r) => r.url === `${ADMIN_API_PATH}/summary`)
      .forEach((r) => r.flush('unauthorized', { status: 401, statusText: 'Unauthorized' }));
    httpTestingController
      .match((r) => r.url.startsWith(`${ADMIN_API_PATH}/logs`))
      .forEach((r) => r.flush('unauthorized', { status: 401, statusText: 'Unauthorized' }));

    const ok = await loginPromise;

    expect(ok).toBe(false);
    expect(service.isAuthenticated()).toBe(false);
    expect(service.sessionToken()).toBeNull();
    expect(sessionStorage.getItem(STORAGE_KEY)).toBeNull();
  });

  it('reports a failed login without storing a token', async () => {
    const loginPromise = service.login('admin', 'wrong');

    httpTestingController
      .expectOne(`${ADMIN_API_PATH}/login`)
      .flush('forbidden', { status: 403, statusText: 'Forbidden' });

    const ok = await loginPromise;

    expect(ok).toBe(false);
    expect(service.isAuthenticated()).toBe(false);
    expect(sessionStorage.getItem(STORAGE_KEY)).toBeNull();
  });
});
