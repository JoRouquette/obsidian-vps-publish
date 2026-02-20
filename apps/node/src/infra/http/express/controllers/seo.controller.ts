import type { Manifest, ManifestPage } from '@core-domain';
import type { LoggerPort } from '@core-domain/ports/logger-port';
import type { NextFunction, Request, Response, Router } from 'express';
import express from 'express';

/**
 * Safely converts a value to a Date object.
 * Handles: Date instances, ISO strings, timestamps, null/undefined
 * Returns null if the value cannot be converted to a valid date.
 */
function toDate(value: unknown): Date | null {
  if (value == null) return null;
  if (value instanceof Date) return isNaN(value.getTime()) ? null : value;
  if (typeof value === 'string' || typeof value === 'number') {
    const d = new Date(value);
    return isNaN(d.getTime()) ? null : d;
  }
  return null;
}

/**
 * Formats a date to ISO date string (YYYY-MM-DD).
 * Returns null if the date is invalid.
 */
function formatDateISO(value: unknown): string | null {
  const d = toDate(value);
  return d ? d.toISOString().split('T')[0] : null;
}

/**
 * Normalizes a route path: ensures leading slash, removes double slashes.
 */
function normalizeRoute(route: string | undefined): string {
  if (!route) return '/';
  // Ensure leading slash, collapse multiple slashes, remove trailing slash except for root
  let normalized = ('/' + route).replace(/\/+/g, '/');
  if (normalized !== '/' && normalized.endsWith('/')) {
    normalized = normalized.slice(0, -1);
  }
  return normalized;
}

/**
 * Creates SEO controller with sitemap.xml and robots.txt endpoints
 */
export function createSeoController(
  manifestLoader: () => Promise<Manifest>,
  baseUrl: string,
  logger?: LoggerPort
): Router {
  const router = express.Router();

  // Normalize baseUrl: remove trailing slash
  const canonicalBaseUrl = baseUrl.replace(/\/+$/, '');

  /**
   * GET /seo/sitemap.xml
   * Generates sitemap.xml dynamically from manifest
   * Uses ETag for caching based on manifest.lastUpdatedAt
   */
  router.get('/sitemap.xml', (req: Request, res: Response, next: NextFunction): void => {
    void (async () => {
      try {
        const manifest = await manifestLoader();

        // Safely get lastUpdatedAt timestamp for ETag (handles both Date and string)
        const lastUpdatedDate = toDate(manifest.lastUpdatedAt);
        const etagTimestamp = lastUpdatedDate?.getTime() ?? Date.now();
        const etag = `W/"sitemap-${etagTimestamp}"`;

        // Check if client has cached version
        if (req.headers['if-none-match'] === etag) {
          logger?.debug('Sitemap cache hit (304)', { etag });
          return res.status(304).end();
        }

        // Filter out pages with noIndex flag
        const indexablePages = (manifest.pages ?? []).filter((p) => !p.noIndex);

        const xml = generateSitemap(indexablePages, canonicalBaseUrl, logger);

        logger?.debug('Sitemap generated', {
          totalPages: manifest.pages?.length ?? 0,
          indexablePages: indexablePages.length,
          etag,
        });

        const headers: Record<string, string> = {
          'Content-Type': 'application/xml; charset=utf-8',
          ETag: etag,
          'Cache-Control': 'public, max-age=3600, s-maxage=86400', // 1h client, 24h CDN
        };

        // Only set Last-Modified if we have a valid date
        if (lastUpdatedDate) {
          headers['Last-Modified'] = lastUpdatedDate.toUTCString();
        }

        res.set(headers);
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
      const robots = generateRobotsTxt(canonicalBaseUrl);

      logger?.debug('Robots.txt served', { baseUrl: canonicalBaseUrl });

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
 * Handles both Date objects and ISO date strings from JSON parsing
 */
function generateSitemap(pages: ManifestPage[], baseUrl: string, logger?: LoggerPort): string {
  const urls = pages
    .filter((p) => {
      // Exclude custom index pages
      if (p.isCustomIndex) return false;
      // Ensure page has a valid route
      const route = normalizeRoute(p.route);
      if (!route) {
        logger?.warn('Skipping page with invalid route', { pageId: p.id, route: p.route });
        return false;
      }
      return true;
    })
    .map((p) => {
      const route = normalizeRoute(p.route);
      const loc = `${baseUrl}${route}`;

      // Try lastModifiedAt, then publishedAt - handle both Date and string
      const lastmod = formatDateISO(p.lastModifiedAt) ?? formatDateISO(p.publishedAt);

      const priority = route === '/' ? '1.0' : '0.8';

      // Build URL entry, omit lastmod if not available
      const lines = [
        `    <loc>${escapeXml(loc)}</loc>`,
        lastmod ? `    <lastmod>${lastmod}</lastmod>` : null,
        `    <changefreq>weekly</changefreq>`,
        `    <priority>${priority}</priority>`,
      ].filter(Boolean);

      return `  <url>\n${lines.join('\n')}\n  </url>`;
    })
    .join('\n');

  return `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${urls}
</urlset>`;
}

/**
 * Generates robots.txt content with sitemap reference
 * Uses canonical URL without /seo/ prefix (redirects handle this)
 */
function generateRobotsTxt(baseUrl: string): string {
  return `User-agent: *
Allow: /
Disallow: /api/
Disallow: /search?*

Sitemap: ${baseUrl}/sitemap.xml
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
