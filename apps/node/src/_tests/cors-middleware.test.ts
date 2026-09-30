import express from 'express';
import request from 'supertest';

import {
  allowObsidianDesktopOrigin,
  createCorsMiddleware,
  OBSIDIAN_DESKTOP_ORIGIN,
} from '../infra/http/express/middleware/cors.middleware';

describe('createCorsMiddleware', () => {
  it('allows configured origin and handles preflight', async () => {
    const app = express();
    app.use(createCorsMiddleware(['https://allowed.dev']));
    app.get('/test', (_req, res) => res.send('ok'));

    const preflight = await request(app).options('/test').set('Origin', 'https://allowed.dev');
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

  // A cacheable body varies with the origin even on a request that carries none.
  // Setting Vary only on the allowed branch let a copy be stored without it and
  // later served to Obsidian stripped of its allow-origin header — reproducing
  // the very failure this middleware exists to prevent.
  it('marks the response as varying on Origin even when the origin is refused', async () => {
    const app = express();
    app.use(createCorsMiddleware(['https://allowed.dev']));
    app.get('/test', (_req, res) => res.send('ok'));

    const refused = await request(app).get('/test').set('Origin', 'https://evil.dev');
    expect(refused.headers['vary']).toContain('Origin');

    const noOrigin = await request(app).get('/test');
    expect(noOrigin.headers['vary']).toContain('Origin');
    expect(noOrigin.headers['access-control-allow-origin']).toBeUndefined();
  });

  // The global middleware must NOT know about Obsidian: the operator keeps the
  // right to refuse every cross-origin read by leaving ALLOWED_ORIGINS empty.
  // The allowance belongs to the finalization stream route alone.
  it('does not allow the Obsidian origin globally', async () => {
    const app = express();
    app.use(createCorsMiddleware([]));
    app.get('/test', (_req, res) => res.send('ok'));

    const res = await request(app).get('/test').set('Origin', OBSIDIAN_DESKTOP_ORIGIN);
    expect(res.headers['access-control-allow-origin']).toBeUndefined();
  });
});

describe('allowObsidianDesktopOrigin', () => {
  const appWith = (handler = (_req: express.Request, res: express.Response) => res.send('ok')) => {
    const app = express();
    app.get('/stream', allowObsidianDesktopOrigin, handler);
    return app;
  };

  it('allows the Obsidian desktop origin with nothing configured', async () => {
    const res = await request(appWith()).get('/stream').set('Origin', OBSIDIAN_DESKTOP_ORIGIN);

    expect(res.status).toBe(200);
    expect(res.headers['access-control-allow-origin']).toBe(OBSIDIAN_DESKTOP_ORIGIN);
    expect(res.headers['vary']).toContain('Origin');
  });

  // The whole safety argument rests on this: without Allow-Credentials, no cookie
  // or ambient credential travels or becomes readable cross-origin. Nothing else
  // in the codebase records that invariant, so it is pinned here.
  it('never emits Access-Control-Allow-Credentials', async () => {
    const res = await request(appWith()).get('/stream').set('Origin', OBSIDIAN_DESKTOP_ORIGIN);

    expect(res.headers['access-control-allow-credentials']).toBeUndefined();
  });

  it('marks the response as varying on Origin whatever the origin', async () => {
    const other = await request(appWith()).get('/stream').set('Origin', 'https://evil.dev');
    expect(other.headers['vary']).toContain('Origin');
    expect(other.headers['access-control-allow-origin']).toBeUndefined();

    const none = await request(appWith()).get('/stream');
    expect(none.headers['vary']).toContain('Origin');
    expect(none.headers['access-control-allow-origin']).toBeUndefined();
  });

  // Guards a future implementation tempted by a prefix match or a regex. Against
  // the current strict equality these all fail for free; they earn their keep the
  // day someone "relaxes" the comparison.
  it.each([
    ['a lookalike suffix', 'app://obsidian.md.evil.com'],
    ['a different app origin', 'app://evil.md'],
    ['a trailing slash', 'app://obsidian.md/'],
    ['a different case', 'APP://OBSIDIAN.MD'],
  ])('refuses %s', async (_label, origin) => {
    const res = await request(appWith()).get('/stream').set('Origin', origin);

    expect(res.headers['access-control-allow-origin']).toBeUndefined();
  });
});
