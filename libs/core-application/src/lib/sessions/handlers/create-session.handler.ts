import { type LoggerPort, type Session } from '@core-domain';

import { type CommandHandler } from '../../common/command-handler';
import { type IdGeneratorPort } from '../../ports/id-generator.port';
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
    this.logger = logger?.child({ scope: 'sessions', operation: 'createSession' });
  }

  async handle(command: CreateSessionCommand): Promise<CreateSessionResult> {
    const startTime = Date.now();
    const sessionId = this.idGenerator.generateId();
    const logger = this.logger?.child({ sessionId });

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
      customIndexConfigs: command.customIndexConfigs,
    };

    await this.sessionRepository.create(session);

    const duration = Date.now() - startTime;
    logger?.info('Session created successfully', {
      sessionId,
      status: session.status,
      notesPlanned: session.notesPlanned,
      assetsPlanned: session.assetsPlanned,
      durationMs: duration,
    });

    return {
      sessionId,
      success: true,
    };
  }
}
