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

          const expr = trimmed.slice(1).trim(); // "this.titres"
          const THIS_PREFIX = 'this.';

          if (!expr.startsWith(THIS_PREFIX)) {
            this._logger.debug(`Skipping expression without 'this.': ${expr}`);
            return fullMatch;
          }

          const propertyPath = expr.slice(THIS_PREFIX.length).trim();
          if (!propertyPath) {
            this._logger.debug('Property path is empty after "this."');
            return fullMatch;
          }

          const resolvedValue = this.getValueFromFrontmatter(
            frontmatter,
            propertyPath,
            this._logger
          );
          const renderedText = this.renderValue(resolvedValue, this._logger);

          expressions.push({
            raw: fullMatch,
            code: codeRaw,
            expression: expr,
            propertyPath,
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
