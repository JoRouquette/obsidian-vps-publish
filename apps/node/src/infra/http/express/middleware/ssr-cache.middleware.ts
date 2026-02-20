/**
 * SSR Cache Middleware
 *
 * Provides intelligent caching for Angular SSR responses with:
 * - LRU in-memory cache keyed by normalized URL
 * - Content build ID invalidation (based on manifest hash)
 * - ETag + If-None-Match → 304 responses
 * - Server-Timing headers for debugging
 * - stale-while-revalidate pattern for CDN compatibility
 *
 * @module infra/http/express/middleware/ssr-cache.middleware
 */
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';

import type { LoggerPort } from '@core-domain';
import type { NextFunction, Request, Response } from 'express';

interface CacheEntry {
  html: string;
  etag: string;
  createdAt: number;
  buildId: string;
}

interface SSRCacheConfig {
  /** Maximum number of cached pages */
  maxEntries: number;
  /** Max age in seconds for cache entries (default: 60) */
  maxAgeSeconds: number;
  /** stale-while-revalidate window in seconds (default: 300) */
  staleWhileRevalidateSeconds: number;
  /** Path to content root for manifest hash (build ID) */
  contentRoot: string;
}

/**
 * LRU Cache for SSR responses
 *
 * Uses Map insertion order for LRU eviction (oldest entries removed first).
 */
class LRUCache<K, V> {
  private readonly cache = new Map<K, V>();
  private readonly maxSize: number;

  constructor(maxSize: number) {
    this.maxSize = maxSize;
  }

  get(key: K): V | undefined {
    const value = this.cache.get(key);
    if (value !== undefined) {
      // Move to end (most recently used)
      this.cache.delete(key);
      this.cache.set(key, value);
    }
    return value;
  }

  set(key: K, value: V): void {
    // Remove if exists (to update position)
    this.cache.delete(key);

    // Evict oldest if at capacity
    if (this.cache.size >= this.maxSize) {
      const oldestKey = this.cache.keys().next().value;
      if (oldestKey !== undefined) {
        this.cache.delete(oldestKey);
      }
    }

    this.cache.set(key, value);
  }

  clear(): void {
    this.cache.clear();
  }

  get size(): number {
    return this.cache.size;
  }
}

export class SSRCacheMiddleware {
  private readonly cache: LRUCache<string, CacheEntry>;
  private currentBuildId: string = '';
  private buildIdCheckedAt: number = 0;
  private readonly BUILD_ID_CHECK_INTERVAL_MS = 30000; // Check every 30s

  constructor(
    private readonly config: SSRCacheConfig,
    private readonly logger?: LoggerPort
  ) {
    this.cache = new LRUCache(config.maxEntries);
    this.currentBuildId = this.computeBuildId();
    this.logger?.debug('SSR cache initialized', {
      maxEntries: config.maxEntries,
      maxAgeSeconds: config.maxAgeSeconds,
      staleWhileRevalidateSeconds: config.staleWhileRevalidateSeconds,
      initialBuildId: this.currentBuildId.substring(0, 8),
    });
  }

  /**
   * Compute build ID from manifest hash.
   * Changes when content is republished.
   */
  private computeBuildId(): string {
    try {
      const manifestPath = path.join(this.config.contentRoot, '_manifest.json');
      if (fs.existsSync(manifestPath)) {
        const content = fs.readFileSync(manifestPath, 'utf-8');
        return crypto.createHash('md5').update(content).digest('hex').substring(0, 12);
      }
    } catch {
      // Ignore errors, return empty string
    }
    return '';
  }

  /**
   * Check if build ID changed (cache invalidation trigger).
   */
  private checkBuildIdChange(): boolean {
    const now = Date.now();
    if (now - this.buildIdCheckedAt < this.BUILD_ID_CHECK_INTERVAL_MS) {
      return false;
    }

    this.buildIdCheckedAt = now;
    const newBuildId = this.computeBuildId();

    if (newBuildId !== this.currentBuildId && newBuildId !== '') {
      this.logger?.info('Build ID changed, clearing SSR cache', {
        oldBuildId: this.currentBuildId.substring(0, 8),
        newBuildId: newBuildId.substring(0, 8),
        cacheSize: this.cache.size,
      });
      this.cache.clear();
      this.currentBuildId = newBuildId;
      return true;
    }

    return false;
  }

  /**
   * Normalize URL for cache key.
   * Removes trailing slashes, normalizes path.
   */
  private normalizeUrl(url: string): string {
    // Remove query string for cache key (SPA doesn't use query for content)
    const [pathname] = url.split('?');
    // Normalize: remove trailing slash except for root
    return pathname.replace(/\/+$/, '') || '/';
  }

  /**
   * Generate ETag from HTML content.
   */
  private generateEtag(html: string): string {
    const hash = crypto.createHash('md5').update(html).digest('hex').substring(0, 16);
    return `"${hash}"`;
  }

