import { CommandHandler } from '../../common/CommandHandler';
import { IdGeneratorPort } from '../../ports/IdGeneratorPort';
import { LoggerPort } from '../../ports/LoggerPort';
import { CreateSessionCommand } from '../commands/CreateSessionCommand';
import { CreateSessionResult } from '../commands/CreateSessionResult';
import { SessionRepository } from '../ports/SessionRepository';
import { Session } from '@core-domain';

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

    logger?.info('Session created', { sessionId });

    return {
      sessionId,
      success: true,
    };
  }
}
