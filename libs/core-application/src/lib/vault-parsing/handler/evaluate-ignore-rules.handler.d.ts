import { type IgnoreRule, type PublishableNote } from '@core-domain';
import type { LoggerPort } from '@core-domain/ports/logger-port';
import { type CommandHandler } from '../../common/command-handler';
export declare class EvaluateIgnoreRulesHandler implements CommandHandler<PublishableNote[], PublishableNote[]> {
    private readonly rules;
    private readonly _logger;
    constructor(rules: IgnoreRule[], logger: LoggerPort);
    handle(input: PublishableNote[]): Promise<PublishableNote[]>;
}
//# sourceMappingURL=evaluate-ignore-rules.handler.d.ts.map