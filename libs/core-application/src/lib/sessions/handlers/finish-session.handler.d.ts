import { type LoggerPort } from '@core-domain';
import { type CommandHandler } from '../../common/command-handler';
import { type FinishSessionCommand } from '../commands/finish-session.command';
import { type FinishSessionResult } from '../commands/finish-session.result';
import { type SessionRepository } from '../ports/session.repository';
export declare class FinishSessionHandler implements CommandHandler<FinishSessionCommand, FinishSessionResult> {
    private readonly sessionRepository;
    private readonly logger?;
    constructor(sessionRepository: SessionRepository, logger?: LoggerPort);
    handle(command: FinishSessionCommand): Promise<FinishSessionResult>;
}
//# sourceMappingURL=finish-session.handler.d.ts.map