  /**
   * Create cache wrapper middleware.
   *
   * Wraps the SSR render function to add caching layer.
   *
   * @param renderFn Async function that performs SSR rendering
   */
  createMiddleware(
    renderFn: (req: Request) => Promise<string>
  ): (req: Request, res: Response, next: NextFunction) => Promise<void> {
    return async (req: Request, res: Response, next: NextFunction): Promise<void> => {
      const startTime = process.hrtime.bigint();
      const serverTimings: string[] = [];

      // Check for build ID change (invalidates cache)
      this.checkBuildIdChange();

      const cacheKey = this.normalizeUrl(req.originalUrl);

      // Check if client sent If-None-Match
      const ifNoneMatch = req.headers['if-none-match'];

      // Try to get from cache
      const cached = this.cache.get(cacheKey);
      const cacheAge = cached ? (Date.now() - cached.createdAt) / 1000 : 0;
      const isStale = cached && cacheAge > this.config.maxAgeSeconds;
      const isExpired =
        cached && cacheAge > this.config.maxAgeSeconds + this.config.staleWhileRevalidateSeconds;

      // Build ID mismatch means entry is invalid
      const buildIdValid = cached?.buildId === this.currentBuildId;

      // Handle 304 Not Modified
      if (cached && buildIdValid && ifNoneMatch === cached.etag) {
        const duration = Number(process.hrtime.bigint() - startTime) / 1e6;
        serverTimings.push(`ssr_cache;desc=HIT_304;dur=${duration.toFixed(1)}`);

        res.setHeader('Server-Timing', serverTimings.join(', '));
        res.setHeader('X-SSR-Cache', 'HIT');
        res.setHeader('ETag', cached.etag);
        res.setHeader(
          'Cache-Control',
          `public, max-age=0, s-maxage=${this.config.maxAgeSeconds}, stale-while-revalidate=${this.config.staleWhileRevalidateSeconds}`
        );
        res.status(304).end();

        this.logger?.debug('SSR cache 304', { url: cacheKey, etag: cached.etag });
        return;
      }

      // Cache hit (fresh or stale but usable)
      if (cached && buildIdValid && !isExpired) {
        const duration = Number(process.hrtime.bigint() - startTime) / 1e6;
        const status = isStale ? 'STALE' : 'HIT';
        serverTimings.push(`ssr_cache;desc=${status};dur=${duration.toFixed(1)}`);

        res.setHeader('Server-Timing', serverTimings.join(', '));
        res.setHeader('X-SSR-Cache', status);
        res.setHeader('ETag', cached.etag);
        res.setHeader('Content-Type', 'text/html; charset=utf-8');
        res.setHeader(
          'Cache-Control',
          `public, max-age=0, s-maxage=${this.config.maxAgeSeconds}, stale-while-revalidate=${this.config.staleWhileRevalidateSeconds}`
        );
        res.send(cached.html);

        this.logger?.debug('SSR cache hit', {
          url: cacheKey,
          status,
          ageSeconds: Math.round(cacheAge),
        });

        // Background revalidate if stale
        if (isStale) {
          this.revalidateInBackground(cacheKey, req, renderFn);
        }

        return;
      }

      // Cache miss - perform SSR
      const renderStart = process.hrtime.bigint();
      try {
        const html = await renderFn(req);
        const renderDuration = Number(process.hrtime.bigint() - renderStart) / 1e6;

        serverTimings.push(`ssr;dur=${renderDuration.toFixed(1)}`, 'ssr_cache;desc=MISS');

        const etag = this.generateEtag(html);

        // Store in cache
        this.cache.set(cacheKey, {
          html,
          etag,
          createdAt: Date.now(),
          buildId: this.currentBuildId,
        });

        const totalDuration = Number(process.hrtime.bigint() - startTime) / 1e6;
        serverTimings.push(`total;dur=${totalDuration.toFixed(1)}`);

        res.setHeader('Server-Timing', serverTimings.join(', '));
        res.setHeader('X-SSR-Cache', 'MISS');
        res.setHeader('ETag', etag);
        res.setHeader('Content-Type', 'text/html; charset=utf-8');
        res.setHeader(
          'Cache-Control',
          `public, max-age=0, s-maxage=${this.config.maxAgeSeconds}, stale-while-revalidate=${this.config.staleWhileRevalidateSeconds}`
        );

        res.send(html);

        this.logger?.debug('SSR cache miss', {
          url: cacheKey,
          renderMs: Math.round(renderDuration),
          cacheSize: this.cache.size,
        });
      } catch (error) {
        this.logger?.error('SSR render failed in cache middleware', {
          url: cacheKey,
          error: error instanceof Error ? error.message : String(error),
        });
        next(error);
      }
    };
  }

  /**
   * Revalidate cache entry in background (for stale-while-revalidate pattern).
   */
  private revalidateInBackground(
    cacheKey: string,
    req: Request,
    renderFn: (req: Request) => Promise<string>
  ): void {
    // Fire and forget
    void (async () => {
      try {
        const html = await renderFn(req);
        const etag = this.generateEtag(html);

        this.cache.set(cacheKey, {
          html,
          etag,
          createdAt: Date.now(),
          buildId: this.currentBuildId,
        });

        this.logger?.debug('SSR cache revalidated in background', { url: cacheKey });
      } catch (error) {
        this.logger?.warn('Background revalidation failed', {
          url: cacheKey,
          error: error instanceof Error ? error.message : String(error),
        });
      }
    })();
  }

  /**
   * Get cache stats for debugging/monitoring.
   */
  getStats(): { size: number; buildId: string; maxEntries: number } {
    return {
      size: this.cache.size,
      buildId: this.currentBuildId.substring(0, 8),
      maxEntries: this.config.maxEntries,
    };
  }

  /**
   * Manually clear the cache.
   */
  clear(): void {
    this.cache.clear();
    this.logger?.info('SSR cache manually cleared');
  }
}

/**
 * Create SSR cache middleware with default config.
 */
export function createSSRCacheMiddleware(
  contentRoot: string,
  logger?: LoggerPort,
  options?: Partial<SSRCacheConfig>
): SSRCacheMiddleware {
  return new SSRCacheMiddleware(
    {
      maxEntries: options?.maxEntries ?? 500,
      maxAgeSeconds: options?.maxAgeSeconds ?? 60,
      staleWhileRevalidateSeconds: options?.staleWhileRevalidateSeconds ?? 300,
      contentRoot,
    },
    logger
  );
}
