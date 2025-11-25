import { AbortSessionHandler } from '../../../sessions/handlers/AbortSessionHandler';
import { AbortSessionCommand } from '../../../sessions/commands/AbortSessionCommand';
import { SessionRepository } from '../../../sessions/ports/SessionRepository';
import { LoggerPort } from '../../../ports/LoggerPort';
import { Session } from '@core-domain';

describe('AbortSessionHandler', () => {
  let sessionRepository: jest.Mocked<SessionRepository>;
  let logger: jest.Mocked<LoggerPort>;
  let handler: AbortSessionHandler;

  const sessionId = 'session-123';

  beforeEach(() => {
    sessionRepository = {
      findById: jest.fn(),
      save: jest.fn(),
    } as any;

    logger = {
      child: jest.fn().mockReturnThis(),
      warn: jest.fn(),
      info: jest.fn(),
    } as any;

    handler = new AbortSessionHandler(sessionRepository, logger);
  });

  it('should abort an active session', async () => {
    const session: Session = {
      id: sessionId,
      status: 'active',
      notesPlanned: 1,
      assetsPlanned: 1,
      notesProcessed: 0,
      assetsProcessed: 0,
      createdAt: new Date('2023-01-01T00:00:00Z'),
      updatedAt: new Date('2023-01-01T00:00:00Z'),
    };
    sessionRepository.findById.mockResolvedValue(session);
    sessionRepository.save.mockResolvedValue(undefined);

    const command: AbortSessionCommand = { sessionId };
    const result = await handler.handle(command);

    expect(sessionRepository.findById).toHaveBeenCalledWith(sessionId);
    expect(session.status).toBe('aborted');
    expect(sessionRepository.save).toHaveBeenCalledWith(session);
    expect(result).toEqual({ sessionId, success: true });
    expect(logger.info).toHaveBeenCalledWith('Session aborted');
  });

  it('should throw SessionNotFoundError if session does not exist', async () => {
    sessionRepository.findById.mockResolvedValue(null);

    const command: AbortSessionCommand = { sessionId };

    await expect(handler.handle(command)).rejects.toBeInstanceOf(Error);
    expect(logger.warn).toHaveBeenCalledWith('Session not found');
  });

  it('should throw SessionInvalidError if session is finished', async () => {
    const session: Session = {
      id: sessionId,
      status: 'finished',
      notesPlanned: 1,
      assetsPlanned: 1,
      notesProcessed: 1,
      assetsProcessed: 1,
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    sessionRepository.findById.mockResolvedValue(session);

    const command: AbortSessionCommand = { sessionId };
    await expect(handler.handle(command)).rejects.toThrow('Cannot abort a finished session');
    expect(logger.warn).toHaveBeenCalledWith('Cannot abort finished session');
  });
});
