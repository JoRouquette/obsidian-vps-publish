import { SessionInvalidError, SessionNotFoundError } from '@core-domain';

import { type CommandHandler } from '../../common/command-handler';
import { type LoggerPort } from '../../ports/logger.port';
import { type AbortSessionCommand } from '../commands/abort-session.command';
import { type AbortSessionResult } from '../commands/abort-session.result';
import { type SessionRepository } from '../ports/session.repository';

export class AbortSessionHandler
  implements CommandHandler<AbortSessionCommand, AbortSessionResult>
{
  private readonly logger?: LoggerPort;

  constructor(
    private readonly sessionRepository: SessionRepository,
    logger?: LoggerPort
  ) {
    this.logger = logger?.child({ handler: 'AbortSessionHandler' });
  }

  async handle(command: AbortSessionCommand): Promise<AbortSessionResult> {
    const logger = this.logger?.child({ method: 'handle', sessionId: command.sessionId });

    const session = await this.sessionRepository.findById(command.sessionId);
    if (!session) {
      logger?.warn('Session not found');
      throw new SessionNotFoundError(command.sessionId);
    }

    if (session.status === 'finished') {
      logger?.warn('Cannot abort finished session');
      throw new SessionInvalidError('Cannot abort a finished session', session.id);
    }

    session.status = 'aborted';
    session.updatedAt = new Date();

    await this.sessionRepository.save(session);

    logger?.debug('Session aborted');

    return {
      sessionId: session.id,
      success: true,
    };
  }
}
