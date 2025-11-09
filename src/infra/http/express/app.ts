import express from 'express';
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
  app.use(express.json({ limit: '5mb' }));

  app.use((req, _res, next) => {
    const mask = (s: string) =>
      !s ? '∅' : s.length <= 6 ? '***' : `${s.slice(0, 3)}…${s.slice(-2)}`;
    // console.log(
    //   `[req] ${req.method} ${req.path} origin=${req.headers.origin ?? '∅'} x-api-key=${mask(req.get('x-api-key') ?? '')}`
    // );
    next();
  });

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
