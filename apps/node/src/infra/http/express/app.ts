import path from 'node:path';

import {
  AbortSessionHandler,
  CreateSessionHandler,
  FinishSessionHandler,
  UploadAssetsHandler,
  UploadNotesHandler,
} from '@core-application';
import { type LoggerPort } from '@core-domain';
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
import { SessionFinalizerService } from '../../sessions/session-finalizer.service';
import { createHealthCheckController } from './controllers/health-check.controller';
import { createMaintenanceController } from './controllers/maintenance-controller';
import { createPingController } from './controllers/ping.controller';
import { createSessionController } from './controllers/session-controller';
import { createApiKeyAuthMiddleware } from './middleware/api-key-auth.middleware';
import { ChunkedUploadMiddleware } from './middleware/chunked-upload.middleware';
import { createCorsMiddleware } from './middleware/cors.middleware';

export const BYTES_LIMIT = process.env.MAX_REQUEST_SIZE || '50mb';

export function createApp(rootLogger?: LoggerPort) {
  const app = express();

  app.use(express.json({ limit: BYTES_LIMIT }));

  app.use(createCorsMiddleware(EnvConfig.allowedOrigins()));
  const apiKeyMiddleware = createApiKeyAuthMiddleware(EnvConfig.apiKey());

  const disableCache = (
    _req: express.Request,
    res: express.Response,
    next: express.NextFunction
  ) => {
    res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
    res.setHeader('Pragma', 'no-cache');
    res.setHeader('Expires', '0');
    res.setHeader('Surrogate-Control', 'no-store');
    next();
  };

  // Static assets
  app.use(
    '/assets',
    disableCache,
    express.static(EnvConfig.assetsRoot(), { etag: false, cacheControl: false, maxAge: 0 })
  );
  app.use(
    '/content',
    disableCache,
    express.static(EnvConfig.contentRoot(), { etag: false, cacheControl: false, maxAge: 0 })
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
  const uploadAssetsHandler = new UploadAssetsHandler(assetStorage, rootLogger);
  const createSessionHandler = new CreateSessionHandler(idGenerator, sessionRepository, rootLogger);
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
      rootLogger
    )
  );

  app.use('/api', apiRouter);

  const ANGULAR_DIST = EnvConfig.uiRoot();
  app.use(express.static(ANGULAR_DIST));

  // Log each incoming request
  app.use((req, res, next) => {
    rootLogger?.debug(
      `Incoming request received method: ${req.method}, url: ${req.originalUrl}, ip: ${req.ip}`
    );
    next();
  });

  app.use(createHealthCheckController());

  app.get('/public-config', (req, res) => {
    rootLogger?.debug('Serving public config');
    res.json({
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

  return { app, logger: rootLogger };
}
