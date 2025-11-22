import { CommandHandler } from '../../common/CommandHandler';
import { IdGeneratorPort } from '../../ports/IdGeneratorPort';
import { LoggerPort } from '../../ports/LoggerPort';
import { CreateSessionCommand, CreateSessionResult } from '../commands/CreateSessionCommand';
import { SessionRepository } from '../ports/SessionRepository';

export class CreateSessionHandler
  implements CommandHandler<CreateSessionCommand, CreateSessionResult>
{
  constructor(
    private readonly idGenerator: IdGeneratorPort,
    private readonly sessionRepository: SessionRepository,
    private readonly logger?: LoggerPort
  ) {
    logger = logger?.child({ handler: 'CreateSessionHandler' });
  }

  async handle(command: CreateSessionCommand): Promise<CreateSessionResult> {
    const logger = this.logger?.child({ method: 'handle' });
    const sessionId = this.idGenerator.generateId();

    logger?.info('Creating new session', { sessionId });

    

    return {
      sessionId: sessionId,
      success: true,
      notesUploadUrl: `https://example.com/sessions/${sessionId}/upload-notes`,
      assetsUploadUrl: `https://example.com/sessions/${sessionId}/upload-assets`,
      finishSessionUrl: `https://example.com/sessions/${sessionId}/finish`,
      abortSessionUrl: `https://example.com/sessions/${sessionId}/abort`,
      maxBytesPerRequest: command.batchConfig.maxBytesPerRequest,
    };
  }
}
