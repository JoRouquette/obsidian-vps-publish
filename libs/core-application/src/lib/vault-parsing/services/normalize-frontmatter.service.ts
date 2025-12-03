import { BaseService } from '../../common/base-service';
import { CollectedNote } from '@core-domain';
import type { DomainFrontmatter } from '@core-domain/entities/domain-frontmatter';
import { LoggerPort } from '@core-domain/ports/logger-port';
import { normalizePropertyKey } from '@core-domain/utils/string.utils';

export class NormalizeFrontmatterService implements BaseService {
  private readonly _logger: LoggerPort;

  constructor(logger: LoggerPort) {
    this._logger = logger.child({ usecase: 'NormalizeFrontmatterUseCase' });
    this._logger.debug('NormalizeFrontmatterUseCase initialized');
  }

  process(input?: CollectedNote[]): CollectedNote[] {
    this._logger.debug('Normalizing frontmatter for notes', { inputLength: input?.length });

    if (!input || !Array.isArray(input)) {
      this._logger.error('No notes input provided, returning empty array');
      return [];
    }

    return input.map((note) => {
      const frontmatter = note.frontmatter;
      const source = this.extractRawFrontmatter(frontmatter);

      if (!source) {
        this._logger.error('No frontmatter in note, setting empty frontmatter', { note });
        return { ...note, frontmatter: { flat: {}, nested: {}, tags: [] } };
      }

      const flat: Record<string, unknown> = {};
      const nested: Record<string, unknown> = {};

      for (const [key, value] of Object.entries(source)) {
        const normalizedKey = normalizePropertyKey(key);
        this._logger.debug('Processing frontmatter entry', {
          key,
          normalizedKey,
          value,
        });
        flat[normalizedKey] = value;
        this.setNestedValue(nested, key, value);
      }

      const tagsRaw =
        (source as any)['tags'] ??
        (this.isDomainFrontmatter(frontmatter) ? frontmatter.tags : undefined);
      const tags =
        Array.isArray(tagsRaw) && tagsRaw.every((t) => typeof t === 'string')
          ? (tagsRaw as string[])
          : typeof tagsRaw === 'string'
            ? [tagsRaw]
            : [];

      this._logger.debug('Frontmatter normalization result', { flat, nested, tags });
      return { ...note, frontmatter: { flat, nested, tags } };
    });
  }

  private extractRawFrontmatter(frontmatter: unknown): Record<string, unknown> | null {
    if (this.isDomainFrontmatter(frontmatter) && frontmatter.flat) {
      return frontmatter.flat;
    }

    if (frontmatter && typeof frontmatter === 'object') {
      return frontmatter as Record<string, unknown>;
    }

    return null;
  }

  private isDomainFrontmatter(value: unknown): value is DomainFrontmatter {
    return (
      !!value &&
      typeof value === 'object' &&
      'flat' in value &&
      'nested' in value &&
      'tags' in value
    );
  }

  private setNestedValue(target: Record<string, unknown>, path: string, value: unknown): void {
    const segments = path.split('.').map(normalizePropertyKey);
    let current: any = target;

    for (let i = 0; i < segments.length; i++) {
      const key = segments[i];
      const isLast = i === segments.length - 1;

      if (isLast) {
        current[key] = value;
        return;
      }

      if (typeof current[key] !== 'object' || current[key] === null) {
        current[key] = {};
      }
      current = current[key];
    }
  }
}
