import express from 'express';
import request from 'supertest';

import { createApiKeyAuthMiddleware } from '../infra/http/express/middleware/api-key-auth.middleware';

describe('api-key-auth.middleware', () => {
  const routeWithMiddleware = (expectedKey: string) => {
    const app = express();
    app.use(createApiKeyAuthMiddleware(expectedKey));
    app.get('/secure', (_req, res) => res.json({ ok: true }));
    return app;
  };

  it('should reject when server is misconfigured (no expected key)', async () => {
    const app = routeWithMiddleware('');
    const res = await request(app).get('/secure');
    expect(res.status).toBe(500);
    expect(res.body).toEqual({ ok: false, error: 'server misconfigured (API_KEY)' });
  });

  it('should reject when no API key is provided', async () => {
    const app = routeWithMiddleware('secret');
    const res = await request(app).get('/secure');
    expect(res.status).toBe(401);
    expect(res.body.error).toMatch(/missing api key/i);
  });

  it('should reject when API key is invalid', async () => {
    const app = routeWithMiddleware('secret');
    const res = await request(app).get('/secure').set('x-api-key', 'bad');
    expect(res.status).toBe(403);
    expect(res.body.error).toMatch(/invalid api key/i);
  });

  it('should allow access when API key is valid', async () => {
    const app = routeWithMiddleware('secret');
    const res = await request(app).get('/secure').set('x-api-key', 'secret');
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ ok: true });
  });
});
