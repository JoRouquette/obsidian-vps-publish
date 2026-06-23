import { type LoggerPort } from '@core-domain';
import { type CommandHandler } from '../../common/command-handler';
import { type AbortSessionCommand } from '../commands/abort-session.command';
import { type AbortSessionResult } from '../commands/abort-session.result';
import { type SessionRepository } from '../ports/session.repository';
export declare class AbortSessionHandler implements CommandHandler<AbortSessionCommand, AbortSessionResult> {
    private readonly sessionRepository;
    private readonly logger?;
    constructor(sessionRepository: SessionRepository, logger?: LoggerPort);
    handle(command: AbortSessionCommand): Promise<AbortSessionResult>;
}
//# sourceMappingURL=abort-session.handler.d.ts.map