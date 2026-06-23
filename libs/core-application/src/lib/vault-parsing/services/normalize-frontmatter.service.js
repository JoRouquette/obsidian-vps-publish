"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.NormalizeFrontmatterService = void 0;
const string_utils_1 = require("@core-domain/utils/string.utils");
class NormalizeFrontmatterService {
    constructor(logger) {
        this._logger = logger.child({ scope: 'vault-parsing', operation: 'normalizeFrontmatter' });
    }
    process(input) {
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
        const results = [];
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
                const flat = {};
                const nested = {};
                for (const [key, value] of Object.entries(source)) {
                    try {
                        const normalizedKey = (0, string_utils_1.normalizePropertyKey)(key);
                        flat[normalizedKey] = value;
                        this.setNestedValue(nested, key, value);
                    }
                    catch (entryError) {
                        this._logger.warn('Failed to process frontmatter entry', {
                            noteId: note.noteId,
                            key,
                            error: entryError instanceof Error ? entryError.message : String(entryError),
                        });
                        // Continue with next entry
                    }
                }
                const tagsRaw = source['tags'] ??
                    (this.isDomainFrontmatter(frontmatter) ? frontmatter.tags : undefined);
                const tags = Array.isArray(tagsRaw) && tagsRaw.every((t) => typeof t === 'string')
                    ? tagsRaw
                    : typeof tagsRaw === 'string'
                        ? [tagsRaw]
                        : [];
                results.push({ ...note, frontmatter: { flat, nested, tags } });
            }
            catch (error) {
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
    extractRawFrontmatter(frontmatter) {
        if (this.isDomainFrontmatter(frontmatter) && frontmatter.flat) {
            return frontmatter.flat;
        }
        if (frontmatter && typeof frontmatter === 'object') {
            return frontmatter;
        }
        return null;
    }
    isDomainFrontmatter(value) {
        return (!!value &&
            typeof value === 'object' &&
            'flat' in value &&
            'nested' in value &&
            'tags' in value);
    }
    setNestedValue(target, path, value) {
        const segments = path.split('.').map(string_utils_1.normalizePropertyKey);
        // Safety check: limit depth to prevent deep nesting issues
        if (segments.length > 10) {
            this._logger.debug('Frontmatter path exceeds depth limit, flattening', {
                path,
                depth: segments.length,
            });
            target[path] = value;
            return;
        }
        let current = target;
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
exports.NormalizeFrontmatterService = NormalizeFrontmatterService;
