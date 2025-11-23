import express from 'express';
import path from 'node:path';

import { LoggerPort } from '../../../application/ports/LoggerPort';

// Adapters / services
import { UploadAssetsHandler } from '../../../application/publishing/handlers/UploadAssetsHandler';
import { UploadNotesHandler } from '../../../application/publishing/handlers/UploadNotesHandler';
import { AbortSessionHandler } from '../../../application/sessions/handlers/AbortSessionHandler';
import { CreateSessionHandler } from '../../../application/sessions/handlers/CreateSessionHandler';
import { FinishSessionHandler } from '../../../application/sessions/handlers/FinishSessionHandler';
import { EnvConfig } from '../../config/EnvConfig';
import { AssetsFileSystemStorage } from '../../filesystem/AssetsFileSystemStorage';
import { FileSystemSessionRepository } from '../../filesystem/FileSystemSessionRepository';
import { ManifestFileSystem } from '../../filesystem/ManifestFileSystem';
import { NotesFileSystemStorage } from '../../filesystem/NotesFileSystemStorage';
import { UuidIdGenerator } from '../../id/UuidIdGenerator';
import { MarkdownItRenderer } from '../../markdown/MarkdownItRenderer';

import { createHealthCheckController } from './controllers/HealthCheckController';
import { createPingController } from './controllers/PingController';
import { createSessionController } from './controllers/SessionController';

import { createApiKeyAuthMiddleware } from './middleware/apiKeyAuthMiddleware';
import { createCorsMiddleware } from './middleware/corsMiddleware';

export const BYTES_LIMIT = '10mb';

export function createApp(rootLogger?: LoggerPort) {
  const app = express();

  app.use(express.json({ limit: BYTES_LIMIT }));

  app.use(createCorsMiddleware(EnvConfig.allowedOrigins()));
  const apiKeyMiddleware = createApiKeyAuthMiddleware(EnvConfig.apiKey());

  // Static assets
  app.use('/assets', express.static(EnvConfig.assetsRoot()));
  app.use('/content', express.static(EnvConfig.contentRoot()));

  // Log app startup and config
  rootLogger?.info('Initializing Express app', {
    assetsRoot: EnvConfig.assetsRoot(),
    contentRoot: EnvConfig.contentRoot(),
    uiRoot: EnvConfig.uiRoot(),
    loggerLevel: EnvConfig.loggerLevel(),
    allowedOrigins: EnvConfig.allowedOrigins(),
  });

  const markdownRenderer = new MarkdownItRenderer();
  const noteStorage = new NotesFileSystemStorage(EnvConfig.contentRoot(), rootLogger);
  const manifestFileSystem = new ManifestFileSystem(EnvConfig.contentRoot(), rootLogger);
  const assetStorage = new AssetsFileSystemStorage(EnvConfig.assetsRoot(), rootLogger);
  const sessionRepository = new FileSystemSessionRepository(EnvConfig.contentRoot());
  const idGenerator = new UuidIdGenerator();
  const uploadNotesHandler = new UploadNotesHandler(
    markdownRenderer,
    noteStorage,
    manifestFileSystem,
    rootLogger
  );
  const uploadAssetsHandler = new UploadAssetsHandler(assetStorage, rootLogger);
  const createSessionHandler = new CreateSessionHandler(idGenerator, sessionRepository, rootLogger);
  const finishSessionHandler = new FinishSessionHandler(sessionRepository, rootLogger);
  const abortSessionHandler = new AbortSessionHandler(sessionRepository, rootLogger);

  // API routes (protégées par API key)
  const apiRouter = express.Router();
  apiRouter.use(apiKeyMiddleware);

  apiRouter.use(createPingController(rootLogger));

  apiRouter.use(
    createSessionController(
      createSessionHandler,
      finishSessionHandler,
      abortSessionHandler,
      uploadNotesHandler,
      uploadAssetsHandler,
      rootLogger
    )
  );

  app.use('/api', apiRouter);

  const ANGULAR_DIST = EnvConfig.uiRoot();
  app.use(express.static(ANGULAR_DIST));

  // Log each incoming request
  app.use((req, res, next) => {
    rootLogger?.info(
      `Incoming request received method: ${req.method}, url: ${req.originalUrl}, ip: ${req.ip}`
    );
    next();
  });

  app.use(createHealthCheckController());

  app.get('/public-config', (req, res) => {
    rootLogger?.info('Serving public config');
    res.json({
      siteName: EnvConfig.siteName(),
      author: EnvConfig.author(),
      repoUrl: EnvConfig.repoUrl(),
      reportIssuesUrl: EnvConfig.reportIssuesUrl(),
    });
  });

  app.get('*', (req, res) => {
    rootLogger?.info('Serving Angular index.html for unmatched route', {
      url: req.originalUrl,
    });

    const indexPath = path.join(ANGULAR_DIST, 'index.html'); // maintenant absolu
    res.sendFile(indexPath);
  });

  // Log app ready
  rootLogger?.info('Express app initialized');

  return { app, logger: rootLogger };
}
