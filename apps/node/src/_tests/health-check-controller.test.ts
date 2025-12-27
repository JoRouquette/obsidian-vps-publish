import express from 'express';
import request from 'supertest';

import { createHealthCheckController } from '../infra/http/express/controllers/health-check.controller';

describe('createHealthCheckController', () => {
  it('returns healthy status', async () => {
    const app = express();
    app.use(createHealthCheckController());

    const res = await request(app).get('/health');

    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({
      status: 'healthy',
      uptime: expect.any(Number),
      memory: expect.any(Object),
    });
    expect(res.body.memory).toHaveProperty('heapUsedMB');
  });
});
