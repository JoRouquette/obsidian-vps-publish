import express from 'express';
import path from 'node:path';

import {
  AbortSessionHandler,
  CreateSessionHandler,
  FinishSessionHandler,
  LoggerPort,
  UploadAssetsHandler,
  UploadNotesHandler,
} from '@core-application';

import { EnvConfig } from '../../config/env-config';
import { AssetsFileSystemStorage } from '../../filesystem/assets-file-system.storage';
import { FileSystemSessionRepository } from '../../filesystem/file-system-session.repository';
import { ManifestFileSystem } from '../../filesystem/manifest-file-system';
import { NotesFileSystemStorage } from '../../filesystem/notes-file-system.storage';
import { UuidIdGenerator } from '../../id/uuid-id.generator';
import { MarkdownItRenderer } from '../../markdown/markdown-it.renderer';

import { createHealthCheckController } from './controllers/health-check.controller';
import { createPingController } from './controllers/ping.controller';
import { createSessionController } from './controllers/session-controller';
import { createApiKeyAuthMiddleware } from './middleware/api-key-auth.middleware';
import { createCorsMiddleware } from './middleware/cors.middleware';

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
