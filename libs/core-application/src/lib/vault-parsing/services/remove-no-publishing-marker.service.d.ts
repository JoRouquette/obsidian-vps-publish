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
export declare class RemoveNoPublishingMarkerService implements BaseService {
    private readonly logger?;
    private readonly markerPattern;
    private readonly headerPattern;
    private readonly horizontalRulePattern;
    private readonly setextUnderlinePattern;
    private readonly fencedCodePattern;
    private readonly indentedCodePattern;
    constructor(logger?: LoggerPort | undefined);
    process(notes: PublishableNote[]): PublishableNote[];
    private processContent;
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
    private findDelimiter;
    private detectLineEnding;
    private isMarkerLine;
    private buildLineContexts;
    private getSetextHeadingStart;
    private mergeRanges;
    private cleanupLines;
}
//# sourceMappingURL=remove-no-publishing-marker.service.d.ts.map