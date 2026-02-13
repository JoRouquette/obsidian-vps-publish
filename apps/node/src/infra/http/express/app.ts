import path from 'node:path';

import {
  AbortSessionHandler,
  CreateSessionHandler,
  FinishSessionHandler,
  UploadAssetsHandler,
  UploadNotesHandler,
} from '@core-application';
import { type LoggerPort, type Manifest } from '@core-domain';
import compression from 'compression';
import express from 'express';

import { EnvConfig } from '../../config/env-config';
import { AssetsFileSystemStorage } from '../../filesystem/assets-file-system.storage';
import { FileSystemSessionRepository } from '../../filesystem/file-system-session.repository';
import { ManifestFileSystem } from '../../filesystem/manifest-file-system';
import { NotesFileSystemStorage } from '../../filesystem/notes-file-system.storage';
import { SessionNotesFileStorage } from '../../filesystem/session-notes-file.storage';
import { StagingManager } from '../../filesystem/staging-manager';
import { UuidIdGenerator } from '../../id/uuid-id.generator';
import { CalloutRendererService } from '../../markdown/callout-renderer.service';
import { MarkdownItRenderer } from '../../markdown/markdown-it.renderer';
import { ClamAVAssetScanner } from '../../security/clamav-asset-scanner';
import { NoopAssetScanner } from '../../security/noop-asset-scanner';
import { SessionFinalizationJobService } from '../../sessions/session-finalization-job.service';
import { SessionFinalizerService } from '../../sessions/session-finalizer.service';
import { AssetHashService } from '../../utils/asset-hash.service';
import { FileTypeAssetValidator } from '../../validation/file-type-asset-validator';
import { createHealthCheckController } from './controllers/health-check.controller';
import { createMaintenanceController } from './controllers/maintenance-controller';
import { createPingController } from './controllers/ping.controller';
import { createSeoController } from './controllers/seo.controller';
import { createSessionController } from './controllers/session-controller';
import { createApiKeyAuthMiddleware } from './middleware/api-key-auth.middleware';
import { BackpressureMiddleware } from './middleware/backpressure.middleware';
import { ChunkedUploadMiddleware } from './middleware/chunked-upload.middleware';
import { createCorsMiddleware } from './middleware/cors.middleware';
import { PerformanceMonitoringMiddleware } from './middleware/performance-monitoring.middleware';
import { createRedirectMiddleware } from './middleware/redirect.middleware';
import { RequestCorrelationMiddleware } from './middleware/request-correlation.middleware';

export const BYTES_LIMIT = process.env.MAX_REQUEST_SIZE || '50mb';

