"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ResolveWikilinksService = void 0;
const internal_link_path_util_1 = require("../../utils/internal-link-path.util");
class ResolveWikilinksService {
    constructor(logger, detectWikilinksService) {
        this.detectWikilinksService = detectWikilinksService;
        this._logger = logger.child({ scope: 'vault-parsing', operation: 'resolveWikilinks' });
    }
    process(notes) {
        const startTime = Date.now();
        let totalWikilinks = 0;
        let resolvedCount = 0;
        let unresolvedCount = 0;
        const wikilinksByNotes = {};
        const lookup = this.buildNoteLookup(notes);
        for (const note of notes) {
            const markdownLinks = this.detectWikilinksService.process(note);
            if (markdownLinks.length === 0) {
                this._logger.debug('No wikilinks found in note', { noteId: note.noteId });
                continue;
            }
            wikilinksByNotes[note.noteId] = markdownLinks;
            totalWikilinks += markdownLinks.length;
        }
        for (const note of notes) {
            const wikilinks = wikilinksByNotes[note.noteId] || [];
            const resolvedWikilinks = wikilinks.map((wikilink) => {
                const targetNote = this.findTargetNoteForWikilink(wikilink, note, lookup);
                const targetPath = targetNote?.routing?.fullPath;
                const isResolved = !!targetNote && targetNote.routing !== undefined;
                const targetNoteId = targetNote?.noteId;
                const href = !wikilink.path && wikilink.subpath
                    ? `#${wikilink.subpath}`
                    : targetPath && wikilink.subpath
                        ? `${targetPath}#${wikilink.subpath}`
                        : (targetPath ?? undefined);
                if (isResolved) {
                    resolvedCount++;
                }
                else {
                    unresolvedCount++;
                }
                return {
                    ...wikilink,
                    isResolved,
                    targetNoteId,
                    href,
                    path: targetPath ?? wikilink.path,
                };
            });
            note.resolvedWikilinks = resolvedWikilinks;
        }
        this._logger.info('Wikilink resolution complete', {
            notesProcessed: notes.length,
            totalWikilinks,
            resolved: resolvedCount,
            unresolved: unresolvedCount,
            durationMs: Date.now() - startTime,
        });
        return notes;
    }
    buildNoteLookup(notes) {
        const lookup = {
            exactPath: new Map(),
            slugPath: new Map(),
            basename: new Map(),
            basenameSlug: new Map(),
            titleSlug: new Map(),
            alias: new Map(),
            aliasSlug: new Map(),
        };
        for (const note of notes) {
            const normalizedPath = this.normalizePath(this.stripExtension(note.relativePath));
            const basename = this.basename(normalizedPath);
            const basenameSlug = this.slugifySegment(basename);
            const slugPath = this.slugifyPath(normalizedPath);
            const titleSlug = this.slugifySegment(note.title);
            const aliases = this.extractAliases(note);
            this.addLookupEntry(lookup.exactPath, normalizedPath, note);
            this.addLookupEntry(lookup.slugPath, slugPath, note);
            this.addLookupEntry(lookup.basename, basename, note);
            this.addLookupEntry(lookup.basenameSlug, basenameSlug, note);
            this.addLookupEntry(lookup.titleSlug, titleSlug, note);
            for (const alias of aliases) {
                this.addLookupEntry(lookup.alias, alias, note);
                this.addLookupEntry(lookup.aliasSlug, this.slugifySegment(alias), note);
            }
        }
        return lookup;
    }
    addLookupEntry(map, rawKey, note) {
        const key = this.normalizeKey(rawKey);
        if (!key) {
            return;
        }
        const existing = map.get(key);
        if (existing) {
            existing.push(note);
            return;
        }
        map.set(key, [note]);
    }
    findTargetNoteForWikilink(wikilink, currentNote, lookup) {
        if (!wikilink.path && wikilink.subpath) {
            return currentNote;
        }
        return this.findTargetNote(wikilink.path, currentNote, lookup);
    }
    findTargetNote(target, currentNote, lookup) {
        const normalizedTarget = this.normalizePath(this.stripExtension(target));
        const resolvedRelativeTarget = (0, internal_link_path_util_1.resolveRelativeInternalLinkPath)(normalizedTarget, currentNote.relativePath);
        if (!resolvedRelativeTarget) {
            return undefined;
        }
        const targetHasFolders = resolvedRelativeTarget.includes('/');
        if (!targetHasFolders) {
            const currentFolderTarget = this.joinPaths(this.dirname(this.stripExtension(currentNote.relativePath)), resolvedRelativeTarget);
            const sameFolderMatch = this.getUniqueCandidate([
                ...this.getLookupNotes(lookup.exactPath, currentFolderTarget),
                ...this.getLookupNotes(lookup.slugPath, this.slugifyPath(currentFolderTarget)),
            ], target, currentNote, 'same-folder');
            if (sameFolderMatch) {
                return sameFolderMatch;
            }
        }
        const exactMatch = this.getUniqueCandidate([
            ...this.getLookupNotes(lookup.exactPath, resolvedRelativeTarget),
            ...this.getLookupNotes(lookup.slugPath, this.slugifyPath(resolvedRelativeTarget)),
        ], target, currentNote, targetHasFolders ? 'path' : 'exact');
        if (exactMatch || targetHasFolders) {
            return exactMatch;
        }
        return this.getUniqueCandidate([
            ...this.getLookupNotes(lookup.basename, (0, internal_link_path_util_1.getInternalLinkBasename)(resolvedRelativeTarget)),
            ...this.getLookupNotes(lookup.basenameSlug, this.slugifySegment(resolvedRelativeTarget)),
            ...this.getLookupNotes(lookup.titleSlug, this.slugifySegment(resolvedRelativeTarget)),
            ...this.getLookupNotes(lookup.alias, resolvedRelativeTarget),
            ...this.getLookupNotes(lookup.aliasSlug, this.slugifySegment(resolvedRelativeTarget)),
        ], target, currentNote, 'basename');
    }
    getLookupNotes(map, rawKey) {
        const key = this.normalizeKey(rawKey);
        return key ? (map.get(key) ?? []) : [];
    }
    getUniqueCandidate(candidates, target, currentNote, strategy) {
        const unique = Array.from(new Map(candidates.map((note) => [note.noteId, note])).values());
        if (unique.length <= 1) {
            return unique[0];
        }
        this._logger.warn('Ambiguous wikilink target left unresolved', {
            currentNote: currentNote.relativePath,
            target,
            strategy,
            candidatePaths: unique.map((note) => note.relativePath),
        });
        return undefined;
    }
    normalizePath(path) {
        return (0, internal_link_path_util_1.normalizeInternalLinkPath)(path);
    }
    dirname(path) {
        const normalized = this.normalizePath(path);
        const lastSlash = normalized.lastIndexOf('/');
        return lastSlash === -1 ? '' : normalized.slice(0, lastSlash);
    }
    joinPaths(left, right) {
        return [left, right].filter(Boolean).join('/');
    }
    basename(path) {
        return (0, internal_link_path_util_1.getInternalLinkBasename)(path);
    }
    stripExtension(path) {
        return path.replace(/\.[^/.]+$/, '');
    }
    normalizeKey(value) {
        return (0, internal_link_path_util_1.normalizeInternalLinkKey)(value);
    }
    slugifyPath(path) {
        const normalized = this.normalizePath(path);
        if (!normalized)
            return '';
        return normalized
            .split('/')
            .filter(Boolean)
            .map((segment) => this.slugifySegment(segment))
            .filter(Boolean)
            .join('/');
    }
    slugifySegment(segment) {
        return segment
            .normalize('NFD')
            .replace(/[\u0300-\u036f]/g, '')
            .replace(/[^a-zA-Z0-9\s]/g, ' ')
            .replace(/\s{2,}/g, ' ')
            .trim()
            .toLowerCase()
            .replace(/\s/g, '-');
    }
    extractAliases(note) {
        const rawAliases = note.frontmatter?.flat?.['aliases'];
        if (typeof rawAliases === 'string') {
            return rawAliases.trim() ? [rawAliases.trim()] : [];
        }
        if (!Array.isArray(rawAliases)) {
            return [];
        }
        return rawAliases
            .filter((alias) => typeof alias === 'string')
            .map((alias) => alias.trim())
            .filter(Boolean);
    }
}
exports.ResolveWikilinksService = ResolveWikilinksService;
