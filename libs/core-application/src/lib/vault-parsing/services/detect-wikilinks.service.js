"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.DetectWikilinksService = void 0;
const internal_link_path_util_1 = require("../../utils/internal-link-path.util");
const frontmatter_strings_util_1 = require("../utils/frontmatter-strings.util");
/**
 * Regex to capture wikilinks [[...]].
 * Asset embeds are filtered out by checking the preceding "!".
 */
const WIKILINK_REGEX = /\[\[([^\]]+)\]\]/g;
/**
 * Regex to capture markdown links to .md files [text](file.md) or [text](file.md#section).
 * These are treated as wikilinks for resolution purposes.
 */
const MARKDOWN_LINK_REGEX = /\[([^\]]+)\]\(([^)]+\.md(?:#[^)]*)?)\)/gi;
class DetectWikilinksService {
    constructor(logger) {
        this._logger = logger.child({ scope: 'vault-parsing', operation: 'detectWikilinks' });
    }
    process(note) {
        const wikilinks = [];
        this._logger.debug('Starting wikilink detection for note', {
            noteId: note.noteId,
        });
        const fromContent = this.detectInText(note.content, 'content');
        wikilinks.push(...fromContent);
        const fromMarkdownLinks = this.detectMarkdownLinks(note.content, 'content');
        wikilinks.push(...fromMarkdownLinks);
        const frontmatter = note.frontmatter?.nested;
        if (frontmatter && typeof frontmatter === 'object') {
            const strings = (0, frontmatter_strings_util_1.extractFrontmatterStrings)(frontmatter);
            for (const entry of strings) {
                const detected = this.detectInText(entry.value, 'frontmatter', entry.path);
                wikilinks.push(...detected);
                const markdownLinks = this.detectMarkdownLinks(entry.value, 'frontmatter', entry.path);
                wikilinks.push(...markdownLinks);
            }
        }
        if (wikilinks.length === 0) {
            this._logger.debug('No wikilinks detected in note', {
                noteId: note.noteId,
            });
            return [];
        }
        this._logger.debug('Detected wikilinks in note', {
            noteId: note.noteId,
            count: wikilinks.length,
        });
        return wikilinks;
    }
    inferKind(path) {
        const lower = path.toLowerCase();
        if (lower.match(/\.(png|jpe?g|gif|webp|svg|mp3|wav|flac|ogg|mp4|webm|mkv|mov|pdf|md|markdown)$/)) {
            return 'file';
        }
        return 'note';
    }
    isAssetEmbed(path) {
        return /\.(png|jpe?g|gif|webp|svg|mp3|wav|flac|ogg|mp4|webm|mkv|mov|pdf)$/i.test(path);
    }
    splitOnce(input, separator) {
        const index = input.indexOf(separator);
        if (index === -1)
            return [input, undefined];
        return [input.slice(0, index), input.slice(index + separator.length)];
    }
    detectInText(markdown, origin, frontmatterPath) {
        const wikilinks = [];
        WIKILINK_REGEX.lastIndex = 0;
        let match;
        let matchesFound = 0;
        let skippedEmpty = 0;
        let skippedAssetEmbed = 0;
        let skippedEmptyTarget = 0;
        let skippedEmptyPath = 0;
        while ((match = WIKILINK_REGEX.exec(markdown)) !== null) {
            matchesFound++;
            const fullMatch = match[0]; // "[[...]]"
            const inner = match[1].trim();
            if (!inner) {
                skippedEmpty++;
                continue;
            }
            const startIndex = match.index ?? 0;
            const isEmbed = startIndex > 0 && markdown[startIndex - 1] === '!';
            const [targetPart, aliasPart] = this.splitOnce(inner, '|');
            const targetRaw = targetPart.trim();
            const alias = aliasPart && aliasPart.trim().length > 0 ? aliasPart.trim() : undefined;
            if (!targetRaw) {
                skippedEmptyTarget++;
                continue;
            }
            const [pathPart, subpathPart] = this.splitOnce(targetRaw, '#');
            const path = pathPart.trim();
            const subpath = subpathPart && subpathPart.trim().length > 0 ? subpathPart.trim() : undefined;
            if (isEmbed && path && this.isAssetEmbed(path)) {
                skippedAssetEmbed++;
                continue;
            }
            if (!path && !subpath) {
                skippedEmptyPath++;
                continue;
            }
            const kind = path ? this.inferKind(path) : 'note';
            const wikilink = {
                origin,
                frontmatterPath,
                raw: fullMatch,
                target: targetRaw,
                path,
                subpath,
                alias,
                embed: isEmbed,
                kind,
            };
            wikilinks.push(wikilink);
        }
        if (matchesFound > 0) {
            this._logger.debug('Detected wikilinks in text', {
                origin,
                frontmatterPath,
                matchesFound,
                wikilinksDetected: wikilinks.length,
                skipped: {
                    empty: skippedEmpty,
                    assetEmbed: skippedAssetEmbed,
                    emptyTarget: skippedEmptyTarget,
                    emptyPath: skippedEmptyPath,
                },
            });
        }
        return wikilinks;
    }
    /**
     * Detect markdown links to .md files and convert them to wikilink references.
     * Supports:
     * - [text](file.md)
     * - [text](path/to/file.md)
     * - [text](file.md#section)
     */
    detectMarkdownLinks(markdown, origin, frontmatterPath) {
        const wikilinks = [];
        MARKDOWN_LINK_REGEX.lastIndex = 0;
        let match;
        let matchesFound = 0;
        let skippedExternal = 0;
        while ((match = MARKDOWN_LINK_REGEX.exec(markdown)) !== null) {
            matchesFound++;
            const fullMatch = match[0]; // "[text](file.md)"
            const alias = match[1].trim();
            const href = match[2].trim(); // "file.md" or "file.md#section"
            // Skip external URLs (http://, https://, etc.)
            if (/^https?:\/\//i.test(href)) {
                skippedExternal++;
                continue;
            }
            // Remove .md extension while preserving any fragment, then split.
            const hrefWithoutExt = (0, internal_link_path_util_1.stripMarkdownExtensionPreservingFragment)(href);
            const split = (0, internal_link_path_util_1.splitInternalLinkTarget)(hrefWithoutExt);
            const path = (0, internal_link_path_util_1.normalizeInternalLinkPath)(split.path);
            const subpath = split.fragment;
            if (!path && !subpath) {
                continue;
            }
            const kind = path ? this.inferKind(path) : 'note';
            const wikilink = {
                origin,
                frontmatterPath,
                raw: fullMatch,
                target: path + (subpath ? `#${subpath}` : ''),
                path,
                subpath,
                alias,
                kind,
            };
            wikilinks.push(wikilink);
        }
        if (matchesFound > 0) {
            this._logger.debug('Detected markdown links to .md files', {
                origin,
                frontmatterPath,
                matchesFound,
                wikilinksCreated: wikilinks.length,
                skipped: {
                    external: skippedExternal,
                },
            });
        }
        return wikilinks;
    }
}
exports.DetectWikilinksService = DetectWikilinksService;
