/**
 * Angular SSR Service
 *
 * Provides server-side rendering for Angular routes using @angular/ssr CommonEngine.
 * Uses dynamic import to load ESM Angular SSR modules from CommonJS backend.
 *
 * Features:
 * - Lazy initialization of SSR engine
 * - Server-Timing headers for performance debugging
 * - Graceful fallback to static index.html on errors
 *
 * @module infra/ssr/angular-ssr.service
 */
import path from 'node:path';

import type { LoggerPort } from '@core-domain';
import type { NextFunction, Request, Response } from 'express';

import {
  createSSRCacheMiddleware,
  SSRCacheMiddleware,
} from '../http/express/middleware/ssr-cache.middleware';

// Types for Angular SSR (dynamically imported)
interface CommonEngine {
  render(options: {
    bootstrap: unknown;
    documentFilePath: string;
    url: string;
    publicPath: string;
    providers: Array<{ provide: unknown; useValue: unknown }>;
  }): Promise<string>;
}

interface AngularSSRConfig {
  /** Path to the Angular SSR server dist folder (contains main.server.mjs, index.server.html) */
  serverDistPath: string;
  /** Path to the Angular browser dist folder (static assets) */
  browserDistPath: string;
  /** Whether SSR is enabled (can be disabled for debugging) */
  enabled: boolean;
  /** Path to content root for cache invalidation (manifest hash) */
  contentRoot?: string;
  /** Whether to enable SSR caching */
  cacheEnabled?: boolean;
  /** Maximum cached pages */
  cacheMaxEntries?: number;
}

/**
 * Service for rendering Angular routes server-side.
 *
 * Handles:
 * - Lazy loading of Angular SSR engine (ESM dynamic import)
 * - Server-side rendering with proper error handling
 * - SSR caching with stale-while-revalidate pattern
 * - Fallback to static index.html on SSR failure
 */
export class AngularSSRService {
  private commonEngine: CommonEngine | null = null;
  private bootstrap: unknown = null;
  private indexServerHtml: string = '';
  private initialized = false;
  private initPromise: Promise<void> | null = null;
  private ssrCache: SSRCacheMiddleware | null = null;

  constructor(
    private readonly config: AngularSSRConfig,
    private readonly logger?: LoggerPort
  ) {
    // Initialize cache if enabled and content root is provided
    if (config.cacheEnabled !== false && config.contentRoot) {
      this.ssrCache = createSSRCacheMiddleware(config.contentRoot, logger, {
        maxEntries: config.cacheMaxEntries ?? 500,
      });
    }
  }

  /**
   * Initialize the SSR engine lazily.
   * Uses dynamic import to load ESM modules from CommonJS context.
   */
  async initialize(): Promise<void> {
    if (this.initialized) return;
    if (this.initPromise) return this.initPromise;

    this.initPromise = this.doInitialize();
    return this.initPromise;
  }

  private async doInitialize(): Promise<void> {
    if (!this.config.enabled) {
      this.logger?.info('Angular SSR is disabled');
      return;
    }

    try {
      this.logger?.debug('Initializing Angular SSR engine', {
        serverDistPath: this.config.serverDistPath,
        browserDistPath: this.config.browserDistPath,
      });

      // Dynamic import of ESM modules from CommonJS
      // The Angular SSR build outputs ESM modules (.mjs files)
      const ssrModulePath = path.join(this.config.serverDistPath, 'main.server.mjs');
      const engineModulePath = '@angular/ssr/node';

      // Import Angular SSR CommonEngine (ESM)
      const { CommonEngine } = (await import(engineModulePath)) as {
        CommonEngine: new () => CommonEngine;
      };
      this.commonEngine = new CommonEngine();

      // Import the Angular bootstrap function from the server build
      // This is the compiled version of main.server.ts
      const ssrModule = await import(/* webpackIgnore: true */ ssrModulePath);
      this.bootstrap = ssrModule.default;

      // Path to index.server.html template
      this.indexServerHtml = path.join(this.config.serverDistPath, 'index.server.html');

      this.initialized = true;
      this.logger?.info('Angular SSR engine initialized successfully');
    } catch (error) {
      this.logger?.error('Failed to initialize Angular SSR engine', {
        error: error instanceof Error ? error.message : String(error),
        stack: error instanceof Error ? error.stack : undefined,
      });
      // SSR will be disabled, fallback to static serving
      this.initialized = true; // Mark as initialized to prevent retry loops
    }
  }

