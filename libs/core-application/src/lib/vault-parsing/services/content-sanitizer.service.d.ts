import { type LoggerPort } from '@core-domain';
import { type PublishableNote } from '@core-domain/entities/publishable-note';
import { type SanitizationRules } from '@core-domain/entities/sanitization-rules';
import { type BaseService } from '../../common/base-service';
export declare class ContentSanitizerService implements BaseService {
    private readonly vpsCleanupRules;
    private readonly frontmatterKeysToExclude?;
    private readonly frontmatterTagsToExclude?;
    private readonly logger?;
    constructor(vpsCleanupRules?: SanitizationRules[], frontmatterKeysToExclude?: string[] | undefined, frontmatterTagsToExclude?: string[] | undefined, logger?: LoggerPort | undefined);
    process(notes: PublishableNote[]): PublishableNote[];
    private sanitizeFrontmatter;
    private sanitizeTags;
    private sanitizeContent;
    private compileRules;
    private removeNestedKeys;
    private deleteNestedPath;
    private deletePathRecursive;
    private stripFrontmatter;
}
//# sourceMappingURL=content-sanitizer.service.d.ts.map