import type { LoggerPort } from '@core-domain';
import type { PublishableNote } from '@core-domain/entities/publishable-note';

import type { BaseService } from '../../common/base-service';

/**
 * Result type for delimiter detection to avoid ambiguity.
 * When index is 0, the type clarifies whether it's a header at line 0
 * or no delimiter found (start of document).
 */
type DelimiterResult = {
  /** Line index of the delimiter (or 0 for document start) */
  index: number;
  /** Type of delimiter found */
  type: 'hr' | 'header' | 'start';
};

type LineContext = {
  inFencedCode: boolean;
  isIndentedCode: boolean;
};

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
 *
 * Example at document start (no delimiter):
 * ```
 * ^no-publishing
 *
 * ## First Header
 * Public content
 * ```
 * Result: Only the marker is removed.
 *
 * Example with header at document start:
 * ```
 * ## Private Header
 * ^no-publishing
 *
 * ## Public Header
 * ```
 * Result: Private header and marker are removed.
 *
 * Note: Excessive blank lines (3+ consecutive) are automatically reduced to 2
 * to maintain document cleanliness after removal.
 */
export class RemoveNoPublishingMarkerService implements BaseService {
  private readonly markerPattern = /^\s*\^no-publishing\s*$/i;
  private readonly headerPattern = /^ {0,3}(#{1,6})\s+(.+)$/;
  private readonly horizontalRulePattern = /^ {0,3}(?:[-*_]\s*){3,}$/;
  private readonly setextUnderlinePattern = /^ {0,3}(?:=+\s*|-+\s*)$/;
  private readonly fencedCodePattern = /^ {0,3}(`{3,}|~{3,})/;
  private readonly indentedCodePattern = /^(?: {4,}|\t+)/;

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
    const eol = this.detectLineEnding(content);
    const lines = content.split(/\r?\n/);
    const contexts = this.buildLineContexts(lines);
    const toRemove: Array<{ start: number; end: number }> = [];

    // Find all ^no-publishing markers
    for (let i = 0; i < lines.length; i++) {
      if (this.isMarkerLine(lines[i], contexts[i])) {
        // Find the delimiter (horizontal rule or header)
        const delimiter = this.findDelimiter(lines, contexts, i);

        // Mark range for removal: from delimiter (or start) to marker (inclusive)
        toRemove.push({
          start: delimiter.index,
          end: i,
        });

        this.logger?.debug('Found ^no-publishing marker', {
          noteId,
          markerLine: i,
          delimiterLine: delimiter.index,
          delimiterType: delimiter.type,
          removed: lines.slice(delimiter.index, i + 1).join('\n'),
        });
      }
    }

    // If no markers found, return original
    if (toRemove.length === 0) {
      return content;
    }

    const mergedRanges = this.mergeRanges(toRemove);

    // Build result by excluding marked ranges
    const result: string[] = [];
    let currentIndex = 0;

    for (const range of mergedRanges) {
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

    const cleanedLines = this.cleanupLines(result);

    if (cleanedLines.length === 0) {
      return '';
    }

    return cleanedLines.join(eol);
  }

  /**
   * Find the delimiter before the given line index.
   * Priority: horizontal rule > header > start of document.
   *
   * @param lines - Array of content lines
   * @param fromIndex - Index of the ^no-publishing marker
   * @returns DelimiterResult with index and explicit type:
   *   - 'hr': Horizontal rule found
   *   - 'header': Header found (but no HR)
   *   - 'start': No delimiter found, start from document beginning
   *
   * Note: This explicit type eliminates ambiguity when index is 0
   * (header at line 0 vs. no delimiter found).
   */
  private findDelimiter(
    lines: string[],
    contexts: LineContext[],
    fromIndex: number
  ): DelimiterResult {
    let lastHeaderIndex = -1;

    // Search backwards from marker
    for (let i = fromIndex - 1; i >= 0; i--) {
      const line = lines[i];

      if (contexts[i].inFencedCode || contexts[i].isIndentedCode) {
        continue;
      }

      const setextHeadingStart = this.getSetextHeadingStart(lines, contexts, i);
      if (setextHeadingStart !== undefined) {
        if (lastHeaderIndex === -1) {
          lastHeaderIndex = setextHeadingStart;
        }
        continue;
      }

      // Check for horizontal rule first (higher priority)
      if (this.horizontalRulePattern.test(line)) {
        // Found horizontal rule - this is the delimiter
        return { index: i, type: 'hr' };
      }

      // Track the last header we encounter (lower priority)
      if (lastHeaderIndex === -1 && this.headerPattern.test(line)) {
        lastHeaderIndex = i;
      }
    }

    // No horizontal rule found - use header if we found one
    if (lastHeaderIndex !== -1) {
      return { index: lastHeaderIndex, type: 'header' };
    }

    // No delimiter found, remove from start
    return { index: 0, type: 'start' };
  }

  private detectLineEnding(content: string): string {
    return content.includes('\r\n') ? '\r\n' : '\n';
  }

  private isMarkerLine(line: string, context: LineContext): boolean {
    return !context.inFencedCode && !context.isIndentedCode && this.markerPattern.test(line);
  }

  private buildLineContexts(lines: string[]): LineContext[] {
    const contexts: LineContext[] = [];
    let activeFence: { char: '`' | '~'; length: number } | null = null;

    for (const line of lines) {
      const context: LineContext = {
        inFencedCode: activeFence !== null,
        isIndentedCode: activeFence === null && this.indentedCodePattern.test(line),
      };
      contexts.push(context);

      const fenceMatch = line.match(this.fencedCodePattern);
      if (!fenceMatch) {
        continue;
      }

      const fence = fenceMatch[1];
      const fenceChar = fence[0] as '`' | '~';

      if (!activeFence) {
        activeFence = {
          char: fenceChar,
          length: fence.length,
        };
        continue;
      }

      if (activeFence.char === fenceChar && fence.length >= activeFence.length) {
        activeFence = null;
      }
    }

    return contexts;
  }

  private getSetextHeadingStart(
    lines: string[],
    contexts: LineContext[],
    underlineIndex: number
  ): number | undefined {
    if (!this.setextUnderlinePattern.test(lines[underlineIndex])) {
      return undefined;
    }

    const headingIndex = underlineIndex - 1;
    if (headingIndex < 0) {
      return undefined;
    }

    const headingLine = lines[headingIndex];
    if (
      headingLine.trim() === '' ||
      contexts[headingIndex].inFencedCode ||
      contexts[headingIndex].isIndentedCode
    ) {
      return undefined;
    }

    return headingIndex;
  }

  private mergeRanges(
    ranges: Array<{ start: number; end: number }>
  ): Array<{ start: number; end: number }> {
    const sorted = [...ranges].sort((a, b) => a.start - b.start);
    const merged: Array<{ start: number; end: number }> = [];

    for (const range of sorted) {
      const last = merged[merged.length - 1];

      if (!last || range.start > last.end + 1) {
        merged.push({ ...range });
        continue;
      }

      last.end = Math.max(last.end, range.end);
    }

    return merged;
  }

  private cleanupLines(lines: string[]): string[] {
    const trimmed = [...lines];

    while (trimmed.length > 0 && trimmed[0].trim() === '') {
      trimmed.shift();
    }

    while (trimmed.length > 0 && trimmed[trimmed.length - 1].trim() === '') {
      trimmed.pop();
    }

    const cleaned: string[] = [];
    let previousWasBlank = false;

    for (const line of trimmed) {
      const isBlank = line.trim() === '';

      if (isBlank) {
        if (!previousWasBlank) {
          cleaned.push('');
        }
        previousWasBlank = true;
        continue;
      }

      cleaned.push(line);
      previousWasBlank = false;
    }

    return cleaned;
  }
}
