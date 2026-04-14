import type { Request, Response } from 'express';

// ─── Minimal types (mirrors ManifestPage from @core-domain) ────────────────
interface SitemapPage {
  route: string;
  noIndex?: boolean;
  lastModifiedAt?: string | Date | null;
  publishedAt?: string | Date | null;
}

interface SitemapManifest {
  pages: SitemapPage[];
}

interface SitemapConfig {
  baseUrl: string;
}

interface CacheEntry {
  xml: string;
  expiresAt: number;
}

// ─── Config ─────────────────────────────────────────────────────────────────
const CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutes

/** Routes always included, regardless of manifest content. */
const STATIC_ENTRIES: ReadonlyArray<{
  route: string;
  priority: string;
  changefreq: string;
}> = [
  { route: '/', priority: '1.0', changefreq: 'weekly' },
  { route: '/search', priority: '0.6', changefreq: 'weekly' },
];

/** Routes explicitly excluded from the sitemap. */
const EXCLUDED_ROUTES = new Set(['/admin', '/offline']);

// ─── In-memory cache (module-scoped, reset on server restart) ───────────────
let cache: CacheEntry | null = null;

// ─── Handler ─────────────────────────────────────────────────────────────────
export async function sitemapHandler(req: Request, res: Response): Promise<void> {
  if (cache && cache.expiresAt > Date.now()) {
    send(res, cache.xml);
    return;
  }

  // Use the origin of the incoming request so that internal fetches
  // (manifest, public-config) resolve correctly behind a reverse proxy.
  const origin = `${req.protocol}://${req.get('host')}`;

  try {
    const [manifest, config] = await Promise.all([
      fetch(`${origin}/content/_manifest.json`).then((r) => r.json() as Promise<SitemapManifest>),
      fetch(`${origin}/public-config`).then((r) => r.json() as Promise<SitemapConfig>),
    ]);

    const baseUrl = config.baseUrl.replace(/\/$/, '');
    const xml = buildSitemapXml(baseUrl, manifest.pages ?? []);

    cache = { xml, expiresAt: Date.now() + CACHE_TTL_MS };
    send(res, xml);
  } catch (err) {
    console.error('[sitemap] generation failed:', err);
    res.status(503).end();
  }
}

function send(res: Response, xml: string): void {
  res.setHeader('Content-Type', 'application/xml; charset=utf-8');
  res.setHeader('Cache-Control', 'public, max-age=300');
  res.send(xml);
}

// ─── XML builder ─────────────────────────────────────────────────────────────
function buildSitemapXml(baseUrl: string, pages: SitemapPage[]): string {
  const urls: string[] = [];

  for (const { route, priority, changefreq } of STATIC_ENTRIES) {
    urls.push(urlEntry(`${baseUrl}${route}`, undefined, priority, changefreq));
  }

  for (const page of pages) {
    if (page.noIndex) continue;
    if (!page.route || EXCLUDED_ROUTES.has(page.route)) continue;

    const lastmod = page.lastModifiedAt ?? page.publishedAt;
    urls.push(urlEntry(`${baseUrl}${page.route}`, lastmod, '0.8', 'monthly'));
  }

  return [
    '<?xml version="1.0" encoding="UTF-8"?>',
    '<urlset xmlns="https://www.sitemaps.org/schemas/sitemap/0.9">',
    ...urls,
    '</urlset>',
  ].join('\n');
}

function urlEntry(
  loc: string,
  lastmod: string | Date | null | undefined,
  priority: string,
  changefreq: string
): string {
  const lastmodStr = lastmod ? toW3CDate(new Date(lastmod)) : '';
  const lastmodTag = lastmodStr ? `\n    <lastmod>${lastmodStr}</lastmod>` : '';

  return `  <url>
    <loc>${escapeXml(loc)}</loc>${lastmodTag}
    <changefreq>${changefreq}</changefreq>
    <priority>${priority}</priority>
  </url>`;
}

function toW3CDate(d: Date): string {
  return Number.isNaN(d.getTime()) ? '' : d.toISOString().slice(0, 10);
}

function escapeXml(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}
