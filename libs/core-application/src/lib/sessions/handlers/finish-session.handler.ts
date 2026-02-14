import { type LoggerPort, SessionInvalidError, SessionNotFoundError } from '@core-domain';

import { type CommandHandler } from '../../common/command-handler';
import { type FinishSessionCommand } from '../commands/finish-session.command';
import { type FinishSessionResult } from '../commands/finish-session.result';
import { type SessionRepository } from '../ports/session.repository';

export class FinishSessionHandler implements CommandHandler<
  FinishSessionCommand,
  FinishSessionResult
> {
  private readonly logger?: LoggerPort;

  constructor(
    private readonly sessionRepository: SessionRepository,
    logger?: LoggerPort
  ) {
    this.logger = logger?.child({ scope: 'sessions', operation: 'finishSession' });
  }

  async handle(command: FinishSessionCommand): Promise<FinishSessionResult> {
    const logger = this.logger?.child({ sessionId: command.sessionId });

    const session = await this.sessionRepository.findById(command.sessionId);
    if (!session) {
      logger?.error('Finish failed: session not found', {
        sessionId: command.sessionId,
        reason: 'SessionNotFoundError',
        action: 'Verify sessionId or start new session',
      });
      throw new SessionNotFoundError(command.sessionId);
    }

    if (session.status === 'aborted' || session.status === 'finished') {
      logger?.error('Finish failed: invalid session status', {
        sessionId: session.id,
        status: session.status,
        validStatuses: ['pending', 'active'],
        reason: 'SessionInvalidError',
        action: 'Can only finish pending or active sessions',
      });
      throw new SessionInvalidError(
        `Cannot finish session with status ${session.status}`,
        session.id
      );
    }

    // Règles métier minimales (à toi de les durcir si besoin)
    session.notesProcessed = command.notesProcessed;
    session.assetsProcessed = command.assetsProcessed;
    session.allCollectedRoutes = command.allCollectedRoutes; // PHASE 6.1
    session.status = 'finished';
    session.updatedAt = new Date();

    await this.sessionRepository.save(session);

    logger?.info('Session finished successfully', {
      sessionId: session.id,
      notesProcessed: session.notesProcessed,
      assetsProcessed: session.assetsProcessed,
      previousStatus: session.status,
    });

    return {
      sessionId: session.id,
      success: true,
    };
  }
}
