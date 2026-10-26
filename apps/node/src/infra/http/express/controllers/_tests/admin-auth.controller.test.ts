import type { LoggerPort } from '@core-domain';
import express from 'express';
import request from 'supertest';

import { verifyAdminSecret } from '../../../../admin/admin-credential.util';
import { AdminSessionTokenService } from '../../../../admin/admin-session-token.service';
import { createAdminAuthController } from '../admin-auth.controller';

jest.mock('../../../../admin/admin-credential.util', () => ({
  verifyAdminSecret: jest.fn(),
}));

const verifyMock = jest.mocked(verifyAdminSecret);

const GOOD = { user: 'admin', mdp: 'good' };
const BAD = { user: 'admin', mdp: 'bad' };

let now: number;

function buildApp(logger?: LoggerPort) {
  const app = express();
  app.use(express.json());
  app.use(
    createAdminAuthController(
      { usernameHash: 'admin', passwordHash: 'good' },
      new AdminSessionTokenService('test-secret'),
      logger,
      () => now
    )
  );
  return app;
}

function buildLogger() {
  const warn = jest.fn();
  const logger = { child: () => logger, warn } as unknown as LoggerPort;
  return { logger, warn };
}

describe('admin auth controller rate limiting', () => {
  beforeEach(() => {
    now = 1_000_000;
    verifyMock.mockReset();
    // The mocked "hash" is the expected secret itself.
    verifyMock.mockImplementation(async (secret, storedHash) => secret === storedHash);
  });

  async function failTimes(app: express.Express, count: number) {
    for (let i = 0; i < count; i++) {
      const response = await request(app).post('/login').send(BAD);
      expect(response.status).toBe(403);
    }
  }

  it('verifies both credentials on every attempt', async () => {
    const response = await request(buildApp()).post('/login').send({ user: 'nope', mdp: 'good' });

    expect(response.status).toBe(403);
    expect(verifyMock).toHaveBeenCalledTimes(2);
  });

  it('answers 429 with Retry-After after 5 failures within 60s, without running scrypt', async () => {
    const app = buildApp();
    await failTimes(app, 5);
    verifyMock.mockClear();

    const response = await request(app).post('/login').send(GOOD);

    expect(response.status).toBe(429);
    expect(Number(response.headers['retry-after'])).toBeGreaterThan(0);
    expect(verifyMock).not.toHaveBeenCalled();
  });

  it('accepts logins again once the window has elapsed', async () => {
    const app = buildApp();
    await failTimes(app, 5);

    now += 60_001;
    const response = await request(app).post('/login').send(GOOD);

    expect(response.status).toBe(200);
  });

  it('does not reset the failure counter on a successful login', async () => {
    const app = buildApp();
    await failTimes(app, 4);
    expect((await request(app).post('/login').send(GOOD)).status).toBe(200);
    await failTimes(app, 1);

    const response = await request(app).post('/login').send(GOOD);

    expect(response.status).toBe(429);
  });

  it('counts in-flight attempts so parallel requests cannot bypass the limit', async () => {
    const app = buildApp();
    let release: () => void = () => undefined;
    const pending = new Promise<boolean>((resolve) => {
      release = () => resolve(false);
    });
    verifyMock.mockReturnValue(pending);
    const earlyStatuses: number[] = [];
    let released = false;

    const all = Promise.all(
      Array.from({ length: 10 }, () =>
        request(app)
          .post('/login')
          .send(BAD)
          .then((res) => {
            if (!released) {
              earlyStatuses.push(res.status);
            }
            return res;
          })
      )
    );

    let responses: Awaited<typeof all>;
    try {
      // Each request either reaches verification (2 calls) or is answered without it.
      const deadline = Date.now() + 2_000;
      const accountedFor = (): number => verifyMock.mock.calls.length / 2 + earlyStatuses.length;
      while (accountedFor() < 10 && Date.now() < deadline) {
        await new Promise((resolve) => setImmediate(resolve));
      }

      expect(verifyMock).toHaveBeenCalledTimes(10);
      expect(earlyStatuses).toEqual([429, 429, 429, 429, 429]);
    } finally {
      released = true;
      release();
      responses = await all;
    }

    expect(responses.filter((r) => r.status === 403)).toHaveLength(5);
    expect(responses.filter((r) => r.status === 429)).toHaveLength(5);
  });

  it('forwards verification errors to Express instead of leaving the request hanging', async () => {
    verifyMock.mockRejectedValue(new Error('scrypt failure'));

    const response = await request(buildApp()).post('/login').send(GOOD);

    expect(response.status).toBe(500);
  });

  it('releases the in-flight slot when verification throws', async () => {
    const app = buildApp();
    verifyMock.mockRejectedValue(new Error('scrypt failure'));
    for (let i = 0; i < 5; i++) {
      expect((await request(app).post('/login').send(GOOD)).status).toBe(500);
    }
    verifyMock.mockImplementation(async (secret, storedHash) => secret === storedHash);

    const response = await request(app).post('/login').send(GOOD);

    expect(response.status).toBe(200);
  });

  it('answers Retry-After 1 when the limit is reached by in-flight attempts only', async () => {
    const app = buildApp();
    let release: () => void = () => undefined;
    const pending = new Promise<boolean>((resolve) => {
      release = () => resolve(false);
    });
    verifyMock.mockReturnValue(pending);

    const inFlight = Array.from({ length: 5 }, () => request(app).post('/login').send(BAD));
    // Start the requests, then wait until each has reached verification (2 calls per request).
    const settled = Promise.all(inFlight.map((r) => r.then((res) => res)));
    while (verifyMock.mock.calls.length < 10) {
      await new Promise((resolve) => setImmediate(resolve));
    }

    const response = await request(app).post('/login').send(GOOD);
    release();
    await settled;

    expect(response.status).toBe(429);
    expect(response.headers['retry-after']).toBe('1');
  });

  it('logs the rate limit once per blocked episode, not on every 429', async () => {
    const { logger, warn } = buildLogger();
    const app = buildApp(logger);
    await failTimes(app, 5);

    await request(app).post('/login').send(GOOD);
    await request(app).post('/login').send(GOOD);

    expect(
      warn.mock.calls.filter(([message]) => message === 'Admin login rate limited')
    ).toHaveLength(1);
  });
});

