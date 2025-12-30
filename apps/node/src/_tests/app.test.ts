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
    loggerLevel: jest.fn(() => 'debug'),
    siteName: jest.fn(() => 'Site'),
    author: jest.fn(() => 'Author'),
    repoUrl: jest.fn(() => 'http://repo'),
    reportIssuesUrl: jest.fn(() => 'http://issues'),
    homeWelcomeTitle: jest.fn(() => 'Welcome'),
    port: jest.fn(() => 3000),
    maxActiveRequests: jest.fn(() => 100),
    maxConcurrentFinalizationJobs: jest.fn(() => 3),
  },
}));

import { createApp } from '../infra/http/express/app';

describe('createApp', () => {
  it('mounts routes and public config', async () => {
    const { app } = createApp();
    const apiRes = await request(app).get('/api/ping');
    expect(apiRes.status).toBe(200);

    const cfgRes = await request(app).get('/public-config');
    expect(cfgRes.status).toBe(200);
    expect(cfgRes.body.siteName).toBe('Site');
  });
});
