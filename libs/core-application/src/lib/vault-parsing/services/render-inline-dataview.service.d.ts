import type { DomainFrontmatter } from '@core-domain/entities/domain-frontmatter';
import type { PublishableNote } from '@core-domain/entities/publishable-note';
import type { LoggerPort } from '@core-domain/ports/logger-port';
import { type BaseService } from '../../common/base-service';
export declare class RenderInlineDataviewService implements BaseService {
    private readonly _logger;
    constructor(logger: LoggerPort);
    process(notes: PublishableNote[]): PublishableNote[];
    renderContent(content: string, frontmatter: DomainFrontmatter): string;
    /**
     * Evalue une expression Dataview inline.
     * Gere :
     *  - `this.property` : acces direct
     *  - `join(this.property, separator)` : jointure de liste
     *  - Autres fonctions peuvent etre ajoutees ici
     */
    private evaluateExpression;
    private extractPropertyPath;
    private normalizeToArray;
    private getValueFromFrontmatter;
    private renderValue;
}
//# sourceMappingURL=render-inline-dataview.service.d.ts.map