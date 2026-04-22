import { type CollectedNote } from '@core-domain';
import type { DomainFrontmatter } from '@core-domain/entities/domain-frontmatter';
import { type LoggerPort } from '@core-domain/ports/logger-port';
import { normalizePropertyKey } from '@core-domain/utils/string.utils';

import { type BaseService } from '../../common/base-service';

export class NormalizeFrontmatterService implements BaseService {
  private readonly _logger: LoggerPort;

  constructor(logger: LoggerPort) {
    this._logger = logger.child({ scope: 'vault-parsing', operation: 'normalizeFrontmatter' });
  }

  process(input?: CollectedNote[]): CollectedNote[] {
    const startTime = Date.now();

    if (!input || !Array.isArray(input)) {
      this._logger.warn('Invalid input provided to NormalizeFrontmatterService', {
        inputType: typeof input,
        isArray: Array.isArray(input),
      });
      return [];
    }

    this._logger.debug('Starting frontmatter normalization', {
      notesCount: input.length,
    });

    const results: CollectedNote[] = [];
    let errorsCount = 0;

    for (let i = 0; i < input.length; i++) {
      const note = input[i];
      try {
        const frontmatter = note.frontmatter;
        const source = this.extractRawFrontmatter(frontmatter);

        if (!source) {
          this._logger.debug('Note has no frontmatter, using empty', {
            noteId: note.noteId,
            vaultPath: note.vaultPath,
          });
          results.push({ ...note, frontmatter: { flat: {}, nested: {}, tags: [] } });
          continue;
        }

        const flat: Record<string, unknown> = {};
        const nested: Record<string, unknown> = {};

        for (const [key, value] of Object.entries(source)) {
          try {
            const normalizedKey = normalizePropertyKey(key);
            flat[normalizedKey] = value;
            this.setNestedValue(nested, key, value);
          } catch (entryError) {
            this._logger.warn('Failed to process frontmatter entry', {
              noteId: note.noteId,
              key,
              error: entryError instanceof Error ? entryError.message : String(entryError),
            });
            // Continue with next entry
          }
        }

        const tagsRaw =
          (source as Record<string, unknown>)['tags'] ??
          (this.isDomainFrontmatter(frontmatter) ? frontmatter.tags : undefined);
        const tags =
          Array.isArray(tagsRaw) && tagsRaw.every((t) => typeof t === 'string')
            ? (tagsRaw as string[])
            : typeof tagsRaw === 'string'
              ? [tagsRaw]
              : [];

        results.push({ ...note, frontmatter: { flat, nested, tags } });
      } catch (error) {
        errorsCount++;
        this._logger.error('Failed to normalize frontmatter for note', {
          noteIndex: i,
          noteId: note.noteId,
          vaultPath: note.vaultPath,
          error: error instanceof Error ? error.message : String(error),
          stack: error instanceof Error ? error.stack : undefined,
        });
        // Return note with empty frontmatter on error
        results.push({ ...note, frontmatter: { flat: {}, nested: {}, tags: [] } });
      }
    }

    const duration = Date.now() - startTime;
    this._logger.info('Frontmatter normalization completed', {
      totalNotes: input.length,
      successCount: results.length - errorsCount,
      errorsCount,
      durationMs: duration,
    });

    return results;
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

    // Safety check: limit depth to prevent deep nesting issues
    if (segments.length > 10) {
      this._logger.debug('Frontmatter path exceeds depth limit, flattening', {
        path,
        depth: segments.length,
      });
      target[path] = value;
      return;
    }

    let current: Record<string, unknown> = target;

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
      current = current[key] as Record<string, unknown>;
    }
  }
}
