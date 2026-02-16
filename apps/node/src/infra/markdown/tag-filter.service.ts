import { load } from 'cheerio';

/**
 * Service to remove ignored tags from rendered HTML content.
 * Filters out hashtags (e.g., #todo, #à-faire) from text nodes only,
 * preserving code blocks, attributes, and anchor hrefs.
 */
export class TagFilterService {
  /**
   * Remove ignored tags from HTML content.
   *
   * @param html - The HTML string to process
   * @param ignoredTags - Array of tag names to remove (without #, case-insensitive)
   * @returns Filtered HTML string
   *
   * @example
   * filterTags('<p>#todo Buy milk</p>', ['todo'])
   * // => '<p>Buy milk</p>'
   *
   * filterTags('<code>#todo</code>', ['todo'])
   * // => '<code>#todo</code>' (preserved in code)
   */
  filterTags(html: string, ignoredTags: string[]): string {
    if (!ignoredTags.length) {
      return html;
    }

    const $ = load(html);

    // Normalize ignored tags: lowercase, remove accents, handle unicode
    const normalizedIgnored = new Set(
      ignoredTags.map((tag) =>
        tag
          .normalize('NFKD')
          .replace(/[\u0300-\u036f]/g, '')
          .toLowerCase()
      )
    );

    // Build regex pattern for tag detection
    // Match: word boundary or whitespace + # + tag characters
    // Tag format: #[\p{L}\p{N}_-]+
    const tagPattern = /(^|\s|[^\w])#([\p{L}\p{N}_-]+)/gu;

    // Process text nodes, excluding code/pre/script/style
    const processTextInElement = (element: ReturnType<typeof $>): void => {
      const tagName = element.prop('tagName')?.toLowerCase();
      if (tagName && ['code', 'pre', 'script', 'style'].includes(tagName)) {
        return; // Skip code-like elements
      }

      // Process direct text nodes
      element.contents().each((_, node) => {
        if (node.type === 'text' && node.data) {
          let text = node.data;
          let modified = false;

          text = text.replace(tagPattern, (match: string, prefix: string, tagName: string) => {
            const normalized = tagName
              .normalize('NFKD')
              .replace(/[\u0300-\u036f]/g, '')
              .toLowerCase();

            if (normalizedIgnored.has(normalized)) {
              modified = true;
              return prefix; // Keep prefix, remove tag
            }
            return match;
          });

          if (modified) {
            text = text.replace(/\s{2,}/g, ' '); // Clean double spaces
            node.data = text;
          }
        } else if (node.type === 'tag') {
          processTextInElement($(node));
        }
      });
    };

    // Process all elements in the document, not just body children
    // This handles cases where HTML doesn't have a body tag
    const root = $('body').length > 0 ? $('body') : $.root();
    processTextInElement(root);

    // CRITICAL FIX: Preserve <link> and <style> tags that are outside <body>
    // These are injected by markdown-it.renderer.ts for callout styles and icon fonts
    // Cheerio moves them to <head>, but we need to return them as part of the body HTML
    const headElements = $('head > link, head > style').toArray();
    const bodyContent = $('body').html() ?? $.html();

    if (headElements.length > 0) {
      // Extract head elements and prepend to body content
      const headHtml = headElements.map((el) => $.html(el)).join('\n');
      return headHtml + '\n' + bodyContent;
    }

    return bodyContent;
  }
}
