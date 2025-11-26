import express from 'express';
import request from 'supertest';

import { createCorsMiddleware } from '../infra/http/express/middleware/cors.middleware';

describe('createCorsMiddleware', () => {
  it('allows configured origin and handles preflight', async () => {
    const app = express();
    app.use(createCorsMiddleware(['https://allowed.dev']));
    app.get('/test', (_req, res) => res.send('ok'));

    const preflight = await request(app)
      .options('/test')
      .set('Origin', 'https://allowed.dev');
    expect(preflight.status).toBe(200);
    expect(preflight.headers['access-control-allow-origin']).toBe('https://allowed.dev');

    const res = await request(app).get('/test').set('Origin', 'https://allowed.dev');
    expect(res.status).toBe(200);
    expect(res.headers['access-control-allow-origin']).toBe('https://allowed.dev');
  });

  it('denies unknown origin but still processes request', async () => {
    const app = express();
    app.use(createCorsMiddleware(['https://allowed.dev']));
    app.get('/test', (_req, res) => res.send('ok'));

    const res = await request(app).get('/test').set('Origin', 'https://evil.dev');
    expect(res.status).toBe(200);
    expect(res.headers['access-control-allow-origin']).toBeUndefined();
  });
});
