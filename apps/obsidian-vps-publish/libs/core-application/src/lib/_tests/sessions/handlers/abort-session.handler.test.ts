import { type Session } from '@core-domain';

import { type AbortSessionCommand } from '../../../sessions/commands/abort-session.command';
import { AbortSessionHandler } from '../../../sessions/handlers/abort-session.handler';
import { type SessionRepository } from '../../../sessions/ports/session.repository';
import { FakeLogger } from '../../helpers/fake-logger';

describe('AbortSessionHandler', () => {
  let sessionRepository: jest.Mocked<SessionRepository>;
  let logger: FakeLogger;
  let handler: AbortSessionHandler;

  const sessionId = 'session-123';

  beforeEach(() => {
    sessionRepository = {
      findById: jest.fn(),
      save: jest.fn(),
    } as any;

    logger = new FakeLogger();

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
    const infoLogs = logger.getByLevel('info');
    expect(infoLogs).toHaveLength(1);
    expect(infoLogs[0].message).toBe('Session aborted successfully');
  });

  it('should throw SessionNotFoundError if session does not exist', async () => {
    sessionRepository.findById.mockResolvedValue(null);

    const command: AbortSessionCommand = { sessionId };

    await expect(handler.handle(command)).rejects.toBeInstanceOf(Error);
    const errorLogs = logger.getByLevel('error');
    expect(errorLogs).toHaveLength(1);
    expect(errorLogs[0].message).toBe('Abort failed: session not found');
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
    const errorLogs = logger.getByLevel('error');
    expect(errorLogs).toHaveLength(1);
    expect(errorLogs[0].message).toBe('Abort failed: session already finished');
  });
});
