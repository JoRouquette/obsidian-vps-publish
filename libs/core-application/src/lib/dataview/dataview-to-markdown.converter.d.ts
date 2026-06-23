/**
 * Dataview To Markdown Converter (Application Layer)
 *
 * Converts structured Dataview API results to Markdown or HTML:
 *
 * - DQL queries (```dataview) → Markdown:
 *   - Links → wikilinks [[Page|Title]] (normalized, no .md)
 *   - Images → inclusions ![[path/to/img.png]]
 *   - Tables → Markdown tables (| ... |)
 *   - Lists → Markdown lists (- ...)
 *
 * - DataviewJS blocks (```dataviewjs) → Raw HTML:
 *   - Preserves all HTML tags (<em>, <strong>, <span>, etc.)
 *   - Preserves inline styles (background-color, font-weight, etc.)
 *   - Necessary for complex formatting (badges, custom layouts)
 *
 * This ensures the resulting output is compatible with the existing
 * wikilink resolution / asset detection / routing pipeline.
 */
import type { LoggerPort } from '@core-domain';
/**
 * Dataview Link object (from Dataview API).
 * Re-exported from MarkdownLinkNormalizer for convenience.
 */
export type { DataviewLink } from './markdown-link-normalizer';
/**
 * Structured result from Dataview API query.
 */
export interface DataviewQueryResult {
    successful: boolean;
    value?: {
        values?: unknown[];
        headers?: string[];
        type?: string;
    };
    error?: string;
}
/**
 * Result of DataviewJS execution (DOM inspection).
 */
export interface DataviewJsResult {
    success: boolean;
    container: HTMLElement;
    error?: string;
}
/**
 * Service to convert Dataview API results to Markdown or HTML.
 *
 * NOTE: Despite the class name, DataviewJS blocks are converted to HTML
 * (not Markdown) to preserve styling and complex formatting.
 */
export declare class DataviewToMarkdownConverter {
    private readonly logger?;
    private readonly normalizer;
    private readonly noPublishingMarkerService;
    constructor(logger?: LoggerPort | undefined);
    /**
     * Convert DQL query result to Markdown.
     *
     * @param result - Dataview API query result
     * @param queryType - Detected query type (list, table, task, etc.)
     * @returns Markdown string (with wikilinks/inclusions)
     */
    convertQueryToMarkdown(result: DataviewQueryResult, queryType: string): string;
    /**
     * Convert DataviewJS result (DOM) to HTML.
     *
     * STRATEGY:
     * - Return raw HTML from DataviewJS execution
     * - Preserve all styles, formatting (em, strong, spans with inline styles)
     * - This allows dataviewjs blocks to render with full fidelity
     *
     * NOTE: We return HTML instead of Markdown because dataviewjs often generates
     * complex HTML with inline styles (e.g., colored badges) that cannot be
     * represented in Markdown.
     *
     * @param jsResult - DataviewJS execution result
     * @returns HTML string (or Markdown callout for errors)
     */
    convertJsToMarkdown(jsResult: DataviewJsResult): string;
    /**
     * Convert LIST query values to Markdown list.
     */
    private convertListToMarkdown;
    /**
     * Convert TABLE query to Markdown table.
     */
    private convertTableToMarkdown;
    /**
     * Convert TASK query to Markdown task list.
     */
    private convertTaskListToMarkdown;
    /**
     * Format a single value as Markdown (DEPRECATED - use normalizer.normalizeValue()).
     *
     * KEPT FOR BACKWARD COMPATIBILITY in DOM conversion only.
     * New code should use this.normalizer.normalizeValue() directly.
     *
     * @param value - Any Dataview value
     * @returns Markdown representation
     * @deprecated Use this.normalizer.normalizeValue() instead
     */
    private formatValueAsMarkdown;
    /**
     * Convert DataviewJS DOM to Markdown.
     *
     * STRATEGY:
     * - Detect <ul>, <ol>, <table>, <p>, <a>, etc.
     * - Convert to Markdown equivalents
     * - Extract wikilinks from data attributes or href
     */
    private convertDomToMarkdown;
    /**
     * Convert a single HTML element to Markdown.
     */
    private convertElementToMarkdown;
    /**
     * Convert <ul> to Markdown list.
     */
    private convertUlToMarkdown;
    /**
     * Convert <ol> to Markdown numbered list.
     */
    private convertOlToMarkdown;
    /**
     * Convert <table> to Markdown table.
     */
    private convertTableElementToMarkdown;
    /**
     * Convert <p> to Markdown paragraph.
     */
    private convertParagraphToMarkdown;
    private convertHeadingToMarkdown;
    private convertPreToMarkdown;
    private convertBlockquoteToMarkdown;
    /**
     * Extract text from an element, converting internal links to wikilinks.
     *
     * DETECTION:
     * - Dataview uses <span class="wikilink" data-wikilink="...">
     * - Or <a href="..." data-wikilink="...">
     * - Or <a class="internal-link" href="...">
     */
    private extractTextWithWikilinks;
    /**
     * Render an error callout in Obsidian format.
     */
    private renderErrorCallout;
    /**
     * Render an note callout in Obsidian format.
     */
    private renderInfoCallout;
    private createTemporaryNote;
}
//# sourceMappingURL=dataview-to-markdown.converter.d.ts.map