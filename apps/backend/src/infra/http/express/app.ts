import express from 'express';
import path from 'node:path';
import { createPingController } from './controllers/pingController';
import { createUploadController } from './controllers/uploadController';
import { createAssetsUploadController } from './controllers/assetsUploadController';

// Adapters / services
import { MarkdownItRenderer } from '../../markdown/MarkdownItRenderer';
import { FileSystemContentStorage } from '../../filesystem/FileSystemContentStorage';
import { FileSystemSiteIndex } from '../../filesystem/FileSystemSiteIndex';
import { FileSystemAssetStorage } from '../../filesystem/FileSystemAssetStorage';

import { PublishNotesUseCase } from '../../../application/usecases/PublishNotesUseCase';
import { UploadAssetUseCase } from '../../../application/usecases/UploadAssetUseCase';
import { EnvConfig } from '../../config/EnvConfig';
import { createCorsMiddleware } from './middleware/corsMiddleware';
import { createApiKeyAuthMiddleware } from './middleware/apiKeyAuthMiddleware';

export function createApp() {
  const app = express();

  app.use(express.json({ limit: '10mb' })); // à adapter si nécessaire

  app.use(createCorsMiddleware(EnvConfig.allowedOrigins()));
  const apiKeyMiddleware = createApiKeyAuthMiddleware(EnvConfig.apiKey());

  // Static assets
  app.use('/assets', express.static(EnvConfig.assetsRoot()));

  // Construct use cases & adapters
  const markdownRenderer = new MarkdownItRenderer();
  const contentStorage = new FileSystemContentStorage(EnvConfig.contentRoot());
  const siteIndex = new FileSystemSiteIndex(EnvConfig.contentRoot());
  const assetStorage = new FileSystemAssetStorage(EnvConfig.assetsRoot());

  const publishNotesUseCase = new PublishNotesUseCase(markdownRenderer, contentStorage, siteIndex);
  const uploadAssetUseCase = new UploadAssetUseCase(assetStorage);

  // API routes (protégées par API key)
  const apiRouter = express.Router();
  apiRouter.use(apiKeyMiddleware);

  apiRouter.use(createPingController());
  apiRouter.use(createUploadController(publishNotesUseCase));
  apiRouter.use(createAssetsUploadController(uploadAssetUseCase));

  app.use('/api', apiRouter);

  return { app, EnvConfig };
}
