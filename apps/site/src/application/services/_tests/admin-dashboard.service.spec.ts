import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { PLATFORM_ID } from '@angular/core';
import { TestBed } from '@angular/core/testing';

import { ConfigFacade } from '../../facades/config-facade';
import { type AdminDashboardSnapshot, AdminDashboardService } from '../admin-dashboard.service';

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

  it('revokes the session token on the server when logging out', () => {
    service.sessionToken.set('tok-logout');
    sessionStorage.setItem(STORAGE_KEY, 'tok-logout');

    service.logout();

    const logoutRequest = httpTestingController.expectOne(`${ADMIN_API_PATH}/logout`);
    expect(logoutRequest.request.method).toBe('POST');
    expect(logoutRequest.request.headers.get('Authorization')).toBe('Bearer tok-logout');
    logoutRequest.flush(null, { status: 204, statusText: 'No Content' });
    expect(service.isAuthenticated()).toBe(false);
    expect(sessionStorage.getItem(STORAGE_KEY)).toBeNull();
  });

  it('clears the local session even when the logout call fails', () => {
    service.sessionToken.set('tok-logout');
    sessionStorage.setItem(STORAGE_KEY, 'tok-logout');

    expect(() => service.logout()).not.toThrow();
    httpTestingController
      .expectOne(`${ADMIN_API_PATH}/logout`)
      .flush('server error', { status: 500, statusText: 'Internal Server Error' });

    expect(service.isAuthenticated()).toBe(false);
    expect(service.sessionToken()).toBeNull();
    expect(sessionStorage.getItem(STORAGE_KEY)).toBeNull();
    expect(service.snapshot()).toBeNull();
  });

  it('does not call the server on logout when no session is open', () => {
    service.logout();

    httpTestingController.expectNone(`${ADMIN_API_PATH}/logout`);
    expect(service.isAuthenticated()).toBe(false);
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

  describe('session storage', () => {
    const LEGACY_CREDENTIALS_KEY = 'vps-admin-credentials';

    function createFreshService(): AdminDashboardService {
      TestBed.resetTestingModule();
      TestBed.configureTestingModule({
        providers: [
          provideHttpClient(),
          provideHttpClientTesting(),
          AdminDashboardService,
          {
            provide: ConfigFacade,
            useValue: {
              cfg: () => ({ adminApiPath: ADMIN_API_PATH, adminDashboardEnabled: true }),
            },
          },
          { provide: PLATFORM_ID, useValue: 'browser' },
        ],
      });
      return TestBed.inject(AdminDashboardService);
    }

    afterEach(() => {
      jest.restoreAllMocks();
    });

    it('starts unauthenticated when reading the storage throws', () => {
      jest.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
        throw new Error('storage blocked');
      });

      const fresh = createFreshService();

      expect(fresh.isAuthenticated()).toBe(false);
      expect(fresh.sessionToken()).toBeNull();
    });

    it('purges the legacy clear-text credentials on load', () => {
      sessionStorage.setItem(LEGACY_CREDENTIALS_KEY, '{"user":"admin","mdp":"secret"}');

      createFreshService();

      expect(sessionStorage.getItem(LEGACY_CREDENTIALS_KEY)).toBeNull();
    });

    it('restores the stored session token on load', () => {
      sessionStorage.setItem(STORAGE_KEY, 'tok-restored');

      const fresh = createFreshService();

      expect(fresh.sessionToken()).toBe('tok-restored');
    });

    it('still completes the login when persisting the token throws', async () => {
      jest.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
        throw new Error('quota exceeded');
      });

      const loginPromise = service.login('admin', 'secret');
      httpTestingController.expectOne(`${ADMIN_API_PATH}/login`).flush({
        token: 'tok-memory',
        expiresAt: new Date(Date.now() + 3_600_000).toISOString(),
      });
      await tick();
      httpTestingController
        .expectOne((r) => r.url === `${ADMIN_API_PATH}/summary`)
        .flush({ notifications: [], history: { recentSessions: [] } });
      httpTestingController
        .expectOne((r) => r.url.startsWith(`${ADMIN_API_PATH}/logs`))
        .flush({ lines: [] });

      const ok = await loginPromise;

      expect(ok).toBe(true);
      expect(service.sessionToken()).toBe('tok-memory');
    });

    it('does not throw on logout when removing the token throws', () => {
      service.sessionToken.set('tok-logout');
      jest.spyOn(Storage.prototype, 'removeItem').mockImplementation(() => {
        throw new Error('storage blocked');
      });

      expect(() => service.logout()).not.toThrow();
      httpTestingController
        .expectOne(`${ADMIN_API_PATH}/logout`)
        .flush(null, { status: 204, statusText: 'No Content' });

      expect(service.isAuthenticated()).toBe(false);
    });
  });

  describe('error messages', () => {
    function openSession(token: string): void {
      service.sessionToken.set(token);
      sessionStorage.setItem(STORAGE_KEY, token);
    }

    function failRefresh(
      status: number,
      statusText: string,
      headers: Record<string, string> = {}
    ): void {
      httpTestingController
        .match((r) => r.url === `${ADMIN_API_PATH}/summary`)
        .forEach((r) => r.flush('error', { status, statusText, headers }));
      httpTestingController
        .match((r) => r.url.startsWith(`${ADMIN_API_PATH}/logs`))
        .forEach((r) => r.flush('error', { status, statusText, headers }));
    }

    it('tells how long to wait when rate limited with a Retry-After header', async () => {
      const loginPromise = service.login('admin', 'secret');

      httpTestingController.expectOne(`${ADMIN_API_PATH}/login`).flush('too many', {
        status: 429,
        statusText: 'Too Many Requests',
        headers: { 'Retry-After': '42' },
      });
      await loginPromise;

      expect(service.authError()).toBe('Trop de tentatives, réessaie dans 42 s.');
    });

    it('asks to retry shortly when rate limited without a Retry-After header', async () => {
      const loginPromise = service.login('admin', 'secret');

      httpTestingController
        .expectOne(`${ADMIN_API_PATH}/login`)
        .flush('too many', { status: 429, statusText: 'Too Many Requests' });
      await loginPromise;

      expect(service.authError()).toBe('Trop de tentatives, réessaie dans un instant.');
    });

    it('keeps the open session and its data when rate limited', async () => {
      openSession('tok-open');
      const snapshot = { notifications: [] } as unknown as AdminDashboardSnapshot;
      service.snapshot.set(snapshot);
      const refreshPromise = service.refreshAll();

      failRefresh(429, 'Too Many Requests', { 'Retry-After': '3' });
      await refreshPromise;

      expect(service.authError()).toBe('Trop de tentatives, réessaie dans 3 s.');
      expect(service.sessionToken()).toBe('tok-open');
      expect(sessionStorage.getItem(STORAGE_KEY)).toBe('tok-open');
      expect(service.snapshot()).toBe(snapshot);
    });

    it('reports an expired session when an open session is refused with 401', async () => {
      openSession('tok-stale');
      const refreshPromise = service.refreshAll();

      failRefresh(401, 'Unauthorized');
      await refreshPromise;

      expect(service.authError()).toBe('Session expirée, reconnecte-toi.');
      expect(service.isAuthenticated()).toBe(false);
      expect(sessionStorage.getItem(STORAGE_KEY)).toBeNull();
      expect(service.snapshot()).toBeNull();
      expect(service.logs()).toEqual([]);
    });

    it('reports invalid credentials when the login itself is refused with 401', async () => {
      const loginPromise = service.login('admin', 'wrong');

      httpTestingController
        .expectOne(`${ADMIN_API_PATH}/login`)
        .flush('unauthorized', { status: 401, statusText: 'Unauthorized' });
      await loginPromise;

      expect(service.authError()).toBe('Identifiants admin invalides.');
      expect(service.isAuthenticated()).toBe(false);
    });
  });
});
