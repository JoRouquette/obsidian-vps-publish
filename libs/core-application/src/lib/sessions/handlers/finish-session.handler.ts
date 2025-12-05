import { SessionInvalidError, SessionNotFoundError } from '@core-domain';

import { type CommandHandler } from '../../common/command-handler';
import { type LoggerPort } from '../../ports/logger.port';
import { type FinishSessionCommand } from '../commands/finish-session.command';
import { type FinishSessionResult } from '../commands/finish-session.result';
import { type SessionRepository } from '../ports/session.repository';

export class FinishSessionHandler
  implements CommandHandler<FinishSessionCommand, FinishSessionResult>
{
  private readonly logger?: LoggerPort;

  constructor(
    private readonly sessionRepository: SessionRepository,
    logger?: LoggerPort
  ) {
    this.logger = logger?.child({ handler: 'FinishSessionHandler' });
  }

  async handle(command: FinishSessionCommand): Promise<FinishSessionResult> {
    const logger = this.logger?.child({ method: 'handle', sessionId: command.sessionId });

    const session = await this.sessionRepository.findById(command.sessionId);
    if (!session) {
      logger?.warn('Session not found');
      throw new SessionNotFoundError(command.sessionId);
    }

    if (session.status === 'aborted' || session.status === 'finished') {
      logger?.warn('Invalid session status for finish', { status: session.status });
      throw new SessionInvalidError(
        `Cannot finish session with status ${session.status}`,
        session.id
      );
    }

    // Règles métier minimales (à toi de les durcir si besoin)
    session.notesProcessed = command.notesProcessed;
    session.assetsProcessed = command.assetsProcessed;
    session.status = 'finished';
    session.updatedAt = new Date();

    await this.sessionRepository.save(session);

    logger?.info('Session finished');

    return {
      sessionId: session.id,
      success: true,
    };
  }
}
