import express from 'express';
import path from 'node:path';
import { createAssetsUploadController } from './controllers/assetsUploadController';
import { createPingController } from './controllers/pingController';
import { createUploadController } from './controllers/uploadController';

// Adapters / services
import { FileSystemAssetStorage } from '../../filesystem/FileSystemAssetStorage';
import { FileSystemContentStorage } from '../../filesystem/FileSystemContentStorage';
import { FileSystemSiteIndex } from '../../filesystem/FileSystemSiteIndex';
import { MarkdownItRenderer } from '../../markdown/MarkdownItRenderer';

import { PublishNotesUseCase } from '../../../application/usecases/PublishNotesUseCase';
import { UploadAssetUseCase } from '../../../application/usecases/UploadAssetUseCase';
import { EnvConfig } from '../../config/EnvConfig';
import { createApiKeyAuthMiddleware } from './middleware/apiKeyAuthMiddleware';
import { createCorsMiddleware } from './middleware/corsMiddleware';
import { LoggerPort } from '../../../application/ports/LoggerPort';
import { createHealthCheckController } from './controllers/healthCheckController';

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
  const contentStorage = new FileSystemContentStorage(
    EnvConfig.contentRoot(),
    rootLogger?.child({ adapter: 'FileSystemContentStorage' })
  );
  const siteIndex = new FileSystemSiteIndex(
    EnvConfig.contentRoot(),
    rootLogger?.child({ adapter: 'FileSystemSiteIndex' })
  );
  const assetStorage = new FileSystemAssetStorage(
    EnvConfig.assetsRoot(),
    rootLogger?.child({ adapter: 'FileSystemAssetStorage' })
  );

  const publishNotesUseCase = new PublishNotesUseCase(
    markdownRenderer,
    contentStorage,
    siteIndex,
    rootLogger?.child({ useCase: 'PublishNotesUseCase' })
  );
  const uploadAssetUseCase = new UploadAssetUseCase(
    assetStorage,
    rootLogger?.child({ useCase: 'UploadAssetUseCase' })
  );

  // API routes (protégées par API key)
  const apiRouter = express.Router();
  apiRouter.use(apiKeyMiddleware);

  apiRouter.use(createPingController(rootLogger?.child({ controller: 'pingController' })));
  apiRouter.use(
    createUploadController(
      publishNotesUseCase,
      rootLogger?.child({ controller: 'uploadController' })
    )
  );
  apiRouter.use(
    createAssetsUploadController(
      uploadAssetUseCase,
      rootLogger?.child({ controller: 'assetsUploadController' })
    )
  );

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

  app.use(createHealthCheckController(rootLogger?.child({ controller: 'healthCheckController' })));

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
