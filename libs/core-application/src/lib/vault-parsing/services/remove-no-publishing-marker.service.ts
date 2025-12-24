import type { LoggerPort } from '@core-domain';
import type { PublishableNote } from '@core-domain/entities/publishable-note';

import type { BaseService } from '../../common/base-service';

/**
 * Service to remove paragraphs marked with ^no-publishing block IDs.
 *
 * Specification:
 * - When a line contains `^no-publishing` marker (block ID)
 * - Remove: marker line + all content from the delimiter to the marker (inclusive)
 * - Delimiter priority:
 *   1. Horizontal rule (---, ***, ___) if present between header and marker
 *   2. Previous header (##, ###, etc.) if no horizontal rule
 *   3. Start of document if no header found
 *
 * Example with horizontal rule:
 * ```
 * ## Public Section
 * This will be published.
 * ---
 * This is private content.
 * ^no-publishing
 *
 * ## Another Public Section
 * ```
 * Result: Only content between `---` and marker is removed (not the header).
 *
 * Example without horizontal rule:
 * ```
 * ## Private Section
 * This is private content.
 * ^no-publishing
 * ```
 * Result: "Private Section" header + content + marker are removed.
 */
export class RemoveNoPublishingMarkerService implements BaseService {
  private readonly markerPattern = /^\s*\^no-publishing\s*$/i;
  private readonly headerPattern = /^(#{1,6})\s+(.+)$/;
  private readonly horizontalRulePattern = /^(?:[-*_]\s*){3,}$/;

  constructor(private readonly logger?: LoggerPort) {}

  process(notes: PublishableNote[]): PublishableNote[] {
    return notes.map((note) => {
      const processed = this.processContent(note.content, note.noteId);

      if (processed !== note.content) {
        this.logger?.debug('Removed ^no-publishing sections', {
          noteId: note.noteId,
          originalLength: note.content.length,
          processedLength: processed.length,
        });
      }

      return {
        ...note,
        content: processed,
      };
    });
  }

  private processContent(content: string, noteId: string): string {
    const lines = content.split('\n');
    const toRemove: Array<{ start: number; end: number }> = [];

    // Find all ^no-publishing markers
    for (let i = 0; i < lines.length; i++) {
      if (this.markerPattern.test(lines[i])) {
        // Find the delimiter (horizontal rule or header)
        const delimiterIndex = this.findDelimiter(lines, i);

        // Mark range for removal: from delimiter (or start) to marker (inclusive)
        toRemove.push({
          start: delimiterIndex,
          end: i,
        });

        this.logger?.debug('Found ^no-publishing marker', {
          noteId,
          markerLine: i,
          delimiterLine: delimiterIndex,
          removed: lines.slice(delimiterIndex, i + 1).join('\n'),
        });
      }
    }

    // If no markers found, return original
    if (toRemove.length === 0) {
      return content;
    }

    // Build result by excluding marked ranges
    const result: string[] = [];
    let currentIndex = 0;

    for (const range of toRemove) {
      // Add lines before this removal range
      if (currentIndex < range.start) {
        result.push(...lines.slice(currentIndex, range.start));
      }
      // Skip the removal range
      currentIndex = range.end + 1;
    }

    // Add remaining lines after last removal
    if (currentIndex < lines.length) {
      result.push(...lines.slice(currentIndex));
    }

    // Clean up: remove excessive blank lines
    const cleaned = this.cleanupExcessiveBlankLines(result.join('\n'));

    return cleaned;
  }

  /**
   * Find the delimiter before the given line index.
   * Priority: horizontal rule > header > start of document.
   * Returns the index of the horizontal rule if found,
   * otherwise the index of the previous header,
   * otherwise 0 (start of document).
   */
  private findDelimiter(lines: string[], fromIndex: number): number {
    let lastHeaderIndex = -1;

    // Search backwards from marker
    for (let i = fromIndex - 1; i >= 0; i--) {
      const line = lines[i];

      // Check for horizontal rule first (higher priority)
      if (this.horizontalRulePattern.test(line)) {
        // Found horizontal rule - this is the delimiter
        return i;
      }

      // Track the last header we encounter (lower priority)
      if (lastHeaderIndex === -1 && this.headerPattern.test(line)) {
        lastHeaderIndex = i;
      }
    }

    // No horizontal rule found - use header if we found one
    if (lastHeaderIndex !== -1) {
      return lastHeaderIndex;
    }

    // No delimiter found, remove from start
    return 0;
  }

  /**
   * Clean up excessive blank lines (more than 2 consecutive blanks)
   */
  private cleanupExcessiveBlankLines(content: string): string {
    // Replace 3+ consecutive newlines with exactly 2 newlines
    return content.replace(/\n{3,}/g, '\n\n');
  }
}