  /**
   * Check if SSR is available and ready.
   */
  isReady(): boolean {
    return this.initialized && this.commonEngine !== null && this.bootstrap !== null;
  }

  /**
   * Render a route using Angular SSR.
   *
   * @param req Express request
   * @returns Rendered HTML string
   * @throws Error if SSR fails
   */
  async render(req: Request): Promise<string> {
    if (!this.isReady()) {
      throw new Error('Angular SSR engine not initialized');
    }

    const url = `${req.protocol}://${req.get('host')}${req.originalUrl}`;

    this.logger?.debug('SSR rendering', { url });

    // APP_BASE_HREF token from @angular/common
    const { APP_BASE_HREF } = await import('@angular/common');

    const html = await this.commonEngine!.render({
      bootstrap: this.bootstrap,
      documentFilePath: this.indexServerHtml,
      url,
      publicPath: this.config.browserDistPath,
      providers: [{ provide: APP_BASE_HREF, useValue: req.baseUrl || '/' }],
    });

    return html;
  }

  /**
   * Express middleware for SSR rendering.
   *
   * Falls back to serving static index.html on SSR failure.
   * Uses SSR cache when enabled for improved performance.
   *
   * @param fallbackIndexPath Path to static index.html for fallback
   */
  middleware(fallbackIndexPath: string) {
    // Create the base render function
    const renderFn = async (req: Request): Promise<string> => {
      return this.render(req);
    };

    // Create cached middleware if cache is available
    const cachedMiddleware = this.ssrCache?.createMiddleware(renderFn);

    return async (req: Request, res: Response, next: NextFunction): Promise<void> => {
      // Initialize on first request (lazy loading)
      await this.initialize();

      // If SSR is not available, fallback to static serving
      if (!this.isReady()) {
        this.logger?.debug('SSR not available, serving static index.html', {
          url: req.originalUrl,
        });
        res.sendFile(fallbackIndexPath);
        return;
      }

      // Use cached middleware if available
      if (cachedMiddleware) {
        try {
          await cachedMiddleware(req, res, next);
          return;
        } catch (error) {
          this.logger?.error('SSR cache middleware failed, falling back to static index.html', {
            url: req.originalUrl,
            error: error instanceof Error ? error.message : String(error),
          });
          res.sendFile(fallbackIndexPath);
          return;
        }
      }

      // Direct SSR without cache
      const startTime = process.hrtime.bigint();
      try {
        const html = await this.render(req);
        const duration = Number(process.hrtime.bigint() - startTime) / 1e6;

        // Set appropriate headers for SSR response
        res.setHeader('Content-Type', 'text/html; charset=utf-8');
        res.setHeader(
          'Cache-Control',
          'public, max-age=0, s-maxage=60, stale-while-revalidate=300'
        );
        res.setHeader('Server-Timing', `ssr;dur=${duration.toFixed(1)}`);

        res.send(html);
      } catch (error) {
        this.logger?.error('SSR rendering failed, falling back to static index.html', {
          url: req.originalUrl,
          error: error instanceof Error ? error.message : String(error),
          stack: error instanceof Error ? error.stack : undefined,
        });

        // Fallback to static SPA on SSR error
        res.sendFile(fallbackIndexPath);
      }
    };
  }

  /**
   * Get cache stats for debugging/monitoring.
   */
  getCacheStats(): { size: number; buildId: string; maxEntries: number } | null {
    return this.ssrCache?.getStats() ?? null;
  }
}

/**
 * Create Angular SSR service from environment config.
 *
 * @param serverDistPath Path to Angular SSR server dist folder
 * @param browserDistPath Path to Angular browser dist folder
 * @param enabled Whether SSR is enabled
 * @param logger Logger instance
 * @param contentRoot Path to content root (for cache invalidation)
 * @param cacheEnabled Whether to enable SSR response caching
 */
export function createAngularSSRService(
  serverDistPath: string,
  browserDistPath: string,
  enabled: boolean,
  logger?: LoggerPort,
  contentRoot?: string,
  cacheEnabled = true
): AngularSSRService {
  return new AngularSSRService(
    {
      serverDistPath,
      browserDistPath,
      enabled,
      contentRoot,
      cacheEnabled,
    },
    logger
  );
}
