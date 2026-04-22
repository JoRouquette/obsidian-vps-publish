import {
  type DataviewJsResult,
  type DataviewQueryResult,
  DataviewToMarkdownConverter,
} from './dataview-to-markdown.converter';

describe('DataviewToMarkdownConverter', () => {
  let converter: DataviewToMarkdownConverter;

  beforeEach(() => {
    converter = new DataviewToMarkdownConverter();
  });

  describe('convertQueryToMarkdown() - Empty results', () => {
    it('should return note callout when query returns no results', () => {
      const result: DataviewQueryResult = {
        successful: true,
        value: {
          values: [],
        },
      };

      const markdown = converter.convertQueryToMarkdown(result, 'list');

      expect(markdown).toContain('> [!note] No Results');
      expect(markdown).toContain('This query returned no results.');
      expect(markdown).not.toContain('_No results found._');
    });

    it('should return error callout when query fails', () => {
      const result: DataviewQueryResult = {
        successful: false,
        error: 'Invalid syntax',
      };

      const markdown = converter.convertQueryToMarkdown(result, 'list');

      expect(markdown).toContain('> [!warning] Dataview Query Error');
      expect(markdown).toContain('Invalid syntax');
    });
  });

  describe('convertJsToMarkdown() - Empty results', () => {
    it.skip('should return empty string when DataviewJS produces no output', () => {
      // SKIPPED: Requires DOM (document.createElement)
      // This functionality is tested in plugin integration tests
      const container = document.createElement('div');

      const jsResult: DataviewJsResult = {
        success: true,
        container,
      };

      const html = converter.convertJsToMarkdown(jsResult);

      expect(html).toBe('');
    });

    it.skip('should return empty string when DataviewJS container is empty (whitespace only)', () => {
      // SKIPPED: Requires DOM
      const container = document.createElement('div');
      container.innerHTML = '   \n\n  ';

      const jsResult: DataviewJsResult = {
        success: true,
        container,
      };

      const html = converter.convertJsToMarkdown(jsResult);

      expect(html).toBe('');
    });

    it.skip('should return HTML with inline styles when DataviewJS produces styled content', () => {
      // SKIPPED: Requires DOM
      // This test documents the NEW behavior: preserving HTML instead of converting to Markdown
      const container = document.createElement('div');
      container.innerHTML = '<span><em>Transmutation de niveau 7 </em></span>';

      const jsResult: DataviewJsResult = {
        success: true,
        container,
      };

      const html = converter.convertJsToMarkdown(jsResult);

      // Should return raw HTML, preserving <em>, <strong>, and inline styles
      expect(html).toContain('<em>Transmutation de niveau 7 </em>');
      expect(html).not.toContain('*Transmutation de niveau 7*'); // Not Markdown
    });

    it.skip('should preserve inline styles from DataviewJS', () => {
      // SKIPPED: Requires DOM
      // Documents that inline styles (background-color, etc.) are preserved
      const container = document.createElement('div');
      container.innerHTML =
        '<span style="background-color:#800020;color:white;padding:3px 5px;">Clerc</span>';

      const jsResult: DataviewJsResult = {
        success: true,
        container,
      };

      const html = converter.convertJsToMarkdown(jsResult);

      // Should preserve the span with inline styles
      expect(html).toContain('background-color:#800020');
      expect(html).toContain('<span');
    });

    it.skip('should return error callout when DataviewJS execution fails', () => {
      // SKIPPED: Requires DOM
      const jsResult: DataviewJsResult = {
        success: false,
        container: document.createElement('div'),
        error: 'Script error',
      };

      const markdown = converter.convertJsToMarkdown(jsResult);

      expect(markdown).toContain('> [!warning] DataviewJS Error');
      expect(markdown).toContain('Script error');
    });
  });

  describe('convertQueryToMarkdown() - Lists', () => {
    it('should convert list query to markdown list', () => {
      const result: DataviewQueryResult = {
        successful: true,
        value: {
          values: [{ path: 'Notes/Page1.md' }, { path: 'Notes/Page2.md', display: 'Custom Title' }],
        },
      };

      const markdown = converter.convertQueryToMarkdown(result, 'list');

      expect(markdown).toContain('- [[Notes/Page1|Page1]]');
      expect(markdown).toContain('- [[Notes/Page2|Custom Title]]');
      expect(markdown).not.toContain('.md');
    });
  });

  describe('convertQueryToMarkdown() - Tables', () => {
    it('should convert table query to markdown table', () => {
      const result: DataviewQueryResult = {
        successful: true,
        value: {
          headers: ['Name', 'Status'],
          values: [
            [{ path: 'Notes/Page1.md' }, 'Active'],
            [{ path: 'Notes/Page2.md', display: 'Page Two' }, 'Inactive'],
          ],
        },
      };

      const markdown = converter.convertQueryToMarkdown(result, 'table');

      expect(markdown).toContain('| Name | Status |');
      expect(markdown).toContain('| --- | --- |');
      expect(markdown).toContain('| [[Notes/Page1|Page1]] | Active |');
      expect(markdown).toContain('| [[Notes/Page2|Page Two]] | Inactive |');
    });
  });

  describe('convertJsToMarkdown() - DOM parsing', () => {
    it.skip('should convert <ul> to markdown list', () => {
      // SKIPPED: Requires DOM
      const container = document.createElement('div');
      container.innerHTML = `
        <ul>
          <li><span class="wikilink" data-wikilink="Notes/Page1.md">Page 1</span></li>
          <li><span class="wikilink" data-wikilink="Notes/Page2.md">Page 2</span></li>
        </ul>
      `;

      const jsResult: DataviewJsResult = {
        success: true,
        container,
      };

      const markdown = converter.convertJsToMarkdown(jsResult);

      expect(markdown).toContain('- [[Notes/Page1.md|Page 1]]');
      expect(markdown).toContain('- [[Notes/Page2.md|Page 2]]');
    });

    it.skip('should convert <table> to markdown table', () => {
      // SKIPPED: Requires DOM
      const container = document.createElement('div');
      container.innerHTML = `
        <table>
          <thead>
            <tr><th>Name</th><th>Status</th></tr>
          </thead>
          <tbody>
            <tr>
              <td><span class="wikilink" data-wikilink="Notes/Page1.md">Page 1</span></td>
              <td>Active</td>
            </tr>
          </tbody>
        </table>
      `;

      const jsResult: DataviewJsResult = {
        success: true,
        container,
      };

      const markdown = converter.convertJsToMarkdown(jsResult);

      expect(markdown).toContain('| Name | Status |');
      expect(markdown).toContain('| --- | --- |');
      expect(markdown).toContain('| [[Notes/Page1.md|Page 1]] | Active |');
    });
  });
});
