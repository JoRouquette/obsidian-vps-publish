import { type CollectedNote } from '@core-domain';
import { type LoggerPort } from '@core-domain/ports/logger-port';
import { type BaseService } from '../../common/base-service';
export declare class NormalizeFrontmatterService implements BaseService {
    private readonly _logger;
    constructor(logger: LoggerPort);
    process(input?: CollectedNote[]): CollectedNote[];
    private extractRawFrontmatter;
    private isDomainFrontmatter;
    private setNestedValue;
}
//# sourceMappingURL=normalize-frontmatter.service.d.ts.map