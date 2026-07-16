import express from 'express';
import request from 'supertest';

import { hashAdminSecret } from '../../../../admin/admin-credential.util';
import { AdminSessionTokenService } from '../../../../admin/admin-session-token.service';
import { createAdminTokenAuthMiddleware } from '../../middleware/admin-token-auth.middleware';
import { createAdminAuthController } from '../admin-auth.controller';

const ADMIN_USER = 'admin';
const ADMIN_PASSWORD = 's3cret-password';

function buildApp() {
  const usernameHash = hashAdminSecret(ADMIN_USER);
  const passwordHash = hashAdminSecret(ADMIN_PASSWORD);
  const tokenService = new AdminSessionTokenService(`${usernameHash}:${passwordHash}`);

  const app = express();
  app.use(express.json());
  app.use(createAdminAuthController({ usernameHash, passwordHash }, tokenService));
  app.use(createAdminTokenAuthMiddleware(tokenService));
  app.get('/summary', (_req, res) => res.status(200).json({ ok: true }));

  return app;
}

describe('admin auth flow', () => {
  it('issues a token for valid credentials in the body', async () => {
    const response = await request(buildApp())
      .post('/login')
      .send({ user: ADMIN_USER, mdp: ADMIN_PASSWORD });

    expect(response.status).toBe(200);
    expect(typeof response.body.token).toBe('string');
    expect(response.body.token.length).toBeGreaterThan(0);
  });

  it('rejects invalid credentials with 403', async () => {
    const response = await request(buildApp())
      .post('/login')
      .send({ user: ADMIN_USER, mdp: 'wrong' });

    expect(response.status).toBe(403);
  });

  it('rejects missing credentials with 401', async () => {
    const response = await request(buildApp()).post('/login').send({});

    expect(response.status).toBe(401);
  });

  it('ignores credentials passed in the query string', async () => {
    const response = await request(buildApp())
      .post(`/login?user=${ADMIN_USER}&mdp=${ADMIN_PASSWORD}`)
      .send({});

    expect(response.status).toBe(401);
  });

  it('blocks protected routes without a bearer token', async () => {
    const response = await request(buildApp()).get('/summary');

    expect(response.status).toBe(401);
  });

  it('allows protected routes with a token obtained from login', async () => {
    const app = buildApp();
    const login = await request(app).post('/login').send({ user: ADMIN_USER, mdp: ADMIN_PASSWORD });
    const token: string = login.body.token;

    const response = await request(app).get('/summary').set('Authorization', `Bearer ${token}`);

    expect(response.status).toBe(200);
    expect(response.body).toEqual({ ok: true });
  });

  it('rejects a protected route when the bearer token is garbage', async () => {
    const response = await request(buildApp())
      .get('/summary')
      .set('Authorization', 'Bearer not.a.valid.token');

    expect(response.status).toBe(401);
  });
});
