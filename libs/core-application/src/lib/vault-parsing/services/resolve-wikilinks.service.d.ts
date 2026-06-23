import { type LoggerPort } from '@core-domain';
import { type PublishableNote } from '@core-domain';
import { type BaseService } from '../../common/base-service';
import { type DetectWikilinksService } from './detect-wikilinks.service';
export declare class ResolveWikilinksService implements BaseService {
    private readonly detectWikilinksService;
    private readonly _logger;
    constructor(logger: LoggerPort, detectWikilinksService: DetectWikilinksService);
    process(notes: PublishableNote[]): PublishableNote[];
    private buildNoteLookup;
    private addLookupEntry;
    private findTargetNoteForWikilink;
    private findTargetNote;
    private getLookupNotes;
    private getUniqueCandidate;
    private normalizePath;
    private dirname;
    private joinPaths;
    private basename;
    private stripExtension;
    private normalizeKey;
    private slugifyPath;
    private slugifySegment;
    private extractAliases;
}
//# sourceMappingURL=resolve-wikilinks.service.d.ts.map