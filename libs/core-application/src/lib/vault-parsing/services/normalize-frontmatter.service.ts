import { type CollectedNote } from '@core-domain';
import type { DomainFrontmatter } from '@core-domain/entities/domain-frontmatter';
import { type LoggerPort } from '@core-domain/ports/logger-port';
import { normalizePropertyKey } from '@core-domain/utils/string.utils';

import { type BaseService } from '../../common/base-service';

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

    const results: CollectedNote[] = [];

    for (let i = 0; i < input.length; i++) {
      const note = input[i];
      try {
        this._logger.warn(`📌 START processing note ${i}`, {
          noteIndex: i,
          noteId: note.noteId,
          vaultPath: note.vaultPath,
        });

        const frontmatter = note.frontmatter;
        const source = this.extractRawFrontmatter(frontmatter);

        if (!source) {
          this._logger.error('No frontmatter in note, setting empty frontmatter', {
            noteIndex: i,
            noteId: note.noteId,
            vaultPath: note.vaultPath,
          });
          results.push({ ...note, frontmatter: { flat: {}, nested: {}, tags: [] } });
          continue;
        }

        this._logger.warn(
          `📝 Processing ${Object.keys(source).length} frontmatter entries for note ${i}`
        );

        const flat: Record<string, unknown> = {};
        const nested: Record<string, unknown> = {};

        let entryCount = 0;
        for (const [key, value] of Object.entries(source)) {
          try {
            this._logger.warn(`🔑 Processing frontmatter entry ${entryCount}: key="${key}"`);
            const normalizedKey = normalizePropertyKey(key);
            flat[normalizedKey] = value;
            this._logger.warn(`📍 About to call setNestedValue for entry ${entryCount}`);
            this.setNestedValue(nested, key, value);
            this._logger.warn(`✅ setNestedValue completed for entry ${entryCount}`);
            entryCount++;
          } catch (entryError) {
            this._logger.error(`❌ Error processing frontmatter entry ${entryCount}`, {
              key,
              error: entryError instanceof Error ? entryError.message : String(entryError),
              stack: entryError instanceof Error ? entryError.stack : undefined,
            });
            // Continue with next entry
          }
        }

        this._logger.warn(`🏷️ Extracting tags for note ${i}`);

        const tagsRaw =
          (source as Record<string, unknown>)['tags'] ??
          (this.isDomainFrontmatter(frontmatter) ? frontmatter.tags : undefined);
        const tags =
          Array.isArray(tagsRaw) && tagsRaw.every((t) => typeof t === 'string')
            ? (tagsRaw as string[])
            : typeof tagsRaw === 'string'
              ? [tagsRaw]
              : [];

        this._logger.warn(`✅ Note ${i} processed, building result object`);

        this._logger.warn('Frontmatter normalization result', {
          noteIndex: i,
          noteId: note.noteId,
          flatKeysCount: Object.keys(flat).length,
          nestedKeysCount: Object.keys(nested).length,
          tagsCount: tags.length,
        });

        this._logger.warn(`💾 Pushing result for note ${i} to results array`);

        results.push({ ...note, frontmatter: { flat, nested, tags } });

        this._logger.warn(`✅ DONE processing note ${i}`);
      } catch (error) {
        this._logger.error('Error processing note frontmatter', {
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

    this._logger.warn('✅ All notes frontmatter normalized', {
      totalNotes: input.length,
      successCount: results.length,
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

    // Safety check: limit depth to prevent infinite loops
    if (segments.length > 10) {
      this._logger.warn('⚠️ Frontmatter path too deep, flattening', {
        path,
        depth: segments.length,
      });
      // Just set at top level with full path as key
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
