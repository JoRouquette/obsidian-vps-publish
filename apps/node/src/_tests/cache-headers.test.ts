/**
 * Cache Headers Tests
 * Validates caching strategy for /content, /assets, and manifest
 */

import fs from 'node:fs/promises';
import path from 'node:path';

import { beforeEach, describe, expect, it, jest } from '@jest/globals';
import express from 'express';
import request from 'supertest';

import { EnvConfig } from '../infra/config/env-config';

describe('Cache Headers Strategy', () => {
  let app: express.Application;
  let testContentRoot: string;
  let testAssetsRoot: string;

  beforeEach(async () => {
    // Create temporary directories for test content
    testContentRoot = path.join(process.cwd(), 'tmp', 'test-cache-content');
    testAssetsRoot = path.join(process.cwd(), 'tmp', 'test-cache-assets');

    await fs.mkdir(testContentRoot, { recursive: true });
    await fs.mkdir(testAssetsRoot, { recursive: true });

    // Create test files
    await fs.writeFile(path.join(testContentRoot, 'test-page.html'), '<html>Test Page</html>');
    await fs.writeFile(path.join(testContentRoot, '_manifest.json'), JSON.stringify({ pages: [] }));
    await fs.writeFile(path.join(testAssetsRoot, 'test-image.png'), 'fake-png-data');

    // Mock EnvConfig
    jest.spyOn(EnvConfig, 'contentRoot').mockReturnValue(testContentRoot);
    jest.spyOn(EnvConfig, 'assetsRoot').mockReturnValue(testAssetsRoot);

    // Create minimal Express app with cache strategy
    app = express();

    // Assets with aggressive caching (immutable)
    app.use(
      '/assets',
      express.static(testAssetsRoot, {
        maxAge: '365d',
        immutable: true,
        etag: true,
      })
    );

    // Content with conditional caching (ETag validation)
    app.use(
      '/content',
      express.static(testContentRoot, {
        etag: true,
        lastModified: true,
        maxAge: '5m',
        cacheControl: true,
        setHeaders: (res, filePath) => {
          if (filePath.endsWith('_manifest.json')) {
            res.setHeader('Cache-Control', 'public, max-age=60, must-revalidate');
          } else if (filePath.endsWith('.html')) {
            res.setHeader('Cache-Control', 'public, max-age=300, must-revalidate');
          }
        },
      })
    );
  });

  describe('/content/*.html - Conditional Caching', () => {
    it('should return 200 with ETag and Cache-Control on first request', async () => {
      const res = await request(app).get('/content/test-page.html');

      expect(res.status).toBe(200);
      expect(res.headers['etag']).toBeDefined();
      expect(res.headers['cache-control']).toBe('public, max-age=300, must-revalidate');
      expect(res.headers['last-modified']).toBeDefined();
    });

    it('should return 304 Not Modified when ETag matches (If-None-Match)', async () => {
      // First request to get ETag
      const firstRes = await request(app).get('/content/test-page.html');
      const etag = firstRes.headers['etag'];

      expect(etag).toBeDefined();

      // Second request with If-None-Match
      const secondRes = await request(app)
        .get('/content/test-page.html')
        .set('If-None-Match', etag);

      expect(secondRes.status).toBe(304);
      expect(secondRes.body).toEqual({}); // No body on 304
    });

    it('should return 304 Not Modified when Last-Modified matches (If-Modified-Since)', async () => {
      // First request to get Last-Modified
      const firstRes = await request(app).get('/content/test-page.html');
      const lastModified = firstRes.headers['last-modified'];

      expect(lastModified).toBeDefined();

      // Second request with If-Modified-Since
      const secondRes = await request(app)
        .get('/content/test-page.html')
        .set('If-Modified-Since', lastModified);

      expect(secondRes.status).toBe(304);
    });

    it('should return 200 with fresh content when ETag does not match', async () => {
      const res = await request(app)
        .get('/content/test-page.html')
        .set('If-None-Match', '"fake-etag-12345"');

      expect(res.status).toBe(200);
      expect(res.text).toContain('Test Page');
    });
  });

  describe('/_manifest.json - Aggressive Revalidation', () => {
    it('should return 200 with shorter cache (60s) and must-revalidate', async () => {
      const res = await request(app).get('/content/_manifest.json');

      expect(res.status).toBe(200);
      expect(res.headers['cache-control']).toBe('public, max-age=60, must-revalidate');
      expect(res.headers['etag']).toBeDefined();
    });

    it('should return 304 when manifest ETag matches', async () => {
      const firstRes = await request(app).get('/content/_manifest.json');
      const etag = firstRes.headers['etag'];

      const secondRes = await request(app)
        .get('/content/_manifest.json')
        .set('If-None-Match', etag);

      expect(secondRes.status).toBe(304);
    });
  });

  describe('/assets/* - Immutable Aggressive Caching', () => {
    it('should return 200 with 1-year cache and immutable directive', async () => {
      const res = await request(app).get('/assets/test-image.png');

      expect(res.status).toBe(200);
      expect(res.headers['cache-control']).toContain('max-age=31536000'); // 365 days in seconds
      expect(res.headers['cache-control']).toContain('immutable');
      expect(res.headers['etag']).toBeDefined();
    });

    it('should still return 304 for assets when ETag matches', async () => {
      const firstRes = await request(app).get('/assets/test-image.png');
      const etag = firstRes.headers['etag'];

      const secondRes = await request(app).get('/assets/test-image.png').set('If-None-Match', etag);

      expect(secondRes.status).toBe(304);
    });
  });

  describe('Cache Strategy Comparison', () => {
    it('should have different max-age for manifest (60s) vs HTML (300s) vs assets (365d)', async () => {
      const manifestRes = await request(app).get('/content/_manifest.json');
      const htmlRes = await request(app).get('/content/test-page.html');
      const assetRes = await request(app).get('/assets/test-image.png');

      // Manifest: 60s
      expect(manifestRes.headers['cache-control']).toContain('max-age=60');

      // HTML: 300s (5 minutes)
      expect(htmlRes.headers['cache-control']).toContain('max-age=300');

      // Assets: 31536000s (365 days)
      expect(assetRes.headers['cache-control']).toContain('max-age=31536000');
    });

    it('should enforce must-revalidate on content but not on immutable assets', async () => {
      const manifestRes = await request(app).get('/content/_manifest.json');
      const htmlRes = await request(app).get('/content/test-page.html');
      const assetRes = await request(app).get('/assets/test-image.png');

      expect(manifestRes.headers['cache-control']).toContain('must-revalidate');
      expect(htmlRes.headers['cache-control']).toContain('must-revalidate');
      expect(assetRes.headers['cache-control']).toContain('immutable'); // immutable = never revalidate
    });
  });
});
