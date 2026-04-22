import { type Manifest, type PipelineSignature, Slug } from '@core-domain';

import { type IdGeneratorPort } from '../../../ports/id-generator.port';
import { type ManifestPort } from '../../../publishing/ports/manifest-storage.port';
import { type CreateSessionCommand } from '../../../sessions/commands/create-session.command';
import { CreateSessionHandler } from '../../../sessions/handlers/create-session.handler';
import { type SessionRepository } from '../../../sessions/ports/session.repository';
import { FakeLogger } from '../../helpers/fake-logger';

describe('CreateSessionHandler', () => {
  let idGenerator: jest.Mocked<IdGeneratorPort>;
  let sessionRepository: jest.Mocked<SessionRepository>;
  let logger: FakeLogger;
  let handler: CreateSessionHandler;

  beforeEach(() => {
    idGenerator = { generateId: jest.fn().mockReturnValue('session-123') } as any;
    sessionRepository = { create: jest.fn() } as any;
    logger = new FakeLogger();
    handler = new CreateSessionHandler(idGenerator, sessionRepository, undefined, logger);
  });

  it('should create a session and return success', async () => {
    const command: CreateSessionCommand = {
      notesPlanned: 5,
      assetsPlanned: 2,
      batchConfig: {
        maxBytesPerRequest: 10,
      },
    };

    const result = await handler.handle(command);

    expect(idGenerator.generateId).toHaveBeenCalled();
    expect(sessionRepository.create).toHaveBeenCalledWith(
      expect.objectContaining({
        id: 'session-123',
        notesPlanned: 5,
        assetsPlanned: 2,
        notesProcessed: 0,
        assetsProcessed: 0,
        status: 'pending',
        createdAt: expect.any(Date),
        updatedAt: expect.any(Date),
      })
    );
    expect(result).toMatchObject({
      sessionId: 'session-123',
      success: true,
      deduplicationEnabled: true,
    });
    const infoLogs = logger.getByLevel('info');
    expect(infoLogs).toHaveLength(1);
    expect(infoLogs[0].message).toBe('Session created successfully');
    expect(infoLogs[0].meta).toMatchObject({ sessionId: 'session-123' });
  });

  it('should persist deduplicationEnabled=false on the session', async () => {
    const command: CreateSessionCommand = {
      notesPlanned: 5,
      assetsPlanned: 2,
      batchConfig: {
        maxBytesPerRequest: 10,
      },
      deduplicationEnabled: false,
    };

    const result = await handler.handle(command);

    expect(sessionRepository.create).toHaveBeenCalledWith(
      expect.objectContaining({
        deduplicationEnabled: false,
      })
    );
    expect(result.deduplicationEnabled).toBe(false);
    expect(result.pipelineChanged).toBe(true);
  });

  it('should persist ignore rules on the session', async () => {
    const command: CreateSessionCommand = {
      notesPlanned: 5,
      assetsPlanned: 2,
      batchConfig: {
        maxBytesPerRequest: 10,
      },
      ignoreRules: [{ property: 'publish', ignoreIf: false } as any],
    };

    await handler.handle(command);

    expect(sessionRepository.create).toHaveBeenCalledWith(
      expect.objectContaining({
        ignoreRules: [{ property: 'publish', ignoreIf: false }],
      })
    );
  });

  it('should handle missing logger gracefully', async () => {
    handler = new CreateSessionHandler(idGenerator, sessionRepository, undefined);
    const command: CreateSessionCommand = {
      notesPlanned: 1,
      assetsPlanned: 1,
      batchConfig: {
        maxBytesPerRequest: 10,
      },
    };
    await expect(handler.handle(command)).resolves.toMatchObject({
      sessionId: 'session-123',
      success: true,
      deduplicationEnabled: true,
    });
    // No logger methods should be called
  });

  it('should propagate errors from sessionRepository.create', async () => {
    sessionRepository.create.mockRejectedValueOnce(new Error('DB error'));
    const command: CreateSessionCommand = {
      notesPlanned: 3,
      assetsPlanned: 4,
      batchConfig: {
        maxBytesPerRequest: 10,
      },
    };
    await expect(handler.handle(command)).rejects.toThrow('DB error');
  });

  it('should generate a new sessionId for each call', async () => {
    idGenerator.generateId.mockReturnValueOnce('id-1').mockReturnValueOnce('id-2');
    const command: CreateSessionCommand = {
      notesPlanned: 2,
      assetsPlanned: 2,
      batchConfig: {
        maxBytesPerRequest: 10,
      },
    };
    const result1 = await handler.handle(command);
    const result2 = await handler.handle(command);
    expect(result1.sessionId).toBe('id-1');
    expect(result2.sessionId).toBe('id-2');
  });

  describe('Pipeline signature and note deduplication', () => {
    let manifestStorage: jest.Mocked<ManifestPort>;

    beforeEach(() => {
      manifestStorage = {
        load: jest.fn(),
        save: jest.fn(),
        rebuildIndex: jest.fn(),
      } as any;
      handler = new CreateSessionHandler(idGenerator, sessionRepository, manifestStorage, logger);
    });

    it('should skip manifest hash extraction when deduplication is disabled', async () => {
      manifestStorage.load.mockResolvedValue({
        sessionId: 'prev-session',
        createdAt: new Date('2024-01-01'),
        lastUpdatedAt: new Date('2024-01-01'),
        pages: [],
        assets: [],
      } as Manifest);

      const command: CreateSessionCommand = {
        notesPlanned: 1,
        assetsPlanned: 1,
        batchConfig: { maxBytesPerRequest: 10 },
        deduplicationEnabled: false,
      };

      const result = await handler.handle(command);

      expect(manifestStorage.load).not.toHaveBeenCalled();
      expect(result.deduplicationEnabled).toBe(false);
      expect(result.existingAssetHashes).toBeUndefined();
      expect(result.pipelineChanged).toBe(true);
    });

    it('should return authoritative source note hashes when pipeline signature is identical', async () => {
      const signature: PipelineSignature = {
        version: '1.0.0',
        renderSettingsHash: 'abc123',
      };

      const manifest: Manifest = {
        sessionId: 'prev-session',
        createdAt: new Date('2024-01-01'),
        lastUpdatedAt: new Date('2024-01-01'),
        pipelineSignature: signature,
        pages: [
          {
            id: 'p1',
            title: 'Note 1',
            slug: Slug.from('note-1'),
            route: '/note-1',
            publishedAt: new Date('2024-01-01'),
            vaultPath: 'notes/note-1.md',
            sourceHash: 'hash1',
          },
          {
            id: 'p2',
            title: 'Note 2',
            slug: Slug.from('note-2'),
            route: '/dir/note-2',
            publishedAt: new Date('2024-01-01'),
            vaultPath: 'dir/note-2.md',
            sourceHash: 'hash2',
          },
        ],
      };

      manifestStorage.load.mockResolvedValue(manifest);

      const command: CreateSessionCommand = {
        notesPlanned: 2,
        assetsPlanned: 0,
        batchConfig: { maxBytesPerRequest: 10 },
        pipelineSignature: signature,
      };

      const result = await handler.handle(command);

      expect(result.pipelineChanged).toBe(false);
      expect(result.existingSourceNoteHashesByVaultPath).toEqual({
        'notes/note-1.md': 'hash1',
        'dir/note-2.md': 'hash2',
      });
    });

    it('should set pipelineChanged=true when version differs', async () => {
      const manifest: Manifest = {
        sessionId: 'prev-session',
        createdAt: new Date('2024-01-01'),
        lastUpdatedAt: new Date('2024-01-01'),
        pipelineSignature: {
          version: '1.0.0',
          renderSettingsHash: 'abc123',
        },
        pages: [
          {
            id: 'p1',
            title: 'Note 1',
            slug: Slug.from('note-1'),
            route: '/note-1',
            publishedAt: new Date('2024-01-01'),
            sourceHash: 'hash1',
          },
        ],
      };

      manifestStorage.load.mockResolvedValue(manifest);

      const command: CreateSessionCommand = {
        notesPlanned: 1,
        assetsPlanned: 0,
        batchConfig: { maxBytesPerRequest: 10 },
        pipelineSignature: {
          version: '2.0.0', // Version changed
          renderSettingsHash: 'abc123',
        },
      };

      const result = await handler.handle(command);

      expect(result.pipelineChanged).toBe(true);
    });

    it('should set pipelineChanged=true when renderSettingsHash differs', async () => {
      const manifest: Manifest = {
        sessionId: 'prev-session',
        createdAt: new Date('2024-01-01'),
        lastUpdatedAt: new Date('2024-01-01'),
        pipelineSignature: {
          version: '1.0.0',
          renderSettingsHash: 'abc123',
        },
        pages: [
          {
            id: 'p1',
            title: 'Note 1',
            slug: Slug.from('note-1'),
            route: '/note-1',
            publishedAt: new Date('2024-01-01'),
            sourceHash: 'hash1',
          },
        ],
      };

      manifestStorage.load.mockResolvedValue(manifest);

      const command: CreateSessionCommand = {
        notesPlanned: 1,
        assetsPlanned: 0,
        batchConfig: { maxBytesPerRequest: 10 },
        pipelineSignature: {
          version: '1.0.0',
          renderSettingsHash: 'xyz789', // Settings changed
        },
      };

      const result = await handler.handle(command);

      expect(result.pipelineChanged).toBe(true);
    });

    it('should handle manifest without pipelineSignature gracefully', async () => {
      const manifest: Manifest = {
        sessionId: 'prev-session',
        createdAt: new Date('2024-01-01'),
        lastUpdatedAt: new Date('2024-01-01'),
        pages: [],
      };

      manifestStorage.load.mockResolvedValue(manifest);

      const command: CreateSessionCommand = {
        notesPlanned: 1,
        assetsPlanned: 0,
        batchConfig: { maxBytesPerRequest: 10 },
        pipelineSignature: {
          version: '1.0.0',
          renderSettingsHash: 'abc123',
        },
      };

      const result = await handler.handle(command);

      expect(result.pipelineChanged).toBe(true); // One side missing => changed
    });

    it('should skip pages without sourceHash when extracting hashes', async () => {
      const manifest: Manifest = {
        sessionId: 'prev-session',
        createdAt: new Date('2024-01-01'),
        lastUpdatedAt: new Date('2024-01-01'),
        pipelineSignature: {
          version: '1.0.0',
          renderSettingsHash: 'abc123',
        },
        pages: [
          {
            id: 'p1',
            title: 'Note with hash',
            slug: Slug.from('note-1'),
            route: '/note-1',
            publishedAt: new Date('2024-01-01'),
            vaultPath: 'notes/note-1.md',
            sourceHash: 'hash1',
          },
          {
            id: 'p2',
            title: 'Note without hash',
            slug: Slug.from('note-2'),
            route: '/note-2',
            publishedAt: new Date('2024-01-01'),
            // No sourceHash
          },
        ],
      };

      manifestStorage.load.mockResolvedValue(manifest);

      const command: CreateSessionCommand = {
        notesPlanned: 2,
        assetsPlanned: 0,
        batchConfig: { maxBytesPerRequest: 10 },
        pipelineSignature: {
          version: '1.0.0',
          renderSettingsHash: 'abc123',
        },
      };

      const result = await handler.handle(command);

      expect(result.pipelineChanged).toBe(false);
      expect(result.existingSourceNoteHashesByVaultPath).toEqual({
        'notes/note-1.md': 'hash1',
        // note-2 skipped (no sourceHash)
      });
    });

    it('should key authoritative source hashes by vaultPath for route-sensitive duplicate titles', async () => {
      const manifest: Manifest = {
        sessionId: 'prev-session',
        createdAt: new Date('2024-01-01'),
        lastUpdatedAt: new Date('2024-01-01'),
        pipelineSignature: {
          version: '1.0.0',
          renderSettingsHash: 'abc123',
        },
        pages: [
          {
            id: 'p1',
            title: 'Index',
            slug: Slug.from('index'),
            route: '/alpha/index',
            publishedAt: new Date('2024-01-01'),
            vaultPath: 'alpha/index.md',
            sourceHash: 'hash-alpha',
          },
          {
            id: 'p2',
            title: 'Index',
            slug: Slug.from('index-2'),
            route: '/beta/index-2',
            publishedAt: new Date('2024-01-01'),
            vaultPath: 'beta/index.md',
            sourceHash: 'hash-beta',
          },
        ],
      };

      manifestStorage.load.mockResolvedValue(manifest);

      const result = await handler.handle({
        notesPlanned: 2,
        assetsPlanned: 0,
        batchConfig: { maxBytesPerRequest: 10 },
        pipelineSignature: {
          version: '1.0.0',
          renderSettingsHash: 'abc123',
        },
      });

      expect(result.pipelineChanged).toBe(false);
      expect(result.existingSourceNoteHashesByVaultPath).toEqual({
        'alpha/index.md': 'hash-alpha',
        'beta/index.md': 'hash-beta',
      });
    });
  });
});
