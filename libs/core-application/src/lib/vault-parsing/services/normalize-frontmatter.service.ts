import { CollectedNote } from '@core-domain';
import type { PublishableNote } from '@core-domain/entities/publishable-note';
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
      if (!frontmatter) {
        this._logger.error('No frontmatter in note, setting empty frontmatter', { note });
        return { ...note, frontmatter: { flat: {}, nested: {}, tags: [] } };
      }

      const flat: Record<string, unknown> = {};
      const nested: Record<string, unknown> = {};

      for (const [key, value] of Object.entries(frontmatter)) {
        const normalizedKey = normalizePropertyKey(key);
        this._logger.debug('Processing frontmatter entry', {
          key,
          normalizedKey,
          value,
        });
        flat[normalizedKey] = value;
        if (normalizedKey.includes('.')) {
          this._logger.debug('Setting nested value', { normalizedKey, value });
          this.setNestedValue(nested, normalizedKey, value);
        } else {
          if (
            typeof nested[normalizedKey] === 'undefined' ||
            (nested[normalizedKey] &&
              typeof nested[normalizedKey] === 'object' &&
              Object.keys(nested[normalizedKey] as object).length === 0)
          ) {
            nested[normalizedKey] = value;
          }
        }
      }

      const tagsRaw = frontmatter['tags'];
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
