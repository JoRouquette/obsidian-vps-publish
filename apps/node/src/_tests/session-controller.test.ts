import { SessionInvalidError, SessionNotFoundError } from '@core-domain';
import express from 'express';
import request from 'supertest';

import { SessionControllerBuilder } from '../infra/http/express/controllers/session-controller';

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

  const buildApp = (options?: { finalizationRealtimeEnabled?: boolean }) => {
    const app = express();
    app.use(express.json());

    const finalizationJobService = {
      queueFinalization: jest.fn().mockResolvedValue('test-job-id'),
      getJobBySessionId: jest.fn().mockReturnValue({
        jobId: 'test-job-id',
        sessionId: 'abc',
        status: 'processing',
        progress: 50,
        phase: 'rendering_html',
        createdAt: '2026-03-25T09:00:00.000Z',
        startedAt: '2026-03-25T09:00:01.000Z',
        completedAt: undefined,
        error: undefined,
        result: undefined,
      }),
      getJobStatus: jest.fn(),
    } as any;
    const finalizationStreamTokenService = {
      createToken: jest.fn().mockReturnValue({
        token: 'signed-token',
        expiresAt: '2026-03-25T09:15:00.000Z',
      }),
    } as any;

    app.use(
      new SessionControllerBuilder()
        .withCreateSessionHandler(createSessionHandler as any)
        .withFinishSessionHandler(finishSessionHandler as any)
        .withAbortSessionHandler(abortSessionHandler as any)
        .withNotePublicationHandler(uploadNotesHandler as any)
        .withAssetPublicationHandler(uploadAssetsHandler as any)
        .withStagingManager(stagingManager as any)
        .withCalloutRenderer(calloutRenderer as any)
        .withFinalizationJobService(finalizationJobService)
        .withFinalizationStreamTokenService(finalizationStreamTokenService)
        .withSessionRepository(sessionRepository as any)
        .withFinalizationRealtimeEnabled(options?.finalizationRealtimeEnabled ?? true)
        .build()
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
    expect(res.body.maxBytesPerRequest).toBe(1000);
    expect(createSessionHandler.handle).toHaveBeenCalled();
  });

  it('returns authoritative source hashes keyed by vaultPath when provided', async () => {
    createSessionHandler.handle.mockResolvedValueOnce({
      sessionId: 's1',
      success: true,
      existingSourceNoteHashesByVaultPath: {
        'notes/a.md': 'hash-a',
      },
      pipelineChanged: false,
    });
    const app = buildApp();

    const res = await request(app)
      .post('/session/start')
      .send({
        notesPlanned: 1,
        assetsPlanned: 1,
        batchConfig: { maxBytesPerRequest: 1000 },
        apiOwnedDeterministicNoteTransformsEnabled: true,
      });

    expect(res.status).toBe(201);
    expect(res.body).toMatchObject({
      existingSourceNoteHashesByVaultPath: {
        'notes/a.md': 'hash-a',
      },
      pipelineChanged: false,
    });
  });

  it('passes the deduplication flag to session creation', async () => {
    const app = buildApp();
    const res = await request(app)
      .post('/session/start')
      .send({
        notesPlanned: 1,
        assetsPlanned: 1,
        batchConfig: { maxBytesPerRequest: 1000 },
        deduplicationEnabled: false,
      });

    expect(res.status).toBe(201);
    expect(createSessionHandler.handle).toHaveBeenCalledWith(
      expect.objectContaining({
        deduplicationEnabled: false,
      })
    );
  });

  it('passes the api-owned deterministic transforms flag and ignore rules to session creation', async () => {
    const app = buildApp();
    const res = await request(app)
      .post('/session/start')
      .send({
        notesPlanned: 1,
        assetsPlanned: 1,
        batchConfig: { maxBytesPerRequest: 1000 },
        apiOwnedDeterministicNoteTransformsEnabled: true,
        ignoreRules: [{ property: 'publish', ignoreIf: false }],
      });

    expect(res.status).toBe(201);
    expect(createSessionHandler.handle).toHaveBeenCalledWith(
      expect.objectContaining({
        apiOwnedDeterministicNoteTransformsEnabled: true,
        ignoreRules: [{ property: 'publish', ignoreIf: false }],
      })
    );
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
    expect(resOk.status).toBe(202);
    expect(resOk.body).toMatchObject({
      sessionId: 'abc',
      success: true,
      jobId: 'test-job-id',
      status: 'queued',
      realtime: {
        transport: 'sse',
        streamUrl: '/events/session/abc/finalization?jobId=test-job-id',
        token: 'signed-token',
        expiresAt: '2026-03-25T09:15:00.000Z',
      },
    });
    expect(resOk.body.realtime.streamUrl).not.toContain('token=');
    expect(resOk.body.realtime.token).toBe('signed-token');
  });

  it('can omit realtime metadata for a poll-only rollout', async () => {
    finishSessionHandler.handle.mockResolvedValueOnce({ sessionId: 'abc', success: true });
    const app = buildApp({ finalizationRealtimeEnabled: false });

    const res = await request(app).post('/session/abc/finish').send({
      notesProcessed: 1,
      assetsProcessed: 1,
    });

    expect(res.status).toBe(202);
    expect(res.body).toMatchObject({
      sessionId: 'abc',
      success: true,
      jobId: 'test-job-id',
      status: 'queued',
    });
    expect(res.body).not.toHaveProperty('realtime');
  });

  it('returns the existing polling status payload unchanged', async () => {
    const app = buildApp();
    const res = await request(app).get('/session/abc/status');

    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({
      jobId: 'test-job-id',
      sessionId: 'abc',
      status: 'processing',
      progress: 50,
      phase: 'rendering_html',
      createdAt: '2026-03-25T09:00:00.000Z',
      startedAt: '2026-03-25T09:00:01.000Z',
    });
    expect(res.body).not.toHaveProperty('realtime');
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

  it('returns 200 when abort cleanup fails after session state update', async () => {
    stagingManager.discardSession.mockRejectedValueOnce(new Error('cleanup failed'));

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

  it('propagates non-deduplicated mode to asset uploads', async () => {
    sessionRepository.findById.mockResolvedValueOnce({
      id: 'abc',
      deduplicationEnabled: false,
    } as any);

    const app = buildApp();
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
    expect(uploadAssetsHandler.handle).toHaveBeenCalledWith(
      expect.objectContaining({
        deduplicationEnabled: false,
      })
    );
  });

  it('propagates the api-owned deterministic transform flag to note uploads', async () => {
    sessionRepository.findById.mockResolvedValueOnce({
      id: 'abc',
      folderDisplayNames: { '/test': 'Test Display Name' },
      apiOwnedDeterministicNoteTransformsEnabled: true,
    } as any);

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
            routing: { fullPath: 'Vault/T.md', slug: '', path: '', routeBase: '/t' },
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
    expect(uploadNotesHandler.handle).toHaveBeenCalledWith(
      expect.objectContaining({
        apiOwnedDeterministicNoteTransformsEnabled: true,
      })
    );
  });

  it('accepts lean source-package note payloads for api-owned deterministic transforms', async () => {
    sessionRepository.findById.mockResolvedValueOnce({
      id: 'abc',
      folderDisplayNames: { '/test': 'Test Display Name' },
      apiOwnedDeterministicNoteTransformsEnabled: true,
    } as any);

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
    expect(uploadNotesHandler.handle).toHaveBeenCalledWith(
      expect.objectContaining({
        apiOwnedDeterministicNoteTransformsEnabled: true,
        notes: [
          expect.not.objectContaining({
            routing: expect.anything(),
          }),
        ],
      })
    );
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
