/**
 * Dataview To Markdown Converter (Application Layer)
 *
 * Converts structured Dataview API results to native Obsidian Markdown.
 *
 * CRITICAL PRINCIPLES:
 * - NO HTML output - only Markdown
 * - Links → wikilinks [[Page|Title]] (normalized, no .md)
 * - Images → inclusions ![[path/to/img.png]]
 * - Tables → Markdown tables (| ... |)
 * - Lists → Markdown lists (- ...)
 *
 * This ensures the resulting markdown is compatible with the existing
 * wikilink resolution / asset detection / routing pipeline.
 */

import type { LoggerPort } from '@core-domain';

import { MarkdownLinkNormalizer } from './markdown-link-normalizer';

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
    type?: string; // 'list' | 'table' | 'task' | 'calendar'
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
 * Service to convert Dataview API results to native Obsidian Markdown.
 */
export class DataviewToMarkdownConverter {
  private readonly normalizer: MarkdownLinkNormalizer;

  constructor(private readonly logger?: LoggerPort) {
    this.normalizer = new MarkdownLinkNormalizer(logger);
  }

  /**
   * Convert DQL query result to Markdown.
   *
   * @param result - Dataview API query result
   * @param queryType - Detected query type (list, table, task, etc.)
   * @returns Markdown string (with wikilinks/inclusions)
   */
  convertQueryToMarkdown(result: DataviewQueryResult, queryType: string): string {
    if (!result.successful || !result.value) {
      const errorMsg = result.error || 'Query failed';
      return this.renderErrorCallout('Dataview Query Error', errorMsg);
    }

    const { values, headers } = result.value;

    if (!values || values.length === 0) {
      return this.renderInfoCallout('No Results', 'This query returned no results.');
    }

    const type = queryType.toLowerCase();

    switch (type) {
      case 'list':
        return this.convertListToMarkdown(values);
      case 'table':
        return this.convertTableToMarkdown(values, headers);
      case 'task':
        return this.convertTaskListToMarkdown(values);
      case 'calendar':
        // Calendar cannot be represented in Markdown - provide fallback
        return this.renderInfoCallout(
          'Calendar View',
          `${values.length} events (calendar view not supported in Markdown)`
        );
      default:
        // Unknown type - render as list
        return this.convertListToMarkdown(values);
    }
  }

  /**
   * Convert DataviewJS result (DOM) to Markdown.
   *
   * STRATEGY:
   * - Parse DOM structure
   * - Extract tables/lists/links
   * - Convert to Markdown equivalents
   * - Preserve wikilinks as [[...]]
   *
   * @param jsResult - DataviewJS execution result
   * @returns Markdown string
   */
  convertJsToMarkdown(jsResult: DataviewJsResult): string {
    if (!jsResult.success || !jsResult.container) {
      const errorMsg = jsResult.error || 'Script execution failed';
      return this.renderErrorCallout('DataviewJS Error', errorMsg);
    }

    try {
      const markdown = this.convertDomToMarkdown(jsResult.container);
      // DataviewJS blocks with no output should be ignored (return empty string)
      if (!markdown || markdown.trim() === '') {
        return '';
      }
      return markdown;
    } catch (error) {
      const msg = error instanceof Error ? error.message : String(error);
      this.logger?.error('Failed to convert DataviewJS DOM to Markdown', { error: msg });
      return this.renderErrorCallout('DataviewJS Conversion Error', msg);
    }
  }

  /**
   * Convert LIST query values to Markdown list.
   */
  private convertListToMarkdown(items: unknown[]): string {
    return items.map((item) => `- ${this.normalizer.normalizeValue(item)}`).join('\n');
  }

  /**
   * Convert TABLE query to Markdown table.
   */
  private convertTableToMarkdown(rows: unknown[], headers?: string[]): string {
    if (rows.length === 0) {
      return '_No results found._';
    }

    const lines: string[] = [];

    // Headers
    if (headers && headers.length > 0) {
      lines.push(`| ${headers.join(' | ')} |`);
      lines.push(`| ${headers.map(() => '---').join(' | ')} |`);
    }

    // Rows
    for (const row of rows) {
      const rowArray = Array.isArray(row) ? row : [row];
      const cells = rowArray.map((cell) => this.normalizer.normalizeValue(cell));
      lines.push(`| ${cells.join(' | ')} |`);
    }

    return lines.join('\n');
  }

  /**
   * Convert TASK query to Markdown task list.
   */
  private convertTaskListToMarkdown(tasks: unknown[]): string {
    return tasks
      .map((task) => {
        const taskObj = task as { completed?: boolean; text?: string };
        const checkbox = taskObj.completed ? '[x]' : '[ ]';
        const text = taskObj.text || this.normalizer.normalizeValue(task);
        return `- ${checkbox} ${text}`;
      })
      .join('\n');
  }

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
  private formatValueAsMarkdown(value: unknown): string {
    return this.normalizer.normalizeValue(value);
  }

