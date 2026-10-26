import fs from 'node:fs/promises';
import path from 'node:path';

import express from 'express';
import request from 'supertest';

jest.mock('../infra/http/express/middleware/api-key-auth.middleware', () => ({
  createApiKeyAuthMiddleware: () => (_req: any, _res: any, next: any) => next(),
}));

jest.mock('../infra/http/express/controllers/session-controller', () => ({
  createSessionController: () => {
    const router = express.Router();
    router.get('/session/mock', (_req, res) => res.json({ ok: true }));
    return router;
  },
}));

jest.mock('../infra/config/env-config', () => ({
  EnvConfig: {
    allowedOrigins: jest.fn(() => ['*']),
    apiKey: jest.fn(() => 'secret'),
    assetsRoot: jest.fn(() => './tmp/assets'),
    contentRoot: jest.fn(() => './tmp/content'),
    uiRoot: jest.fn(() => './tmp/ui'),
    uiServerRoot: jest.fn(() => './tmp/ui-server'),
    ssrEnabled: jest.fn(() => false),
    loggerLevel: jest.fn(() => 'debug'),
    logFilePath: jest.fn(() => './tmp/node.log'),
    baseUrl: jest.fn(() => 'http://localhost:4200'),
    baseUrlOrNull: jest.fn(() => undefined),
    siteName: jest.fn(() => 'Site'),
    author: jest.fn(() => 'Author'),
    repoUrl: jest.fn(() => 'http://repo'),
    reportIssuesUrl: jest.fn(() => 'http://issues'),
    homeWelcomeTitle: jest.fn(() => 'Welcome'),
    adminApiPath: jest.fn(() => '/admin-api'),
    adminUsernameHash: jest.fn(() => ''),
    adminPasswordHash: jest.fn(() => ''),
    adminSessionSecret: jest.fn(() => undefined),
    adminDashboardEnabled: jest.fn(() => false),
    port: jest.fn(() => 3000),
    maxActiveRequests: jest.fn(() => 100),
    maxEventLoopLagMs: jest.fn(() => 5000),
    maxMemoryUsageMB: jest.fn(() => 2048),
    maxConcurrentFinalizationJobs: jest.fn(() => 3),
    finalizationSseEnabled: jest.fn(() => true),
    maxAssetSizeBytes: jest.fn(() => 10 * 1024 * 1024), // 10MB
    virusScannerEnabled: jest.fn(() => false), // Disable scanner in tests
    clamavHost: jest.fn(() => 'localhost'),
    clamavPort: jest.fn(() => 3310),
    clamavTimeout: jest.fn(() => 10000),
    imageOptimizationEnabled: jest.fn(() => false),
    imageConvertToWebp: jest.fn(() => true),
    imageQuality: jest.fn(() => 85),
    imageMaxWidth: jest.fn(() => 4096),
    imageMaxHeight: jest.fn(() => 4096),
  },
}));

import { hashAdminSecret } from '../infra/admin/admin-credential.util';
import { AdminSessionTokenService } from '../infra/admin/admin-session-token.service';
import { EnvConfig } from '../infra/config/env-config';
import { createApp } from '../infra/http/express/app';
import { FinalizationStreamTokenService } from '../infra/http/express/finalization-stream-token.service';
import { readFirstChunk } from './helpers/read-first-chunk';