describe('admin auth controller credential length', () => {
  beforeEach(() => {
    now = 1_000_000;
    verifyMock.mockReset();
    verifyMock.mockImplementation(async (secret, storedHash) => secret === storedHash);
  });

  it.each([
    ['user', { user: 'a'.repeat(1025), mdp: 'good' }],
    ['password', { user: 'admin', mdp: 'a'.repeat(1025) }],
  ])('answers 400 without running scrypt when the %s exceeds 1024 characters', async (_, body) => {
    const response = await request(buildApp()).post('/login').send(body);

    expect(response.status).toBe(400);
    expect(verifyMock).not.toHaveBeenCalled();
  });

  it('does not count an oversized attempt against the failure limit', async () => {
    const app = buildApp();
    for (let i = 0; i < 6; i++) {
      await request(app)
        .post('/login')
        .send({ user: 'admin', mdp: 'a'.repeat(1025) });
    }

    const response = await request(app).post('/login').send(GOOD);

    expect(response.status).toBe(200);
  });

  it('still verifies a credential of exactly 1024 characters', async () => {
    const response = await request(buildApp())
      .post('/login')
      .send({ user: 'admin', mdp: 'a'.repeat(1024) });

    expect(response.status).toBe(403);
    expect(verifyMock).toHaveBeenCalledTimes(2);
  });
});

describe('admin auth controller logout', () => {
  function buildLogoutApp() {
    const tokenService = new AdminSessionTokenService('test-secret');
    const app = express();
    app.use(express.json());
    app.use(
      createAdminAuthController({ usernameHash: 'admin', passwordHash: 'good' }, tokenService)
    );
    return { app, tokenService };
  }

  it('answers 204 and revokes a valid bearer token', async () => {
    const { app, tokenService } = buildLogoutApp();
    const { token } = tokenService.createToken();

    const response = await request(app).post('/logout').set('Authorization', `Bearer ${token}`);

    expect(response.status).toBe(204);
    expect(tokenService.validateToken(token)).toEqual({ ok: false, reason: 'revoked' });
  });

  it('answers 204 without a bearer token', async () => {
    const { app, tokenService } = buildLogoutApp();

    const response = await request(app).post('/logout');

    expect(response.status).toBe(204);
    expect(tokenService.revokedTokenCount).toBe(0);
  });

  it('answers 204 for an invalid or already revoked token', async () => {
    const { app, tokenService } = buildLogoutApp();
    const { token } = tokenService.createToken();
    await request(app).post('/logout').set('Authorization', `Bearer ${token}`);

    const again = await request(app).post('/logout').set('Authorization', `Bearer ${token}`);
    const garbage = await request(app).post('/logout').set('Authorization', 'Bearer not.a.token');

    expect(again.status).toBe(204);
    expect(garbage.status).toBe(204);
    expect(tokenService.revokedTokenCount).toBe(1);
  });

  it('answers 204 for an expired signed token without filling the deny list', async () => {
    const { app, tokenService } = buildLogoutApp();
    const expired = new AdminSessionTokenService('test-secret', -1_000).createToken().token;

    const response = await request(app).post('/logout').set('Authorization', `Bearer ${expired}`);

    expect(response.status).toBe(204);
    expect(tokenService.revokedTokenCount).toBe(0);
  });

  it('answers 204 for a token signed with another secret without filling the deny list', async () => {
    const { app, tokenService } = buildLogoutApp();
    const foreign = new AdminSessionTokenService('other-secret').createToken().token;

    const response = await request(app).post('/logout').set('Authorization', `Bearer ${foreign}`);

    expect(response.status).toBe(204);
    expect(tokenService.revokedTokenCount).toBe(0);
  });
});
