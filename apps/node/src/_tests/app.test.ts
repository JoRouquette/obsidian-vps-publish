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

import { createApp } from '../infra/http/express/app';

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
});
