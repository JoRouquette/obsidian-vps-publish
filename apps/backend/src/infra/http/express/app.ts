import express from 'express';
import path from 'node:path';

import { LoggerPort } from '../../../application/ports/LoggerPort';

// Adapters / services
import { AssetsFileSystemStorage } from '../../filesystem/AssetsFileSystemStorage';
import { NotesFileSystemStorage } from '../../filesystem/NotesFileSystemStorage';
import { NotesFileSystem } from '../../filesystem/NotesFileSystem';
import { MarkdownItRenderer } from '../../markdown/MarkdownItRenderer';
import { EnvConfig } from '../../config/EnvConfig';

import { createApiKeyAuthMiddleware } from './middleware/apiKeyAuthMiddleware';
import { createCorsMiddleware } from './middleware/corsMiddleware';
import { createHealthCheckController } from './controllers/healthCheckController';
import { createPingController } from './controllers/pingController';
import { createSessionController } from './controllers/sessionController';

export function createApp(rootLogger?: LoggerPort) {
  const app = express();

  app.use(express.json({ limit: '10mb' }));

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

  const assetStorage = new AssetsFileSystemStorage(EnvConfig.assetsRoot(), rootLogger);

  // API routes (protégées par API key)
  const apiRouter = express.Router();
  apiRouter.use(apiKeyMiddleware);

  apiRouter.use(createPingController(rootLogger));

  //apiRouter.use(createSessionController());

  app.use('/api', apiRouter);

  const ANGULAR_DIST = path.resolve(EnvConfig.uiRoot());
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