describe('createApp', () => {
  it('mounts routes and public config', async () => {
    const createdIntervals: Array<{ unref: jest.Mock }> = [];
    const setIntervalSpy = jest.spyOn(global, 'setInterval').mockImplementation(((
      ..._args: Parameters<typeof setInterval>
    ) => {
      const interval = { unref: jest.fn() };
      createdIntervals.push(interval);
      return interval as unknown as NodeJS.Timeout;
    }) as typeof setInterval);

    const { app } = createApp();
    try {
      const apiRes = await request(app).get('/api/ping');
      expect(apiRes.status).toBe(200);

      const cfgRes = await request(app).get('/public-config');
      expect(cfgRes.status).toBe(200);
      expect(cfgRes.body.baseUrl).toBe('http://localhost:4200');
      expect(cfgRes.body.siteName).toBe('Site');
      expect(cfgRes.body.adminDashboardEnabled).toBe(false);

      expect(setIntervalSpy).toHaveBeenCalled();
      expect(createdIntervals.length).toBeGreaterThan(0);
      createdIntervals.forEach((interval) => {
        expect(interval.unref).toHaveBeenCalledTimes(1);
      });
    } finally {
      setIntervalSpy.mockRestore();
    }
  });

  // Rendered notes opened directly as a top-level document must not run any
  // residual script with the site origin.
  describe('/content security headers', () => {
    beforeAll(async () => {
      const root = EnvConfig.contentRoot();
      await fs.mkdir(root, { recursive: true });
      await fs.writeFile(path.join(root, 'csp-page.html'), '<p>page</p>');
      await fs.writeFile(path.join(root, '_manifest.json'), '{}');
    });

    it('sends a sandboxing CSP and nosniff on HTML content', async () => {
      const { app } = createApp();

      const res = await request(app).get('/content/csp-page.html');

      expect(res.status).toBe(200);
      expect(res.headers['content-security-policy']).toBe(
        "default-src 'none'; img-src https: data:; style-src 'unsafe-inline'; sandbox"
      );
      expect(res.headers['x-content-type-options']).toBe('nosniff');
      expect(res.headers['cache-control']).toBe('public, max-age=300, must-revalidate');
    });

    it('does not send them on the manifest', async () => {
      const { app } = createApp();

      const res = await request(app).get('/content/_manifest.json');

      expect(res.status).toBe(200);
      expect(res.headers['content-security-policy']).toBeUndefined();
      expect(res.headers['x-content-type-options']).toBeUndefined();
    });
  });

  // Uploaded files are served from the site origin: anything that can run script when opened
  // as a top-level document must be sandboxed, and nothing may be MIME-sniffed.
  describe('/assets security headers', () => {
    const sandboxCsp = "default-src 'none'; style-src 'unsafe-inline'; sandbox";

    beforeAll(async () => {
      const root = EnvConfig.assetsRoot();
      await fs.mkdir(root, { recursive: true });
      await fs.writeFile(path.join(root, 'x.svg'), '<svg xmlns="http://www.w3.org/2000/svg"/>');
      await fs.writeFile(path.join(root, 'x.SVG'), '<svg xmlns="http://www.w3.org/2000/svg"/>');
      await fs.writeFile(path.join(root, 'x.png'), Buffer.from([0x89, 0x50, 0x4e, 0x47]));
      await fs.writeFile(path.join(root, 'notes.txt'), 'hello');
      await fs.writeFile(path.join(root, 'page.html'), '<script>alert(1)</script>');
    });

    it.each(['x.svg', 'x.SVG', 'notes.txt', 'page.html'])(
      'sandboxes /assets/%s and disables sniffing',
      async (name) => {
        const { app } = createApp();

        const res = await request(app).get(`/assets/${name}`);

        expect(res.status).toBe(200);
        expect(res.headers['content-security-policy']).toBe(sandboxCsp);
        expect(res.headers['x-content-type-options']).toBe('nosniff');
      }
    );

    it('disables sniffing but adds no CSP on an inert raster image', async () => {
      const { app } = createApp();

      const res = await request(app).get('/assets/x.png');

      expect(res.status).toBe(200);
      expect(res.headers['content-security-policy']).toBeUndefined();
      expect(res.headers['x-content-type-options']).toBe('nosniff');
    });
  });

  describe('admin dashboard wiring', () => {
    const ADMIN_USER = 'admin';
    const ADMIN_PASSWORD = 'integration-password';
    const summaryPath = '/admin-api/summary';

    beforeEach(() => {
      (EnvConfig.adminDashboardEnabled as jest.Mock).mockReturnValue(true);
      (EnvConfig.adminUsernameHash as jest.Mock).mockReturnValue(hashAdminSecret(ADMIN_USER));
      (EnvConfig.adminPasswordHash as jest.Mock).mockReturnValue(hashAdminSecret(ADMIN_PASSWORD));
    });

    afterEach(() => {
      (EnvConfig.adminDashboardEnabled as jest.Mock).mockReturnValue(false);
      (EnvConfig.adminUsernameHash as jest.Mock).mockReturnValue('');
      (EnvConfig.adminPasswordHash as jest.Mock).mockReturnValue('');
      (EnvConfig.adminSessionSecret as jest.Mock).mockReturnValue(undefined);
    });

    async function login(app: express.Express): Promise<string> {
      const res = await request(app)
        .post('/admin-api/login')
        .send({ user: ADMIN_USER, mdp: ADMIN_PASSWORD });
      expect(res.status).toBe(200);
      return res.body.token as string;
    }

    it('rejects an admin route without a bearer token', async () => {
      const { app } = createApp();

      const res = await request(app).get(summaryPath);

      expect(res.status).toBe(401);
    });

    it('issues a token on login', async () => {
      const { app } = createApp();

      const token = await login(app);

      expect(token.length).toBeGreaterThan(0);
    });

    it('lets a bearer token through the admin middleware', async () => {
      const { app } = createApp();
      const token = await login(app);

      const res = await request(app).get(summaryPath).set('Authorization', `Bearer ${token}`);

      expect(res.status).not.toBe(401);
    });

    it('refuses the token once the session is logged out', async () => {
      const { app } = createApp();
      const token = await login(app);

      const logout = await request(app)
        .post('/admin-api/logout')
        .set('Authorization', `Bearer ${token}`);
      const after = await request(app).get(summaryPath).set('Authorization', `Bearer ${token}`);

      expect(logout.status).toBe(204);
      expect(after.status).toBe(401);
    });

    describe('with a configured session secret', () => {
      const SECRET = 'integration-session-secret-0123456789';
      const OTHER_SECRET = 'another-session-secret-9876543210-xyz';

      it('accepts, on a second app with the same secret, a token issued by the first', async () => {
        (EnvConfig.adminSessionSecret as jest.Mock).mockReturnValue(SECRET);
        const token = await login(createApp().app);

        const res = await request(createApp().app)
          .get(summaryPath)
          .set('Authorization', `Bearer ${token}`);

        expect(res.status).not.toBe(401);
      });

      it('refuses, on a second app with another secret, a token issued by the first', async () => {
        (EnvConfig.adminSessionSecret as jest.Mock).mockReturnValue(SECRET);
        const token = await login(createApp().app);
        (EnvConfig.adminSessionSecret as jest.Mock).mockReturnValue(OTHER_SECRET);

        const res = await request(createApp().app)
          .get(summaryPath)
          .set('Authorization', `Bearer ${token}`);

        expect(res.status).toBe(401);
      });
    });

    it('does not accept a token signed with a key derived from the hashes alone', async () => {
      const { app } = createApp();
      const forged = new AdminSessionTokenService(
        `${EnvConfig.adminUsernameHash()}:${EnvConfig.adminPasswordHash()}`
      ).createToken().token;

      const res = await request(app).get(summaryPath).set('Authorization', `Bearer ${forged}`);

      expect(res.status).toBe(401);
    });
  });

  // compression() sits in front of every route. Without the SSE exclusion that
  // createApp wires in, a client sending Accept-Encoding receives nothing: the
  // first event stays in the compression buffer.
  it('delivers the first server-sent event uncompressed to a client that accepts gzip', async () => {
    const setIntervalSpy = jest
      .spyOn(global, 'setInterval')
      .mockImplementation(
        ((..._args: Parameters<typeof setInterval>) =>
          ({ unref: jest.fn() }) as unknown as NodeJS.Timeout) as typeof setInterval
      );
    const clearIntervalSpy = jest.spyOn(global, 'clearInterval').mockImplementation(() => {});

    const { app } = createApp();
    const server = app.listen(0);
    try {
      await new Promise<void>((resolve) => server.once('listening', () => resolve()));

      const first = await readFirstChunk(
        server,
        '/events/content',
        { Accept: 'text/event-stream', 'Accept-Encoding': 'gzip, deflate, br' },
        { until: '"type":"connected"' }
      );

      expect(first.contentEncoding).toBeUndefined();
      expect(first.body).toContain('"type":"connected"');
    } finally {
      server.closeAllConnections();
      await new Promise<void>((resolve) => server.close(() => resolve()));
      setIntervalSpy.mockRestore();
      clearIntervalSpy.mockRestore();
    }
  });

  // The backpressure middleware is safe by default: without the authorizer that
  // createApp wires in, the finalization stream is shed like any request and no
  // unit test notices. With a full quota, only this wiring lets the stream
  // through.
  describe('finalization stream under a full request quota', () => {
    const streamPath = '/events/session/session-1/finalization';

    async function requestStream(token: string) {
      (EnvConfig.maxActiveRequests as jest.Mock).mockReturnValueOnce(0);
      const setIntervalSpy = jest
        .spyOn(global, 'setInterval')
        .mockImplementation(
          ((..._args: Parameters<typeof setInterval>) =>
            ({ unref: jest.fn() }) as unknown as NodeJS.Timeout) as typeof setInterval
        );

      try {
        const { app } = createApp();
        return await request(app)
          .get(`${streamPath}?jobId=job-1&token=${token}`)
          .set('Accept', 'text/event-stream');
      } finally {
        setIntervalSpy.mockRestore();
      }
    }

    it('lets a stream with a valid token reach the stream handler', async () => {
      // Same secret derivation as createApp, from the mocked API key.
      const token = new FinalizationStreamTokenService('secret:finalization-sse').createToken(
        'session-1',
        'job-1'
      ).token;

      const res = await requestStream(token);

      expect(res.status).toBe(404);
      expect(res.body.error).toBe('job_not_found');
    });

    it('sheds a stream with a forged token', async () => {
      const token = new FinalizationStreamTokenService('another-secret').createToken(
        'session-1',
        'job-1'
      ).token;

      const res = await requestStream(token);

      expect(res.status).toBe(429);
      expect(res.body.cause).toBe('active_requests');
    });
  });
});
