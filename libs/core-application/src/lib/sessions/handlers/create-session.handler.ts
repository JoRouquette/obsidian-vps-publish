import { type Session } from '@core-domain';

import { type CommandHandler } from '../../common/command-handler';
import { type IdGeneratorPort } from '../../ports/id-generator.port';
import { type LoggerPort } from '../../ports/logger.port';
import { type CreateSessionCommand } from '../commands/create-session.command';
import { type CreateSessionResult } from '../commands/create-session.result';
import { type SessionRepository } from '../ports/session.repository';

export class CreateSessionHandler
  implements CommandHandler<CreateSessionCommand, CreateSessionResult>
{
  private readonly logger?: LoggerPort;

  constructor(
    private readonly idGenerator: IdGeneratorPort,
    private readonly sessionRepository: SessionRepository,
    logger?: LoggerPort
  ) {
    this.logger = logger?.child({ handler: 'CreateSessionHandler' });
  }

  async handle(command: CreateSessionCommand): Promise<CreateSessionResult> {
    const logger = this.logger?.child({ method: 'handle' });

    const sessionId = this.idGenerator.generateId();
    const now = new Date();

    const session: Session = {
      id: sessionId,
      notesPlanned: command.notesPlanned,
      assetsPlanned: command.assetsPlanned,
      notesProcessed: 0,
      assetsProcessed: 0,
      status: 'pending',
      createdAt: now,
      updatedAt: now,
    };

    await this.sessionRepository.create(session);

    logger?.debug('Session created', { sessionId });

    return {
      sessionId,
      success: true,
    };
  }
}
