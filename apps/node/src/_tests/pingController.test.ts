import express from 'express';
import request from 'supertest';

import { createPingController } from '../infra/http/express/controllers/pingController';

describe('createPingController', () => {
  it('should respond with api ok', async () => {
    const app = express();
    app.use(createPingController());

    const res = await request(app).get('/ping');

    expect(res.status).toBe(200);
    expect(res.body).toEqual({ api: 'ok' });
  });
});
