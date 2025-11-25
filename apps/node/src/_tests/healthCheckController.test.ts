import express from 'express';
import request from 'supertest';

import { createHealthCheckController } from '../infra/http/express/controllers/healthCheckController';

describe('createHealthCheckController', () => {
  it('returns healthy status', async () => {
    const app = express();
    app.use(createHealthCheckController());

    const res = await request(app).get('/health');

    expect(res.status).toBe(200);
    expect(res.body).toEqual({ status: 'healthy' });
  });
});
