import { SessionInvalidError, SessionNotFoundError } from '@core-domain';
import { CommandHandler } from '../../common/CommandHandler';
import { LoggerPort } from '../../ports/LoggerPort';
import { AbortSessionCommand } from '../commands/AbortSessionCommand';
import { AbortSessionResult } from '../commands/AbortSessionResult';
import { SessionRepository } from '../ports/SessionRepository';

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

    logger?.info('Session aborted');

    return {
      sessionId: session.id,
      success: true,
    };
  }
}
