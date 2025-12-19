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

import type { LoggerPort } from '../ports/logger.port';

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
export class MarkdownLinkNormalizer {
  constructor(private readonly logger?: LoggerPort) {}

  /**
   * Normalize a Dataview Link object to Obsidian wikilink.
   *
   * @param link - Dataview link object
   * @returns Normalized wikilink string (Markdown format)
   */
  normalize(link: DataviewLink): string {
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
    const normalizedPath = this.removeExtension(path, '.md');
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
  normalizeValue(value: unknown): string {
    if (value === null || value === undefined) {
      return '';
    }

    // Arrays → comma-separated normalized values
    if (Array.isArray(value)) {
      if (value.length === 0) return '';
      if (value.length === 1) return this.normalizeValue(value[0]);
      return value.map((v) => this.normalizeValue(v)).join(', ');
    }

    // Objects → check if it's a Dataview link
    if (typeof value === 'object') {
      const obj = value as Record<string, unknown>;

      // Dataview link detection: has 'path' property
      if ('path' in obj && typeof obj['path'] === 'string') {
        return this.normalize(obj as unknown as DataviewLink);
      }

      // Not a link → fallback to JSON (avoid this in production)
      this.logger?.warn('Unexpected object type in Dataview result', { value });
      return JSON.stringify(value);
    }

    // Primitives → string conversion
    return String(value);
  }

  /**
   * Remove extension from path if it matches.
   *
   * @param path - Vault path (may contain extension)
   * @param ext - Extension to remove (e.g., '.md')
   * @returns Path without extension
   */
  private removeExtension(path: string, ext: string): string {
    if (path.endsWith(ext)) {
      return path.substring(0, path.length - ext.length);
    }
    return path;
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
  private extractBasename(path: string): string {
    // Handle both Unix and Windows path separators
    const segments = path.split(/[/\\]/);
    return segments[segments.length - 1] || path;
  }
}
