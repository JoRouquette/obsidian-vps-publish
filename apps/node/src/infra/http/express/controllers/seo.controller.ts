import type { Manifest, ManifestPage } from '@core-domain';
import type { LoggerPort } from '@core-domain/ports/logger-port';
import type { NextFunction, Request, Response, Router } from 'express';
import express from 'express';

/**
 * Creates SEO controller with sitemap.xml and robots.txt endpoints
 */
export function createSeoController(
  manifestLoader: () => Promise<Manifest>,
  baseUrl: string,
  logger?: LoggerPort
): Router {
  const router = express.Router();

  /**
   * GET /seo/sitemap.xml
   * Generates sitemap.xml dynamically from manifest
   * Uses ETag for caching based on manifest.lastUpdatedAt
   */
  router.get('/sitemap.xml', (req: Request, res: Response, next: NextFunction): void => {
    void (async () => {
      try {
        const manifest = await manifestLoader();

        // ETag based on manifest last update timestamp
        const etag = `W/"${manifest.lastUpdatedAt.getTime()}"`;

        // Check if client has cached version
        if (req.headers['if-none-match'] === etag) {
          logger?.debug('Sitemap cache hit (304)', { etag });
          return res.status(304).end();
        }

        // Filter out pages with noIndex flag
        const indexablePages = manifest.pages.filter((p) => !p.noIndex);

        const xml = generateSitemap(indexablePages, baseUrl);

        logger?.debug('Sitemap generated', {
          totalPages: manifest.pages.length,
          indexablePages: indexablePages.length,
          etag,
        });

        res.set({
          'Content-Type': 'application/xml; charset=utf-8',
          ETag: etag,
          'Last-Modified': manifest.lastUpdatedAt.toUTCString(),
          'Cache-Control': 'public, max-age=3600, s-maxage=86400', // 1h client, 24h CDN
        });

        res.send(xml);
      } catch (err) {
        logger?.error('Failed to generate sitemap', {
          error: err instanceof Error ? err.message : String(err),
          stack: err instanceof Error ? err.stack : undefined,
        });
        next(err); // Pass error to Express error handler
      }
    })();
  });

  /**
   * GET /seo/robots.txt
   * Serves robots.txt with sitemap reference
   */
  router.get('/robots.txt', (req: Request, res: Response) => {
    try {
      const robots = generateRobotsTxt(baseUrl);

      logger?.debug('Robots.txt served', { baseUrl });

      res.set({
        'Content-Type': 'text/plain; charset=utf-8',
        'Cache-Control': 'public, max-age=86400', // 24h cache
      });

      res.send(robots);
    } catch (err) {
      logger?.error('Failed to serve robots.txt', {
        error: err instanceof Error ? err.message : String(err),
      });
      res.status(500).send('Internal server error');
    }
  });

  return router;
}

/**
 * Generates sitemap.xml content from manifest pages
 */
function generateSitemap(pages: ManifestPage[], baseUrl: string): string {
  const urls = pages
    .filter((p) => !p.isCustomIndex) // Exclude custom index pages
    .map((p) => {
      const loc = `${baseUrl}${p.route}`;
      // Use lastModifiedAt if available, fallback to publishedAt
      const lastmod = (p.lastModifiedAt || p.publishedAt).toISOString().split('T')[0];
      const priority = p.route === '/' ? '1.0' : '0.8';

      return `  <url>
    <loc>${escapeXml(loc)}</loc>
    <lastmod>${lastmod}</lastmod>
    <changefreq>weekly</changefreq>
    <priority>${priority}</priority>
  </url>`;
    })
    .join('\n');

  return `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${urls}
</urlset>`;
}

/**
 * Generates robots.txt content with sitemap reference
 */
function generateRobotsTxt(baseUrl: string): string {
  return `User-agent: *
Allow: /
Disallow: /api/
Disallow: /search?*

Sitemap: ${baseUrl}/seo/sitemap.xml
`;
}

/**
 * Escapes XML special characters
 */
function escapeXml(str: string): string {
  return str.replace(
    /[<>&'"]/g,
    (c) =>
      ({
        '<': '&lt;',
        '>': '&gt;',
        '&': '&amp;',
        "'": '&apos;',
        '"': '&quot;',
      })[c] || c
  );
}
