/**
 * SSR (Server-Side Rendering) tests - SSR ENABLED
 *
 * Tests that SSR_ENABLED=true returns fully rendered HTML (not just <app-root></app-root>).
 * See ssr.test.ts for SSR_ENABLED=false tests.
 *
 * These tests mock the Angular SSR service since actual SSR requires the Angular
 * server bundle which is not available in unit tests.
 */
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

import type { NextFunction, Request, Response } from 'express';
import express from 'express';
import request from 'supertest';

// Create temp directories for tests BEFORE any mocks use them
const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'ssr-enabled-test-'));
const uiDir = path.join(tmpDir, 'ui');
const uiServerDir = path.join(tmpDir, 'ui-server');
const contentDir = path.join(tmpDir, 'content');
const assetsDir = path.join(tmpDir, 'assets');

fs.mkdirSync(uiDir, { recursive: true });
fs.mkdirSync(uiServerDir, { recursive: true });
fs.mkdirSync(contentDir, { recursive: true });
fs.mkdirSync(assetsDir, { recursive: true });

// Create a minimal CSR index.html (what Angular produces without SSR - used for static assets)
const CSR_INDEX_HTML = `<!doctype html>
<html lang="en">
<head>
  <title>Test Site</title>
</head>
<body>
  <app-root></app-root>
</body>
</html>`;

// Create a minimal SSR index.html (what SSR produces with rendered content)
const SSR_INDEX_HTML = `<!doctype html>
<html lang="en">
<head>
  <title>Test Site - SSR Rendered</title>
</head>
<body>
  <app-root>
    <h1>Welcome to the Site</h1>
    <p>This content was rendered server-side.</p>
  </app-root>
</body>
</html>`;

// Write test files
fs.writeFileSync(path.join(uiDir, 'index.html'), CSR_INDEX_HTML);
fs.writeFileSync(path.join(contentDir, '_manifest.json'), '{"pages":{}}');

// SSR_ENABLED is TRUE for this test file
const SSR_ENABLED = true;

// Mock the SSR service - returns rendered HTML when enabled
jest.mock('../infra/ssr/angular-ssr.service', () => ({
  createAngularSSRService: jest.fn(
    (): {
      middleware: (
        fallbackPath: string
      ) => (req: Request, res: Response, _next: NextFunction) => Promise<void>;
    } => ({
      middleware: (_fallbackPath: string) => {
        return async (_req: Request, res: Response, _next: NextFunction): Promise<void> => {
          // SSR enabled - return rendered HTML
          res.setHeader('Content-Type', 'text/html; charset=utf-8');
          res.setHeader('X-SSR-Cache', 'MISS');
          res.send(SSR_INDEX_HTML);
        };
      },
    })
  ),
  AngularSSRService: jest.fn(),
}));

jest.mock('../infra/http/express/middleware/api-key-auth.middleware', () => ({
  createApiKeyAuthMiddleware: () => (_req: Request, _res: Response, next: NextFunction) => next(),
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
    assetsRoot: jest.fn(() => assetsDir),
    contentRoot: jest.fn(() => contentDir),
    uiRoot: jest.fn(() => uiDir),
    uiServerRoot: jest.fn(() => uiServerDir),
    ssrEnabled: jest.fn(() => SSR_ENABLED),
    loggerLevel: jest.fn(() => 'error'),
    baseUrl: jest.fn(() => 'http://localhost:3000'),
    siteName: jest.fn(() => 'Test Site'),
    author: jest.fn(() => 'Test Author'),
    repoUrl: jest.fn(() => ''),
    reportIssuesUrl: jest.fn(() => ''),
    homeWelcomeTitle: jest.fn(() => ''),
    port: jest.fn(() => 3000),
    maxActiveRequests: jest.fn(() => 100),
    maxConcurrentFinalizationJobs: jest.fn(() => 3),
    maxAssetSizeBytes: jest.fn(() => 10 * 1024 * 1024),
    virusScannerEnabled: jest.fn(() => false),
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

// Import after mocks are set up
import { createApp } from '../infra/http/express/app';

describe('SSR Enabled (SSR_ENABLED=true)', () => {
  afterAll(() => {
    // Cleanup temp directories
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  it('returns SSR HTML with rendered content inside <app-root>', async () => {
    const { app } = createApp();
    const res = await request(app).get('/');

    expect(res.status).toBe(200);
    expect(res.text).toContain('<h1>Welcome to the Site</h1>');
    expect(res.text).toContain('This content was rendered server-side');
  });

  it('returns title with SSR marker', async () => {
    const { app } = createApp();
    const res = await request(app).get('/');

    expect(res.status).toBe(200);
    expect(res.text).toContain('<title>Test Site - SSR Rendered</title>');
  });

  it('sets SSR cache header', async () => {
    const { app } = createApp();
    const res = await request(app).get('/');

    expect(res.status).toBe(200);
    expect(res.headers['x-ssr-cache']).toBe('MISS');
  });

  it('does not return empty <app-root>', async () => {
    const { app } = createApp();
    const res = await request(app).get('/');

    expect(res.status).toBe(200);
    // SSR should have content inside app-root, not empty
    expect(res.text).not.toMatch(/<app-root>\s*<\/app-root>/);
  });

  it('handles SPA deep routes with SSR', async () => {
    const { app } = createApp();

    // Deep SPA route
    const res = await request(app).get('/pages/some-page');
    expect(res.status).toBe(200);
    expect(res.text).toContain('SSR Rendered');
    expect(res.text).toContain('<h1>Welcome to the Site</h1>');
  });

  it('does not SSR static assets (*.js, *.css)', async () => {
    // Create a test JS file
    fs.writeFileSync(path.join(uiDir, 'main.js'), 'console.log("test");');

    const { app } = createApp();
    const res = await request(app).get('/main.js');

    expect(res.status).toBe(200);
    expect(res.text).toContain('console.log');
    expect(res.text).not.toContain('SSR Rendered');
  });

  it('API routes are not affected by SSR', async () => {
    const { app } = createApp();
    const res = await request(app).get('/api/ping');

    expect(res.status).toBe(200);
    // The ping controller returns { api: 'ok' } or similar, not affected by SSR
    expect(res.body).toHaveProperty('api');
  });
});
