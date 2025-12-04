import express from 'express';
import request from 'supertest';

import { createMaintenanceController } from '../infra/http/express/controllers/maintenance-controller';

describe('maintenanceController', () => {
  const stagingManager = {
    purgeAll: jest.fn().mockResolvedValue(undefined),
  };

  const buildApp = () => {
    const app = express();
    app.use(express.json());
    app.use(createMaintenanceController(stagingManager as any));
    return app;
  };

  beforeEach(() => {
    jest.clearAllMocks();
    stagingManager.purgeAll.mockResolvedValue(undefined);
  });

  it('returns 400 on invalid payload', async () => {
    const app = buildApp();
    const res = await request(app).post('/maintenance/cleanup').send({});
    expect(res.status).toBe(400);
    expect(stagingManager.purgeAll).not.toHaveBeenCalled();
  });

  it('triggers purge when payload is valid', async () => {
    const app = buildApp();
    const res = await request(app).post('/maintenance/cleanup').send({ targetName: 'ProdVPS' });
    expect(res.status).toBe(200);
    expect(stagingManager.purgeAll).toHaveBeenCalled();
  });

  it('maps errors to 500', async () => {
    const app = buildApp();
    stagingManager.purgeAll.mockRejectedValueOnce(new Error('fail'));
    const res = await request(app).post('/maintenance/cleanup').send({ targetName: 'ProdVPS' });
    expect(res.status).toBe(500);
  });
});
