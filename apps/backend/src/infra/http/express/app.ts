import express from 'express';
import path from 'node:path';
import { createAssetsUploadController } from './controllers/assetsUploadController';
import { createPingController } from './controllers/pingController';
import { createNoteUploadController } from './controllers/uploadController';

// Adapters / services
import { AssetsFileSystemStorage } from '../../filesystem/AssetsFileSystemStorage';
import { NotesFileSystemStorage } from '../../filesystem/NotesFileSystemStorage';
import { NotesFileSystem } from '../../filesystem/NotesFileSystem';
import { MarkdownItRenderer } from '../../markdown/MarkdownItRenderer';

import { UploadNotesUseCase } from '../../../application/usecases/UploadNotesUseCase';
import { UploadAssetUseCase } from '../../../application/usecases/UploadAssetUseCase';
import { EnvConfig } from '../../config/EnvConfig';
import { createApiKeyAuthMiddleware } from './middleware/apiKeyAuthMiddleware';
import { createCorsMiddleware } from './middleware/corsMiddleware';
import { LoggerPort } from '../../../application/ports/LoggerPort';
import { createHealthCheckController } from './controllers/healthCheckController';
import { AssetsFileSystem } from '../../filesystem/AssetsFileSystem';

export function createApp(rootLogger?: LoggerPort) {
  const app = express();

  app.use(express.json({ limit: '10mb' })); // à adapter si nécessaire

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
  const noteFileSystem = new NotesFileSystem(EnvConfig.contentRoot(), rootLogger);

  const publishNotesUseCase = new UploadNotesUseCase(
    markdownRenderer,
    noteStorage,
    noteFileSystem,
    rootLogger
  );

  const assetStorage = new AssetsFileSystemStorage(EnvConfig.assetsRoot(), rootLogger);
  const assetIndex = new AssetsFileSystem(EnvConfig.assetsRoot(), rootLogger);
  const uploadAssetUseCase = new UploadAssetUseCase(assetStorage, assetIndex, rootLogger);

  // API routes (protégées par API key)
  const apiRouter = express.Router();
  apiRouter.use(apiKeyMiddleware);

  apiRouter.use(createPingController(rootLogger));
  apiRouter.use(createNoteUploadController(publishNotesUseCase, rootLogger));

  apiRouter.use(createAssetsUploadController(uploadAssetUseCase, rootLogger));

  app.use('/api', apiRouter);

  const ANGULAR_DIST = EnvConfig.uiRoot();
  app.use(express.static(ANGULAR_DIST));

  // Log each incoming request
  app.use((req, res, next) => {
    rootLogger?.info('Incoming request', {
      method: req.method,
      url: req.originalUrl,
      ip: req.ip,
    });
    next();
  });

  app.use(createHealthCheckController());

  app.get('*', (req, res) => {
    rootLogger?.info('Serving Angular index.html for unmatched route', {
      url: req.originalUrl,
    });
    res.sendFile(path.join(ANGULAR_DIST, 'index.html'));
  });

  // Log app ready
  rootLogger?.info('Express app initialized');

  return { app, logger: rootLogger };
}