export function createApp(rootLogger?: LoggerPort) {
  const app = express();

  // Initialize request correlation (must be first for request ID generation)
  const requestCorrelation = new RequestCorrelationMiddleware(rootLogger);
  app.use(requestCorrelation.handle());

  // Initialize backpressure protection (before performance monitoring)
  const backpressure = new BackpressureMiddleware(
    {
      maxEventLoopLagMs: 200,
      maxMemoryUsageMB: 500,
      maxActiveRequests: EnvConfig.maxActiveRequests(),
    },
    rootLogger
  );
  app.use(backpressure.handle());

  // Initialize performance monitoring
  const perfMonitor = new PerformanceMonitoringMiddleware(rootLogger);
  app.use(perfMonitor.handle());

  // Enable compression for all responses (gzip/deflate)
  app.use(
    compression({
      level: 6, // Balance between speed and compression ratio
      threshold: 1024, // Only compress responses > 1KB
      filter: (req, res) => {
        // Don't compress if the client doesn't support it
        if (req.headers['x-no-compression']) {
          return false;
        }
        // Use default compression filter
        return compression.filter(req, res);
      },
    })
  );

  // Optimize JSON parsing
  app.use(
    express.json({
      limit: BYTES_LIMIT,
      strict: true, // Only parse objects and arrays
    })
  );

  // Disable X-Powered-By header for security
  app.disable('x-powered-by');

  app.use(createCorsMiddleware(EnvConfig.allowedOrigins()));
  const apiKeyMiddleware = createApiKeyAuthMiddleware(EnvConfig.apiKey());

  // Note: Removed disableCache middleware (no longer needed after conditional caching implementation)

  // Static assets with aggressive caching (immutable content)
  app.use(
    '/assets',
    express.static(EnvConfig.assetsRoot(), {
      etag: true,
      lastModified: true,
      maxAge: '365d', // Cache assets for 1 year
      immutable: true, // Assets never change
    })
  );

  // Content with conditional caching (ETag validation)
  // Enable ETags for content files but keep short max-age for freshness
  app.use(
    '/content',
    express.static(EnvConfig.contentRoot(), {
      etag: true, // Enable ETag for conditional requests (If-None-Match)
      lastModified: true, // Enable Last-Modified for conditional requests (If-Modified-Since)
      maxAge: '5m', // Cache for 5 minutes, then revalidate
      cacheControl: true, // Send Cache-Control header
      setHeaders: (res, filePath) => {
        // Special handling for manifest: shorter cache + must-revalidate
        if (filePath.endsWith('_manifest.json')) {
          res.setHeader('Cache-Control', 'public, max-age=60, must-revalidate');
        }
        // HTML content: moderate cache with revalidation
        else if (filePath.endsWith('.html')) {
          res.setHeader('Cache-Control', 'public, max-age=300, must-revalidate');
        }
      },
    })
  );

  // UI files with moderate caching (versioned via deployment)
  const ANGULAR_DIST = EnvConfig.uiRoot();
  app.use(
    express.static(ANGULAR_DIST, {
      etag: true,
      lastModified: true,
      maxAge: '1h', // Cache UI for 1 hour
      setHeaders: (res, filePath) => {
        // Cache index.html for only 5 minutes (entry point)
        if (filePath.endsWith('index.html')) {
          res.setHeader('Cache-Control', 'public, max-age=300');
        }
      },
    })
  );

  // Log app startup and config
  rootLogger?.debug('Initializing Express app', {
    assetsRoot: EnvConfig.assetsRoot(),
    contentRoot: EnvConfig.contentRoot(),
    uiRoot: EnvConfig.uiRoot(),
    loggerLevel: EnvConfig.loggerLevel(),
    allowedOrigins: EnvConfig.allowedOrigins(),
  });

  const calloutRenderer = new CalloutRendererService();
  const markdownRenderer = new MarkdownItRenderer(calloutRenderer, rootLogger);
  const stagingManager = new StagingManager(
    EnvConfig.contentRoot(),
    EnvConfig.assetsRoot(),
    rootLogger
  );
  const sessionNotesStorage = new SessionNotesFileStorage(EnvConfig.contentRoot(), rootLogger);
  const noteStorage = (sessionId: string) =>
    new NotesFileSystemStorage(stagingManager.contentStagingPath(sessionId), rootLogger);
  const manifestFileSystem = (sessionId: string) =>
    new ManifestFileSystem(stagingManager.contentStagingPath(sessionId), rootLogger);
  // Production manifest (for reading existing asset hashes in CreateSessionHandler)
  const productionManifest = new ManifestFileSystem(EnvConfig.contentRoot(), rootLogger);
  const assetStorage = (sessionId: string) =>
    new AssetsFileSystemStorage(stagingManager.assetsStagingPath(sessionId), rootLogger);
  const sessionRepository = new FileSystemSessionRepository(EnvConfig.contentRoot());
  const idGenerator = new UuidIdGenerator();
  const uploadNotesHandler = new UploadNotesHandler(
    markdownRenderer,
    noteStorage,
    manifestFileSystem,
    rootLogger,
    sessionNotesStorage
  );

  // Initialize asset scanner (Noop by default, ClamAV if enabled)
  const assetScanner = EnvConfig.virusScannerEnabled()
    ? new ClamAVAssetScanner(
        {
          host: EnvConfig.clamavHost(),
          port: EnvConfig.clamavPort(),
          timeout: EnvConfig.clamavTimeout(),
        },
        rootLogger
      )
    : new NoopAssetScanner(rootLogger);

  const assetValidator = new FileTypeAssetValidator(assetScanner, rootLogger);
  const assetHasher = new AssetHashService();
  const maxAssetSizeBytes = EnvConfig.maxAssetSizeBytes();
  const uploadAssetsHandler = new UploadAssetsHandler(
    assetStorage,
    manifestFileSystem,
    assetHasher,
    assetValidator,
    maxAssetSizeBytes,
    rootLogger
  );
  const createSessionHandler = new CreateSessionHandler(
    idGenerator,
    sessionRepository,
    productionManifest,
    rootLogger
  );
  const finishSessionHandler = new FinishSessionHandler(sessionRepository, rootLogger);
  const abortSessionHandler = new AbortSessionHandler(sessionRepository, rootLogger);
  const sessionFinalizer = new SessionFinalizerService(
    sessionNotesStorage,
    stagingManager,
    markdownRenderer,
    noteStorage,
    manifestFileSystem,
    sessionRepository,
    rootLogger
  );

  const finalizationJobService = new SessionFinalizationJobService(
    sessionFinalizer,
    stagingManager,
    rootLogger,
    EnvConfig.maxConcurrentFinalizationJobs()
  );

  // Cleanup old jobs every 10 minutes
  setInterval(
    () => {
      finalizationJobService.cleanupOldJobs(3600000); // 1 hour
    },
    10 * 60 * 1000
  );

  // API routes (protégées par API key)
  const apiRouter = express.Router();
  apiRouter.use(apiKeyMiddleware);

  // Chunked upload middleware (must be before session controller)
  const chunkedUploadMiddleware = new ChunkedUploadMiddleware(rootLogger);
  apiRouter.use(chunkedUploadMiddleware.handle());

  apiRouter.use(createPingController(rootLogger));

  apiRouter.use(createMaintenanceController(stagingManager, rootLogger));

  apiRouter.use(
    createSessionController(
      createSessionHandler,
      finishSessionHandler,
      abortSessionHandler,
      uploadNotesHandler,
      uploadAssetsHandler,
      sessionFinalizer,
      stagingManager,
      calloutRenderer,
      finalizationJobService,
      sessionRepository,
      rootLogger
    )
  );

  // Log incoming requests (before routes for accurate timing)
  app.use((req, res, next) => {
    const startTime = Date.now();
    res.on('finish', () => {
      const duration = Date.now() - startTime;
      rootLogger?.debug('Request completed', {
        method: req.method,
        url: req.originalUrl,
        status: res.statusCode,
        duration: `${duration}ms`,
        ip: req.ip,
      });
    });
    next();
  });

  app.use('/api', apiRouter);

  // SEO routes (sitemap.xml, robots.txt)
  const manifestLoader = async (): Promise<Manifest> => {
    const fs = await import('fs/promises');
    const manifestPath = path.join(EnvConfig.contentRoot(), '_manifest.json');
    const raw = await fs.readFile(manifestPath, 'utf-8');
    return JSON.parse(raw) as Manifest;
  };

  const seoRouter = createSeoController(manifestLoader, EnvConfig.baseUrl(), rootLogger);
  app.use('/seo', seoRouter);

  // Redirect middleware (301 redirects from canonicalMap)
  // Must be BEFORE Angular routing to intercept old routes
  app.use(createRedirectMiddleware(manifestLoader, rootLogger));

  app.use(
    createHealthCheckController(
      {
        backpressure,
        perfMonitor,
      },
      rootLogger
    )
  );

  app.get('/public-config', (req, res) => {
    rootLogger?.debug('Serving public config');
    res.json({
      baseUrl: EnvConfig.baseUrl(),
      siteName: EnvConfig.siteName(),
      author: EnvConfig.author(),
      repoUrl: EnvConfig.repoUrl(),
      reportIssuesUrl: EnvConfig.reportIssuesUrl(),
      homeWelcomeTitle: EnvConfig.homeWelcomeTitle(),
    });
  });

  app.get('*', (req, res) => {
    rootLogger?.debug('Serving Angular index.html for unmatched route', {
      url: req.originalUrl,
    });

    const indexPath = path.join(ANGULAR_DIST, 'index.html'); // maintenant absolu
    res.sendFile(indexPath);
  });

  // Log app ready
  rootLogger?.debug('Express app initialized');

  return { app, logger: rootLogger, perfMonitor };
}
