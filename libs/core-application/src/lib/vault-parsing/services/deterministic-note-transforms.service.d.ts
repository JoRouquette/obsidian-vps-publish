import { type IgnoreRule, type LoggerPort, type PublishableNote } from '@core-domain';
export interface DeterministicNoteTransformsOptions {
    ignoreRules?: IgnoreRule[];
    deduplicationEnabled?: boolean;
    ignoreRulesAlreadyApplied?: boolean;
}
/**
 * Applies deterministic, non-Obsidian-dependent transforms authoritatively.
 * This is the server-owned note pipeline used during session finalization.
 */
export declare class DeterministicNoteTransformsService {
    private readonly logger?;
    constructor(logger?: LoggerPort | undefined);
    process(notes: PublishableNote[], options?: DeterministicNoteTransformsOptions): Promise<PublishableNote[]>;
}
//# sourceMappingURL=deterministic-note-transforms.service.d.ts.map