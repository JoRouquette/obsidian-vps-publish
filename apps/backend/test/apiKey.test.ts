import request from 'supertest';
import express from 'express';
import { createApiKeyMiddleware } from '../src/infra/http/apiKey';

describe('apiKey middleware', () => {
  it('should reject when missing or invalid', async () => {
    const app = express();
    app.get('/test', createApiKeyMiddleware('secret'), (req, res) => res.json({ ok: true }));

    await request(app).get('/test').expect(401);
    await request(app).get('/test').set('x-api-key', 'wrong').expect(401);
  });

  it('should pass with valid key', async () => {
    const app = express();
    app.get('/test', createApiKeyMiddleware('secret'), (req, res) => res.json({ ok: true }));

    await request(app).get('/test').set('x-api-key', 'secret').expect(200);
  });
});
