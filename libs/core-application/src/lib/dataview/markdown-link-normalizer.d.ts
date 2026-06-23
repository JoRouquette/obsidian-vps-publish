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
import type { LoggerPort } from '@core-domain';
/**
 * Dataview Link object (from Dataview API).
 */
export interface DataviewLink {
    /** Vault path (may include .md extension) */
    path: string;
    /** Optional display text */
    display?: string;
    /** Link type (not used for normalization) */
    type?: string;
    /** Whether this is an embed (![[...]]) */
    embed?: boolean;
}
/**
 * Service to normalize Dataview links to Obsidian wikilinks.
 */
export declare class MarkdownLinkNormalizer {
    private readonly logger?;
    constructor(logger?: LoggerPort | undefined);
    /**
     * Normalize a Dataview Link object to Obsidian wikilink.
     *
     * @param link - Dataview link object
     * @returns Normalized wikilink string (Markdown format)
     */
    normalize(link: DataviewLink): string;
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
    normalizeValue(value: unknown): string;
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
    private extractBasename;
}
//# sourceMappingURL=markdown-link-normalizer.d.ts.map