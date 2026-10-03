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
    siteName: jest.fn(() => 'Site'),
    author: jest.fn(() => 'Author'),
    repoUrl: jest.fn(() => 'http://repo'),
    reportIssuesUrl: jest.fn(() => 'http://issues'),
    homeWelcomeTitle: jest.fn(() => 'Welcome'),
    adminApiPath: jest.fn(() => '/admin-api'),
    adminUsernameHash: jest.fn(() => ''),
    adminPasswordHash: jest.fn(() => ''),
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
