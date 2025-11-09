import express from 'express';
import cors from 'cors';
import type { PublishNotesUseCase } from '../../../application/usecases/PublishNotesUseCase';
import { createUploadController } from './controllers/uploadController';
import { createApiKeyAuthMiddleware } from './middleware/apiKeyAuth';

export interface CreateAppOptions {
  apiKey: string;
  publishNotesUseCase: PublishNotesUseCase;
}

export function createApp(options: CreateAppOptions) {
  const app = express();

  app.set('trust proxy', true);
  app.use(express.json());

  app.use(
    cors({
      origin(origin, callback) {
        if (origin === 'app://obsidian.md') {
          return callback(null, true);
        }

        return callback(new Error('CORS_NOT_ALLOWED'), false);
      },
    })
  );

  const apiBase = '/api';

  app.get(`${apiBase}/ping`, (_req, res) => {
    res.json({
      ok: true,
      service: 'personal-publish',
      version: '1.0.0',
      timestamp: new Date().toISOString(),
    });
  });

  const apiKeyAuth = createApiKeyAuthMiddleware(options.apiKey);
  const uploadController = createUploadController(options.publishNotesUseCase);

  app.post(`${apiBase}/upload`, apiKeyAuth, uploadController);

  app.use(`${apiBase}`, (_req, res) => {
    res.status(404).json({ ok: false, error: 'Not found' });
  });

  return app;
}
