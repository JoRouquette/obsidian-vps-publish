import { type Session } from '@core-domain';

import { type FinishSessionCommand } from '../../../../lib/sessions/commands/finish-session.command';
import { FinishSessionHandler } from '../../../../lib/sessions/handlers/finish-session.handler';
import { type SessionRepository } from '../../../../lib/sessions/ports/session.repository';
import { FakeLogger } from '../../helpers/fake-logger';

describe('FinishSessionHandler', () => {
  let sessionRepository: jest.Mocked<SessionRepository>;
  let logger: FakeLogger;
  let handler: FinishSessionHandler;

  const baseSession: Session = {
    id: 'session-1',
    status: 'active',
    notesProcessed: 0,
    assetsProcessed: 0,
    notesPlanned: 5,
    assetsPlanned: 3,
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  beforeEach(() => {
    sessionRepository = {
      findById: jest.fn(),
      save: jest.fn(),
    } as any;

    logger = new FakeLogger();

    handler = new FinishSessionHandler(sessionRepository, logger);
  });

  it('should finish a valid session', async () => {
    sessionRepository.findById.mockResolvedValue({ ...baseSession });
    sessionRepository.save.mockResolvedValue(undefined);

    const command: FinishSessionCommand = {
      sessionId: 'session-1',
      notesProcessed: 5,
      assetsProcessed: 2,
    };

    const result = await handler.handle(command);

    expect(sessionRepository.findById).toHaveBeenCalledWith('session-1');
    expect(sessionRepository.save).toHaveBeenCalledWith(
      expect.objectContaining({
        id: 'session-1',
        status: 'finished',
        notesProcessed: 5,
        assetsProcessed: 2,
      })
    );
    expect(result).toEqual({ sessionId: 'session-1', success: true });
    const infoLogs = logger.getByLevel('info');
    expect(infoLogs).toHaveLength(1);
    expect(infoLogs[0].message).toBe('Session finished successfully');
  });

  it('should throw SessionNotFoundError if session does not exist', async () => {
    sessionRepository.findById.mockResolvedValue(null);

    const command: FinishSessionCommand = {
      sessionId: 'not-found',
      notesProcessed: 1,
      assetsProcessed: 1,
    };

    await expect(handler.handle(command)).rejects.toBeInstanceOf(Error);
    const errorLogs = logger.getByLevel('error');
    expect(errorLogs).toHaveLength(1);
    expect(errorLogs[0].message).toBe('Finish failed: session not found');
  });

  it('should throw SessionInvalidError if session is already finished', async () => {
    sessionRepository.findById.mockResolvedValue({ ...baseSession, status: 'finished' });

    const command: FinishSessionCommand = {
      sessionId: 'session-1',
      notesProcessed: 1,
      assetsProcessed: 1,
    };

    await expect(handler.handle(command)).rejects.toBeInstanceOf(Error);
    const errorLogs = logger.getByLevel('error');
    expect(errorLogs).toHaveLength(1);
    expect(errorLogs[0].message).toBe('Finish failed: invalid session status');
  });

  it('should throw SessionInvalidError if session is aborted', async () => {
    sessionRepository.findById.mockResolvedValue({ ...baseSession, status: 'aborted' });

    const command: FinishSessionCommand = {
      sessionId: 'session-1',
      notesProcessed: 1,
      assetsProcessed: 1,
    };

    await expect(handler.handle(command)).rejects.toBeInstanceOf(Error);
    const errorLogs = logger.getByLevel('error');
    expect(errorLogs).toHaveLength(1);
    expect(errorLogs[0].message).toBe('Finish failed: invalid session status');
  });

  it('should update updatedAt to a recent date', async () => {
    const session = { ...baseSession };
    sessionRepository.findById.mockResolvedValue(session);
    sessionRepository.save.mockResolvedValue(undefined);

    const command: FinishSessionCommand = {
      sessionId: 'session-1',
      notesProcessed: 3,
      assetsProcessed: 4,
    };

    const before = new Date();
    await handler.handle(command);
    const after = new Date();

    expect(session.updatedAt.getTime()).toBeGreaterThanOrEqual(before.getTime());
    expect(session.updatedAt.getTime()).toBeLessThanOrEqual(after.getTime());
  });

  it('should work without a logger', async () => {
    handler = new FinishSessionHandler(sessionRepository, undefined);
    sessionRepository.findById.mockResolvedValue({ ...baseSession });
    sessionRepository.save.mockResolvedValue(undefined);

    const command: FinishSessionCommand = {
      sessionId: 'session-1',
      notesProcessed: 2,
      assetsProcessed: 2,
    };

    const result = await handler.handle(command);
    expect(result).toEqual({ sessionId: 'session-1', success: true });
  });
});
