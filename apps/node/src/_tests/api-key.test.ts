import express from 'express';
import request from 'supertest';

import { createApiKeyMiddleware } from '../infra/http/api-key';

describe('createApiKeyMiddleware (legacy)', () => {
  const originalWarn = console.warn;

  beforeEach(() => {
    console.warn = jest.fn();
  });

  afterEach(() => {
    console.warn = originalWarn;
  });

  const setup = (expectedKey: string) => {
    const app = express();
    app.use(createApiKeyMiddleware(expectedKey));
    app.get('/secure', (_req, res) => res.json({ ok: true }));
    return app;
  };

  it('returns 500 when API key missing in config', async () => {
    const app = setup('');
    const res = await request(app).get('/secure');
    expect(res.status).toBe(500);
    expect(res.body.error).toMatch(/missing api_key/i);
  });

  it('returns 401 when header missing', async () => {
    const app = setup('secret');
    const res = await request(app).get('/secure');
    expect(res.status).toBe(401);
  });

  it('returns 403 when header is wrong', async () => {
    const app = setup('secret');
    const res = await request(app).get('/secure').set('x-api-key', 'bad');
    expect(res.status).toBe(403);
  });

  it('passes through on valid key', async () => {
    const app = setup('secret');
    const res = await request(app).get('/secure').set('x-api-key', 'secret');
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ ok: true });
  });
});
