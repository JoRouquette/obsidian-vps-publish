import { SessionInvalidError, SessionNotFoundError } from '@core-domain';
import express from 'express';
import request from 'supertest';

import { createSessionController } from '../infra/http/express/controllers/session-controller';

describe('sessionController', () => {
  const createSessionHandler = {
    handle: jest.fn().mockResolvedValue({ sessionId: 's1', success: true }),
  };
  const finishSessionHandler = {
    handle: jest.fn().mockResolvedValue({ sessionId: 's1', success: true }),
  };
  const abortSessionHandler = {
    handle: jest.fn().mockResolvedValue({ sessionId: 's1', success: true }),
  };
  const uploadNotesHandler = {
    handle: jest.fn().mockResolvedValue({ sessionId: 's1', published: 0, errors: [] }),
  };
  const uploadAssetsHandler = {
    handle: jest.fn().mockResolvedValue({ sessionId: 's1', published: 0, errors: [] }),
  };
  const sessionFinalizer = {
    rebuildFromStored: jest.fn().mockResolvedValue(undefined),
  };
  const calloutRenderer = {
    extendFromStyles: jest.fn(),
  };
  const stagingManager = {
    promoteSession: jest.fn().mockResolvedValue(undefined),
    discardSession: jest.fn().mockResolvedValue(undefined),
  };

  const sessionRepository = {
    findById: jest.fn().mockResolvedValue({
      id: 's1',
      folderDisplayNames: { '/test': 'Test Display Name' },
    }),
  };

  const buildApp = () => {
    const app = express();
    app.use(express.json());

    const finalizationJobService = {
      queueFinalization: jest.fn().mockResolvedValue('test-job-id'),
      getJobBySessionId: jest.fn(),
      getJobStatus: jest.fn(),
      waitForJob: jest.fn().mockResolvedValue({
        id: 'test-job-id',
        sessionId: 's1',
        status: 'completed' as const,
        startedAt: new Date(),
        completedAt: new Date(),
        result: {
          promotionStats: {
            notesPublished: 10,
            notesDeduplicated: 5,
            notesDeleted: 2,
            assetsPublished: 8,
            assetsDeduplicated: 3,
          },
        },
      }),
    } as any;

    app.use(
      createSessionController(
        createSessionHandler as any,
        finishSessionHandler as any,
        abortSessionHandler as any,
        uploadNotesHandler as any,
        uploadAssetsHandler as any,
        sessionFinalizer as any,
        stagingManager as any,
        calloutRenderer as any,
        finalizationJobService,
        sessionRepository as any
      )
    );
    return app;
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('creates session with valid payload', async () => {
    const app = buildApp();
    const res = await request(app)
      .post('/session/start')
      .send({
        notesPlanned: 1,
        assetsPlanned: 1,
        batchConfig: { maxBytesPerRequest: 1000 },
      });
    expect(res.status).toBe(201);
    expect(createSessionHandler.handle).toHaveBeenCalled();
  });

  it('rejects invalid create payload', async () => {
    const app = buildApp();
    const res = await request(app).post('/session/start').send({});
    expect(res.status).toBe(400);
  });

  it('finishes session and maps domain errors', async () => {
    const app = buildApp();
    finishSessionHandler.handle.mockRejectedValueOnce(new SessionNotFoundError('missing'));
    const res404 = await request(app).post('/session/abc/finish').send({
      notesProcessed: 1,
      assetsProcessed: 1,
    });
    expect(res404.status).toBe(404);

    finishSessionHandler.handle.mockRejectedValueOnce(new SessionInvalidError('invalid', 'abc'));
    const res409 = await request(app).post('/session/abc/finish').send({
      notesProcessed: 1,
      assetsProcessed: 1,
    });
    expect(res409.status).toBe(409);

    finishSessionHandler.handle.mockResolvedValueOnce({ sessionId: 'abc', success: true });
    const resOk = await request(app).post('/session/abc/finish').send({
      notesProcessed: 1,
      assetsProcessed: 1,
    });
    expect(resOk.status).toBe(200);
    expect(resOk.body).toHaveProperty('promotionStats');
    expect(resOk.body.promotionStats).toMatchObject({
      notesPublished: expect.any(Number),
      notesDeduplicated: expect.any(Number),
      notesDeleted: expect.any(Number),
      assetsPublished: expect.any(Number),
      assetsDeduplicated: expect.any(Number),
    });
  });

  it('returns 400 on invalid finish payload', async () => {
    const app = buildApp();
    const res = await request(app).post('/session/abc/finish').send({ notesProcessed: 'oops' });
    expect(res.status).toBe(400);
  });

  it('aborts session', async () => {
    const app = buildApp();
    const res = await request(app).post('/session/abc/abort').send({});
    expect(res.status).toBe(200);
    expect(abortSessionHandler.handle).toHaveBeenCalledWith({ sessionId: 'abc' });
  });

  it('uploads notes and assets', async () => {
    const app = buildApp();

    const notesRes = await request(app)
      .post('/session/abc/notes/upload')
      .send({
        notes: [
          {
            noteId: '1',
            title: 'T',
            content: 'c',
            publishedAt: new Date().toISOString(),
            routing: { fullPath: '/t', slug: 't', path: '/t', routeBase: '/t' },
            eligibility: { isPublishable: true },
            vaultPath: 'v',
            relativePath: 'r',
            frontmatter: { tags: [], flat: {}, nested: {} },
            folderConfig: {
              id: 'f',
              vaultFolder: 'v',
              routeBase: '/t',
              vpsId: 'vps',
              sanitization: [],
            },
          },
        ],
      });
    expect(notesRes.status).toBe(200);
    expect(uploadNotesHandler.handle).toHaveBeenCalled();

    const assetsRes = await request(app)
      .post('/session/abc/assets/upload')
      .send({
        assets: [
          {
            fileName: 'a',
            mimeType: 'text/plain',
            contentBase64: 'YQ==',
            relativePath: 'a',
            vaultPath: 'a',
          },
        ],
      });
    expect(assetsRes.status).toBe(200);
    expect(uploadAssetsHandler.handle).toHaveBeenCalled();
  });

  it('rejects invalid notes payload', async () => {
    const app = buildApp();
    const res = await request(app).post('/session/abc/notes/upload').send({ notes: [] });
    expect(res.status).toBe(400);
    expect(uploadNotesHandler.handle).not.toHaveBeenCalled();
  });

  it('rejects invalid assets payload', async () => {
    const app = buildApp();
    const res = await request(app).post('/session/abc/assets/upload').send({ assets: [] });
    expect(res.status).toBe(400);
    expect(uploadAssetsHandler.handle).not.toHaveBeenCalled();
  });

  it('returns 500 when finish handler throws generic error', async () => {
    const app = buildApp();
    finishSessionHandler.handle.mockRejectedValueOnce(new Error('boom'));
    const res = await request(app).post('/session/abc/finish').send({
      notesProcessed: 1,
      assetsProcessed: 1,
    });
    expect(res.status).toBe(500);
  });

  it('returns 500 when upload handlers throw', async () => {
    const app = buildApp();
    uploadNotesHandler.handle.mockRejectedValueOnce(new Error('notes fail'));
    const notesRes = await request(app)
      .post('/session/abc/notes/upload')
      .send({
        notes: [
          {
            noteId: '1',
            title: 'T',
            content: 'c',
            publishedAt: new Date().toISOString(),
            routing: { fullPath: '/t', slug: 't', path: '/t', routeBase: '/t' },
            eligibility: { isPublishable: true },
            vaultPath: 'v',
            relativePath: 'r',
            frontmatter: { tags: [], flat: {}, nested: {} },
            folderConfig: {
              id: 'f',
              vaultFolder: 'v',
              routeBase: '/t',
              vpsId: 'vps',
              sanitization: [],
            },
          },
        ],
      });
    expect(notesRes.status).toBe(500);

    uploadAssetsHandler.handle.mockRejectedValueOnce(new Error('assets fail'));
    const assetsRes = await request(app)
      .post('/session/abc/assets/upload')
      .send({
        assets: [
          {
            fileName: 'a',
            mimeType: 'text/plain',
            contentBase64: 'YQ==',
            relativePath: 'a',
            vaultPath: 'a',
          },
        ],
      });
    expect(assetsRes.status).toBe(500);
  });
});
