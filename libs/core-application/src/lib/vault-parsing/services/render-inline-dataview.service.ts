import type { DomainFrontmatter } from '@core-domain/entities/domain-frontmatter';
import type { InlineDataviewExpression } from '@core-domain/entities/inline-dataview-expression';
import type { PublishableNote } from '@core-domain/entities/publishable-note';
import type { LoggerPort } from '@core-domain/ports/logger-port';

import { type BaseService } from '../../common/base-service';

const INLINE_CODE_REGEX = /`([^`]*?)`/g;

export class RenderInlineDataviewService implements BaseService {
  private readonly _logger: LoggerPort;

  constructor(logger: LoggerPort) {
    this._logger = logger.child({ usecase: 'RenderInlineDataviewUseCase' });
  }

  process(notes: PublishableNote[]): PublishableNote[] {
    this._logger.debug('Starting inline dataview rendering for notes:', notes);

    return notes.map((note) => {
      const { content, frontmatter } = note;

      const expressions: InlineDataviewExpression[] = [];

      const renderedMarkdown = content.replace(
        INLINE_CODE_REGEX,
        (fullMatch: string, innerCode: string) => {
          const codeRaw = innerCode;
          const trimmed = codeRaw.trim();

          if (!trimmed.startsWith('=')) {
            this._logger.debug(`Skipping non-dataview inline code: ${fullMatch}`);
            return fullMatch;
          }

          const expr = trimmed.slice(1).trim(); // Retire le '=' initial

          // Évaluer l'expression (peut contenir join(), this.property, etc.)
          const resolvedValue = this.evaluateExpression(expr, frontmatter, this._logger);
          const renderedText = this.renderValue(resolvedValue, this._logger);

          expressions.push({
            raw: fullMatch,
            code: codeRaw,
            expression: expr,
            propertyPath: this.extractPropertyPath(expr),
            resolvedValue,
            renderedText,
          });

          this._logger.debug(
            `Replaced inline code '${fullMatch}' with rendered value: '${renderedText}'`
          );

          return renderedText;
        }
      );

      this._logger.debug(`Rendered ${expressions.length} inline dataview expressions in note.`);

      return {
        ...note,
        content: renderedMarkdown,
      };
    });
  }

  /**
   * Évalue une expression Dataview inline.
   * Gère :
   *  - `this.property` : accès direct
   *  - `join(this.property, separator)` : jointure de liste
   *  - Autres fonctions peuvent être ajoutées ici
   */
  private evaluateExpression(
    expr: string,
    frontmatter: DomainFrontmatter,
    logger: LoggerPort
  ): unknown {
    const trimmedExpr = expr.trim();

    // Pattern pour join(this.property, "separator")
    const joinMatch = trimmedExpr.match(/^join\(\s*(this\.[^,]+)\s*,\s*["']([^"']*)["']\s*\)$/);
    if (joinMatch) {
      const propertyPath = joinMatch[1].replace(/^this\./, '').trim();
      const separator = joinMatch[2];
      logger.debug(
        `Detected join() function: property='${propertyPath}', separator='${separator}'`
      );

      const value = this.getValueFromFrontmatter(frontmatter, propertyPath, logger);

      // Normaliser en array si nécessaire
      const arrayValue = this.normalizeToArray(value);

      // Joindre avec le séparateur
      return arrayValue.map((v) => String(v)).join(separator);
    }

    // Pattern pour this.property simple
    const THIS_PREFIX = 'this.';
    if (trimmedExpr.startsWith(THIS_PREFIX)) {
      const propertyPath = trimmedExpr.slice(THIS_PREFIX.length).trim();
      if (!propertyPath) {
        logger.debug('Property path is empty after "this."');
        return undefined;
      }
      return this.getValueFromFrontmatter(frontmatter, propertyPath, logger);
    }

    logger.debug(`Expression '${expr}' not recognized, returning undefined`);
    return undefined;
  }

  /**
   * Extrait le chemin de propriété principal d'une expression.
   * Ex: "join(this.effets, ' ')" → "effets"
   *     "this.titres" → "titres"
   */
  private extractPropertyPath(expr: string): string {
    const joinMatch = expr.match(/join\(\s*this\.([^,]+)/);
    if (joinMatch) {
      return joinMatch[1].trim();
    }

    const thisMatch = expr.match(/this\.(.+)/);
    if (thisMatch) {
      return thisMatch[1].trim();
    }

    return '';
  }

  /**
   * Normalise une valeur en array.
   * - Si déjà array : retour tel quel
   * - Si string : wrap dans un array à un élément
   * - Si null/undefined : array vide
   * - Sinon : wrap dans array
   */
  private normalizeToArray(value: unknown): unknown[] {
    if (value === null || value === undefined) {
      return [];
    }
    if (Array.isArray(value)) {
      return value;
    }
    // Chaîne simple ou autre type scalaire : wrap dans un array
    return [value];
  }

  private getValueFromFrontmatter(
    frontmatter: DomainFrontmatter,
    propertyPath: string,
    logger: LoggerPort
  ): unknown {
    const segments = propertyPath.split('.').filter(Boolean);
    let current: unknown = frontmatter.nested;

    for (const segment of segments) {
      if (current == null || typeof current !== 'object') {
        logger.debug(`Property path segment '${segment}' not found in frontmatter.`);
        return undefined;
      }
      current = (current as Record<string, unknown>)[segment];
    }

    logger.debug(`Resolved property path '${propertyPath}' to value:`, current);
    return current;
  }

  private renderValue(value: unknown, logger: LoggerPort): string {
    if (value === null || value === undefined) {
      logger.debug('Value is null or undefined, rendering as empty string.');
      return '';
    }

    if (Array.isArray(value)) {
      logger.debug('Rendering array value:', value);
      return value.map((v) => String(v)).join(', ');
    }

    logger.debug('Rendering scalar value:', value);
    return String(value);
  }
}
