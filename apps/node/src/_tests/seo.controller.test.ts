import type { Manifest } from '@core-domain';
import express from 'express';
import request from 'supertest';

import { createSeoController } from '../infra/http/express/controllers/seo.controller';

describe('SEO Controller', () => {
  const mockLogger = {
    child: jest.fn().mockReturnThis(),
    debug: jest.fn(),
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
  };

  const mockManifest: Manifest = {
    sessionId: 'test-session',
    createdAt: new Date('2026-01-01T00:00:00Z'),
    lastUpdatedAt: new Date('2026-01-12T10:00:00Z'),
    pages: [
      {
        id: 'page-1',
        title: 'Home Page',
        slug: 'home' as any,
        route: '/',
        description: 'Home page description',
        publishedAt: new Date('2026-01-10T00:00:00Z'),
      },
      {
        id: 'page-2',
        title: 'About',
        slug: 'about' as any,
        route: '/about',
        description: 'About page',
        publishedAt: new Date('2026-01-11T00:00:00Z'),
        lastModifiedAt: new Date('2026-01-12T08:00:00Z'),
      },
      {
        id: 'page-3',
        title: 'Draft Page',
        slug: 'draft' as any,
        route: '/draft',
        publishedAt: new Date('2026-01-12T00:00:00Z'),
        noIndex: true, // Should be excluded from sitemap
      },
      {
        id: 'page-4',
        title: 'Custom Index',
        slug: 'custom-index' as any,
        route: '/folder',
        publishedAt: new Date('2026-01-12T00:00:00Z'),
        isCustomIndex: true, // Should be excluded from sitemap
      },
    ],
  };

  const manifestLoader = jest.fn().mockResolvedValue(mockManifest);
  const baseUrl = 'https://example.com';

  let app: express.Application;

  beforeEach(() => {
    jest.clearAllMocks();
    app = express();
    const seoRouter = createSeoController(manifestLoader, baseUrl, mockLogger as any);
    app.use('/seo', seoRouter);
  });

  describe('GET /seo/sitemap.xml', () => {
    it('should return valid sitemap XML with 200 status', async () => {
      const response = await request(app).get('/seo/sitemap.xml').expect(200);

      expect(response.headers['content-type']).toContain('application/xml');
      expect(response.text).toContain('<?xml version="1.0" encoding="UTF-8"?>');
      expect(response.text).toContain(
        '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">'
      );
      expect(response.text).toContain('</urlset>');
    });

    it('should include indexable pages in sitemap', async () => {
      const response = await request(app).get('/seo/sitemap.xml').expect(200);

      // Should include home and about pages
      expect(response.text).toContain('<loc>https://example.com/</loc>');
      expect(response.text).toContain('<loc>https://example.com/about</loc>');

      // Home page should have priority 1.0
      expect(response.text).toMatch(
        /<loc>https:\/\/example\.com\/<\/loc>[\s\S]*?<priority>1\.0<\/priority>/
      );

      // Other pages should have priority 0.8
      expect(response.text).toMatch(
        /<loc>https:\/\/example\.com\/about<\/loc>[\s\S]*?<priority>0\.8<\/priority>/
      );
    });

    it('should exclude pages with noIndex flag', async () => {
      const response = await request(app).get('/seo/sitemap.xml').expect(200);

      // Should NOT include draft page
      expect(response.text).not.toContain('/draft');
    });

    it('should exclude custom index pages', async () => {
      const response = await request(app).get('/seo/sitemap.xml').expect(200);

      // Should NOT include custom index
      expect(response.text).not.toContain('/folder');
    });

    it('should use lastModifiedAt when available', async () => {
      const response = await request(app).get('/seo/sitemap.xml').expect(200);

      // About page has lastModifiedAt set to 2026-01-12
      expect(response.text).toContain('<lastmod>2026-01-12</lastmod>');
    });

    it('should fallback to publishedAt when lastModifiedAt is not available', async () => {
      const response = await request(app).get('/seo/sitemap.xml').expect(200);

      // Home page only has publishedAt (2026-01-10)
      expect(response.text).toContain('<lastmod>2026-01-10</lastmod>');
    });

    it('should set proper cache headers', async () => {
      const response = await request(app).get('/seo/sitemap.xml').expect(200);

      expect(response.headers['cache-control']).toContain('public');
      expect(response.headers['cache-control']).toContain('max-age=3600'); // 1 hour
      expect(response.headers['cache-control']).toContain('s-maxage=86400'); // 24 hours CDN
      expect(response.headers.etag).toBeDefined();
      expect(response.headers['last-modified']).toBeDefined();
    });

    it('should return 304 when ETag matches', async () => {
      const firstResponse = await request(app).get('/seo/sitemap.xml').expect(200);
      const etag = firstResponse.headers.etag;

      const secondResponse = await request(app)
        .get('/seo/sitemap.xml')
        .set('If-None-Match', etag)
        .expect(304);

      expect(secondResponse.text).toBe('');
    });

    it('should handle manifest loader errors gracefully', async () => {
      const errorLoader = jest.fn().mockRejectedValue(new Error('Manifest load failed'));
      const errorApp = express();
      const errorRouter = createSeoController(errorLoader, baseUrl, mockLogger as any);
      errorApp.use('/seo', errorRouter);

      await request(errorApp).get('/seo/sitemap.xml').expect(500);

      expect(mockLogger.error).toHaveBeenCalledWith(
        'Failed to generate sitemap',
        expect.any(Object)
      );
    });

    it('should escape XML special characters in URLs', async () => {
      const specialManifest: Manifest = {
        ...mockManifest,
        pages: [
          {
            id: 'special-page',
            title: 'Special & "Characters"',
            slug: 'special' as any,
            route: '/special?query=test&foo=bar',
            publishedAt: new Date('2026-01-10T00:00:00Z'),
          },
        ],
      };
      const specialLoader = jest.fn().mockResolvedValue(specialManifest);
      const specialApp = express();
      const specialRouter = createSeoController(specialLoader, baseUrl, mockLogger as any);
      specialApp.use('/seo', specialRouter);

      const response = await request(specialApp).get('/seo/sitemap.xml').expect(200);

      // XML entities should be escaped
      expect(response.text).toContain('&amp;');
      expect(response.text).not.toContain('&foo'); // Should be &amp;foo
    });
  });

  describe('GET /seo/robots.txt', () => {
    it('should return valid robots.txt with 200 status', async () => {
      const response = await request(app).get('/seo/robots.txt').expect(200);

      expect(response.headers['content-type']).toContain('text/plain');
      expect(response.text).toContain('User-agent: *');
    });

    it('should allow all by default', async () => {
      const response = await request(app).get('/seo/robots.txt').expect(200);

      expect(response.text).toContain('Allow: /');
    });

    it('should disallow API routes', async () => {
      const response = await request(app).get('/seo/robots.txt').expect(200);

      expect(response.text).toContain('Disallow: /api/');
    });

    it('should disallow search queries', async () => {
      const response = await request(app).get('/seo/robots.txt').expect(200);

      expect(response.text).toContain('Disallow: /search?*');
    });

    it('should reference sitemap', async () => {
      const response = await request(app).get('/seo/robots.txt').expect(200);

      expect(response.text).toContain('Sitemap: https://example.com/seo/sitemap.xml');
    });

    it('should set proper cache headers', async () => {
      const response = await request(app).get('/seo/robots.txt').expect(200);

      expect(response.headers['cache-control']).toContain('public');
      expect(response.headers['cache-control']).toContain('max-age=86400'); // 24 hours
    });
  });
});
