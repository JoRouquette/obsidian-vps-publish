import { type PublishableNote } from '@core-domain/entities';
import type { WikilinkRef } from '@core-domain/entities/wikilink-ref';
import type { LoggerPort } from '@core-domain/ports/logger-port';
import { type BaseService } from '../../common/base-service';
export declare class DetectWikilinksService implements BaseService {
    private readonly _logger;
    constructor(logger: LoggerPort);
    process(note: PublishableNote): WikilinkRef[];
    private inferKind;
    private isAssetEmbed;
    private splitOnce;
    private detectInText;
    /**
     * Detect markdown links to .md files and convert them to wikilink references.
     * Supports:
     * - [text](file.md)
     * - [text](path/to/file.md)
     * - [text](file.md#section)
     */
    private detectMarkdownLinks;
}
//# sourceMappingURL=detect-wikilinks.service.d.ts.map