import { type IdGeneratorPort } from '../../../ports/id-generator.port';
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
    expect(result).toEqual({ sessionId: 'session-123', success: true });
    const infoLogs = logger.getByLevel('info');
    expect(infoLogs).toHaveLength(1);
    expect(infoLogs[0].message).toBe('Session created successfully');
    expect(infoLogs[0].meta).toMatchObject({ sessionId: 'session-123' });
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
    await expect(handler.handle(command)).resolves.toEqual({
      sessionId: 'session-123',
      success: true,
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
});
