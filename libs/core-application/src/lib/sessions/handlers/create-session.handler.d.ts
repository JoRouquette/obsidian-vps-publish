import { type LoggerPort } from '@core-domain';
import { type CommandHandler } from '../../common/command-handler';
import { type IdGeneratorPort } from '../../ports/id-generator.port';
import { type ManifestPort } from '../../publishing/ports/manifest-storage.port';
import { type CreateSessionCommand } from '../commands/create-session.command';
import { type CreateSessionResult } from '../commands/create-session.result';
import { type SessionRepository } from '../ports/session.repository';
export declare class CreateSessionHandler implements CommandHandler<CreateSessionCommand, CreateSessionResult> {
    private readonly idGenerator;
    private readonly sessionRepository;
    private readonly manifestStorage?;
    private readonly logger?;
    constructor(idGenerator: IdGeneratorPort, sessionRepository: SessionRepository, manifestStorage?: ManifestPort | undefined, logger?: LoggerPort);
    handle(command: CreateSessionCommand): Promise<CreateSessionResult>;
}
//# sourceMappingURL=create-session.handler.d.ts.map