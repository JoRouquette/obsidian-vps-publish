import { type LoggerPort } from '@core-domain';
import { type PublishableNote } from '@core-domain/entities/publishable-note';
import { type BaseService } from '../../common/base-service';
/**
 * Service responsable de garantir qu'un header markdown correspondant au titre
 * de la note existe dans le contenu, juste après le frontmatter.
 *
 * Si le header existe déjà, ne fait rien.
 * Sinon, insère un header avec un niveau approprié calculé selon les headers existants.
 */
export declare class EnsureTitleHeaderService implements BaseService {
    private readonly logger?;
    constructor(logger?: LoggerPort | undefined);
    process(notes: PublishableNote[]): PublishableNote[];
    private ensureTitleHeader;
    /**
     * Extrait tous les headers markdown du contenu avec leur niveau et texte.
     */
    private extractHeaders;
    /**
     * Vérifie si un header correspondant au titre existe déjà.
     * Comparaison insensible à la casse et au markdown inline basique.
     */
    private hasTitleHeader;
    /**
     * Normalise le texte d'un header pour comparaison :
     * - Trim
     * - Lowercase
     * - Suppression du markdown inline basique (*italique*, **gras**, etc.)
     */
    private normalizeHeaderText;
    /**
     * Calcule le niveau de header à insérer selon les headers existants.
     *
     * Règles :
     * - Si aucun header : H1
     * - Si seulement H2+ : H1
     * - Si seulement H3+ : H2
     * - Sinon : max(1, niveauMin - 1)
     */
    private calculateHeaderLevel;
    /**
     * Insère le header de titre au début du contenu (après une éventuelle ligne vide).
     */
    private insertTitleHeader;
}
//# sourceMappingURL=ensure-title-header.service.d.ts.map