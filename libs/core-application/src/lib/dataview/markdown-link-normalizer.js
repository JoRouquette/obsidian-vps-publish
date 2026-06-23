"use strict";
/**
 * Markdown Link Normalizer (Application Layer)
 *
 * RESPONSIBILITY:
 * Converts Dataview Link objects to normalized Obsidian wikilinks.
 *
 * CRITICAL RULES:
 * 1. Remove `.md` extension from vault paths
 * 2. Generate alias = basename (without path, without extension)
 * 3. Format: [[<vaultPathWithoutExt>|<displayTitle>]]
 * 4. NEVER output HTML
 * 5. Handle accents, spaces, apostrophes, special characters
 *
 * EXAMPLES:
 * - {path: "Ektaron/Héléna.md"} → [[Ektaron/Héléna|Héléna]]
 * - {path: "Page.md", display: "Alias"} → [[Page|Alias]]
 * - {path: "Dr Théodoric.md"} → [[Dr Théodoric|Dr Théodoric]]
 * - {path: "L'Étoile.md"} → [[L'Étoile|L'Étoile]]
 * - {path: "Image.png", embed: true} → ![[Image.png]] (assets keep extension)
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.MarkdownLinkNormalizer = void 0;
const internal_link_path_util_1 = require("../utils/internal-link-path.util");
/**
 * Service to normalize Dataview links to Obsidian wikilinks.
 */
class MarkdownLinkNormalizer {
    constructor(logger) {
        this.logger = logger;
    }
    /**
     * Normalize a Dataview Link object to Obsidian wikilink.
     *
     * @param link - Dataview link object
     * @returns Normalized wikilink string (Markdown format)
     */
    normalize(link) {
        if (!link.path || typeof link.path !== 'string') {
            this.logger?.warn('Invalid Dataview link: missing path', { link });
            return '';
        }
        const path = link.path;
        // Embeds (inclusions) → ![[path]]
        if (link.embed) {
            // For embeds (images, PDFs, etc.), keep extension
            return `![[${path}]]`;
        }
        // Regular wikilinks → [[path|display]]
        const normalizedPath = (0, internal_link_path_util_1.stripMarkdownExtensionPreservingFragment)(path);
        const displayTitle = link.display || this.extractBasename(normalizedPath);
        // Only add alias if display differs from path (avoid redundant [[Page|Page]])
        if (displayTitle === normalizedPath) {
            return `[[${normalizedPath}]]`;
        }
        return `[[${normalizedPath}|${displayTitle}]]`;
    }
    /**
     * Normalize any value (link, array, object, primitive).
     *
     * STRATEGY:
     * - DataviewLink → normalize()
     * - Array → normalize each element, join with ', '
     * - Object → check if it's a link, else stringify
     * - Primitive → convert to string
     *
     * @param value - Any Dataview value
     * @returns Normalized Markdown string
     */
    normalizeValue(value) {
        if (value === null || value === undefined) {
            return '';
        }
        // Arrays → comma-separated normalized values
        if (Array.isArray(value)) {
            if (value.length === 0)
                return '';
            if (value.length === 1)
                return this.normalizeValue(value[0]);
            return value.map((v) => this.normalizeValue(v)).join(', ');
        }
        // Objects → check if it's a Dataview link
        if (typeof value === 'object') {
            const obj = value;
            // Dataview link detection: has 'path' property
            if ('path' in obj && typeof obj['path'] === 'string') {
                return this.normalize(obj);
            }
            // Not a link → fallback to JSON (avoid this in production)
            this.logger?.warn('Unexpected object type in Dataview result', { value });
            return JSON.stringify(value);
        }
        // Primitives → string conversion
        return String(value);
    }
    /**
     * Extract basename from path (last segment, without extension).
     *
     * EXAMPLES:
     * - "Ektaron/Personnages/Héléna" → "Héléna"
     * - "Dr Théodoric" → "Dr Théodoric"
     * - "L'Étoile" → "L'Étoile"
     *
     * @param path - Vault path (without .md extension)
     * @returns Basename (file name without directory)
     */
    extractBasename(path) {
        const withoutFragment = path.split('#')[0] || path;
        return (0, internal_link_path_util_1.getInternalLinkBasename)(withoutFragment);
    }
}
exports.MarkdownLinkNormalizer = MarkdownLinkNormalizer;