  /**
   * Convert DataviewJS DOM to Markdown.
   *
   * STRATEGY:
   * - Detect <ul>, <ol>, <table>, <p>, <a>, etc.
   * - Convert to Markdown equivalents
   * - Extract wikilinks from data attributes or href
   */
  private convertDomToMarkdown(container: HTMLElement): string {
    const lines: string[] = [];

    for (const child of Array.from(container.children)) {
      const markdown = this.convertElementToMarkdown(child as HTMLElement);
      if (markdown) {
        lines.push(markdown);
      }
    }

    return lines.join('\n\n');
  }

  /**
   * Convert a single HTML element to Markdown.
   */
  private convertElementToMarkdown(element: HTMLElement): string {
    const tag = element.tagName.toLowerCase();

    switch (tag) {
      case 'ul':
        return this.convertUlToMarkdown(element);
      case 'ol':
        return this.convertOlToMarkdown(element);
      case 'table':
        return this.convertTableElementToMarkdown(element);
      case 'p':
        return this.convertParagraphToMarkdown(element);
      case 'div':
        // Recurse into divs
        return this.convertDomToMarkdown(element);
      default:
        // Fallback: extract text content
        return element.textContent?.trim() || '';
    }
  }

  /**
   * Convert <ul> to Markdown list.
   */
  private convertUlToMarkdown(ul: HTMLElement): string {
    const items = Array.from(ul.querySelectorAll(':scope > li'));
    return items.map((li) => `- ${this.extractTextWithWikilinks(li as HTMLElement)}`).join('\n');
  }

  /**
   * Convert <ol> to Markdown numbered list.
   */
  private convertOlToMarkdown(ol: HTMLElement): string {
    const items = Array.from(ol.querySelectorAll(':scope > li'));
    return items
      .map((li, idx) => `${idx + 1}. ${this.extractTextWithWikilinks(li as HTMLElement)}`)
      .join('\n');
  }

  /**
   * Convert <table> to Markdown table.
   */
  private convertTableElementToMarkdown(table: HTMLElement): string {
    const lines: string[] = [];

    // Headers
    const thead = table.querySelector('thead');
    if (thead) {
      const headerCells = Array.from(thead.querySelectorAll('th'));
      const headers = headerCells.map((th) => this.extractTextWithWikilinks(th as HTMLElement));
      lines.push(`| ${headers.join(' | ')} |`);
      lines.push(`| ${headers.map(() => '---').join(' | ')} |`);
    }

    // Body
    const tbody = table.querySelector('tbody') || table;
    const rows = Array.from(tbody.querySelectorAll('tr'));
    for (const row of rows) {
      // Skip header row if no thead
      if (!thead && row.parentElement?.tagName === 'THEAD') continue;

      const cells = Array.from(row.querySelectorAll('td, th'));
      const cellValues = cells.map((td) => this.extractTextWithWikilinks(td as HTMLElement));
      lines.push(`| ${cellValues.join(' | ')} |`);
    }

    return lines.join('\n');
  }

  /**
   * Convert <p> to Markdown paragraph.
   */
  private convertParagraphToMarkdown(p: HTMLElement): string {
    return this.extractTextWithWikilinks(p);
  }

  /**
   * Extract text from an element, converting internal links to wikilinks.
   *
   * DETECTION:
   * - Dataview uses <span class="wikilink" data-wikilink="...">
   * - Or <a href="..." data-wikilink="...">
   * - Or <a class="internal-link" href="...">
   */
  private extractTextWithWikilinks(element: HTMLElement): string {
    let markdown = '';

    for (const node of Array.from(element.childNodes)) {
      if (node.nodeType === Node.TEXT_NODE) {
        markdown += node.textContent || '';
      } else if (node.nodeType === Node.ELEMENT_NODE) {
        const el = node as HTMLElement;
        const tag = el.tagName.toLowerCase();

        // Wikilink detection
        const wikilinkAttr = el.getAttribute('data-wikilink');
        const isInternalLink =
          el.classList.contains('internal-link') || el.classList.contains('wikilink');

        if (wikilinkAttr || (tag === 'a' && isInternalLink)) {
          const path = wikilinkAttr || el.getAttribute('href') || '';
          const display = el.textContent?.trim() || '';

          // Check if it's an image/asset (embed)
          const isEmbed =
            el.classList.contains('image-embed') ||
            path.match(/\.(png|jpe?g|gif|svg|pdf|mp4|webm)$/i);

          if (isEmbed) {
            markdown += `![[${path}]]`;
          } else if (display && display !== path) {
            markdown += `[[${path}|${display}]]`;
          } else {
            markdown += `[[${path}]]`;
          }
        } else {
          // Recurse
          markdown += this.extractTextWithWikilinks(el);
        }
      }
    }

    return markdown.trim();
  }

  /**
   * Render an error callout in Obsidian format.
   */
  private renderErrorCallout(title: string, message: string): string {
    return `> [!warning] ${title}\n> ${message.split('\n').join('\n> ')}`;
  }

  /**
   * Render an note callout in Obsidian format.
   */
  private renderInfoCallout(title: string, message: string): string {
    return `> [!note] ${title}\n> ${message.split('\n').join('\n> ')}`;
  }
}
