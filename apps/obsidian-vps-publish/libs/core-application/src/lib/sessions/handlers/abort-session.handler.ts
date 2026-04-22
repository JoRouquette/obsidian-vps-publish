import { type LoggerPort, SessionInvalidError, SessionNotFoundError } from '@core-domain';

import { type CommandHandler } from '../../common/command-handler';
import { type AbortSessionCommand } from '../commands/abort-session.command';
import { type AbortSessionResult } from '../commands/abort-session.result';
import { type SessionRepository } from '../ports/session.repository';

export class AbortSessionHandler implements CommandHandler<
  AbortSessionCommand,
  AbortSessionResult
> {
  private readonly logger?: LoggerPort;

  constructor(
    private readonly sessionRepository: SessionRepository,
    logger?: LoggerPort
  ) {
    this.logger = logger?.child({ scope: 'sessions', operation: 'abortSession' });
  }

  async handle(command: AbortSessionCommand): Promise<AbortSessionResult> {
    const logger = this.logger?.child({ sessionId: command.sessionId });

    const session = await this.sessionRepository.findById(command.sessionId);
    if (!session) {
      logger?.error('Abort failed: session not found', {
        sessionId: command.sessionId,
        reason: 'SessionNotFoundError',
        action: 'Verify sessionId or start new session',
      });
      throw new SessionNotFoundError(command.sessionId);
    }

    if (session.status === 'finished') {
      logger?.error('Abort failed: session already finished', {
        sessionId: session.id,
        status: session.status,
        reason: 'SessionInvalidError',
        action: 'Cannot abort a committed session',
      });
      throw new SessionInvalidError('Cannot abort a finished session', session.id);
    }

    session.status = 'aborted';
    session.updatedAt = new Date();

    await this.sessionRepository.save(session);

    logger?.info('Session aborted successfully', {
      sessionId: session.id,
      previousStatus: 'active',
    });

    return {
      sessionId: session.id,
      success: true,
    };
  }
}
