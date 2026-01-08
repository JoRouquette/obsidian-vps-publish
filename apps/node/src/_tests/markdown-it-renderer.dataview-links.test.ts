/**
 * Tests for MarkdownItRenderer - Dataview Links Cleaning
 *
 * Validates that .md extensions are properly removed from data-wikilink and href
 * attributes in Dataview-generated HTML blocks during post-processing.
 */

import { describe, expect, it } from '@jest/globals';

import { MarkdownItRenderer } from '../infra/markdown/markdown-it.renderer';

describe('MarkdownItRenderer - cleanDataviewLinks()', () => {
  let renderer: MarkdownItRenderer;

  beforeEach(() => {
    renderer = new MarkdownItRenderer();
  });

  describe('data-wikilink attribute cleaning', () => {
    it('should remove .md extension from data-wikilink attributes', () => {
      const input = '<span class="wikilink" data-wikilink="Notes/MyPage.md">My Page</span>';
      // Access private method via type assertion
      const result = (renderer as any).cleanDataviewLinks(input);

      expect(result).toBe('<span class="wikilink" data-wikilink="Notes/MyPage">My Page</span>');
      expect(result).not.toContain('.md');
    });

    it('should handle data-wikilink with anchors', () => {
      const input = '<span class="wikilink" data-wikilink="Notes/MyPage.md#section">My Page</span>';
      const result = (renderer as any).cleanDataviewLinks(input);

      expect(result).toBe(
        '<span class="wikilink" data-wikilink="Notes/MyPage#section">My Page</span>'
      );
      expect(result).not.toContain('.md');
    });

    it('should handle multiple data-wikilink attributes in same HTML', () => {
      const input = `
        <span data-wikilink="Page1.md">Page 1</span>
        <span data-wikilink="Page2.md">Page 2</span>
        <span data-wikilink="Folder/Page3.md">Page 3</span>
      `;
      const result = (renderer as any).cleanDataviewLinks(input);

      expect(result).toContain('data-wikilink="Page1"');
      expect(result).toContain('data-wikilink="Page2"');
      expect(result).toContain('data-wikilink="Folder/Page3"');
      expect(result).not.toContain('.md');
    });
  });

  describe('href attribute cleaning', () => {
    it('should remove .md extension from href attributes', () => {
      const input = '<a href="Notes/MyPage.md" class="wikilink">My Page</a>';
      const result = (renderer as any).cleanDataviewLinks(input);

      expect(result).toBe('<a href="Notes/MyPage" class="wikilink">My Page</a>');
      expect(result).not.toContain('.md');
    });

    it('should handle href with anchors', () => {
      const input = '<a href="Notes/MyPage.md#section">My Page</a>';
      const result = (renderer as any).cleanDataviewLinks(input);

      expect(result).toBe('<a href="Notes/MyPage#section">My Page</a>');
      expect(result).not.toContain('.md');
    });

    it('should NOT modify external URLs (http/https)', () => {
      const input = '<a href="https://example.com/file.md">External</a>';
      const result = (renderer as any).cleanDataviewLinks(input);

      // External URLs should remain unchanged
      expect(result).toBe(input);
      expect(result).toContain('https://example.com/file.md');
    });

    it('should NOT modify mailto: links', () => {
      const input = '<a href="mailto:user@example.md">Email</a>';
      const result = (renderer as any).cleanDataviewLinks(input);

      // mailto: links should remain unchanged
      expect(result).toBe(input);
    });

    it('should handle multiple href attributes', () => {
      const input = `
        <a href="Page1.md">Page 1</a>
        <a href="Page2.md">Page 2</a>
        <a href="https://external.com/page.md">External</a>
      `;
      const result = (renderer as any).cleanDataviewLinks(input);

      expect(result).toContain('href="Page1"');
      expect(result).toContain('href="Page2"');
      expect(result).toContain('href="https://external.com/page.md"'); // External unchanged
    });
  });

  describe('mixed attributes cleaning', () => {
    it('should clean both data-wikilink and href in same HTML', () => {
      const input = `
        <span data-wikilink="Note1.md">Note 1</span>
        <a href="Note2.md">Note 2</a>
        <a href="Note3.md" data-wikilink="Note3.md">Note 3</a>
      `;
      const result = (renderer as any).cleanDataviewLinks(input);

      expect(result).toContain('data-wikilink="Note1"');
      expect(result).toContain('href="Note2"');
      expect(result).toContain('href="Note3"');
      expect(result).toContain('data-wikilink="Note3"');
      expect(result).not.toContain('.md');
    });

    it('should handle complex Dataview table HTML', () => {
      const input = `
        <table>
          <tr>
            <td><span data-wikilink="Notes/Page1.md">Page 1</span></td>
            <td><a href="Notes/Page2.md">Page 2</a></td>
          </tr>
        </table>
      `;
      const result = (renderer as any).cleanDataviewLinks(input);

      expect(result).toContain('data-wikilink="Notes/Page1"');
      expect(result).toContain('href="Notes/Page2"');
      expect(result).not.toContain('.md');
    });
  });

  describe('edge cases', () => {
    it('should handle attributes without .md extension (no-op)', () => {
      const input = '<span data-wikilink="MyPage">My Page</span>';
      const result = (renderer as any).cleanDataviewLinks(input);

      expect(result).toBe(input);
    });

    it('should handle empty attributes', () => {
      const input = '<span data-wikilink="">Empty</span>';
      const result = (renderer as any).cleanDataviewLinks(input);

      expect(result).toBe(input);
    });

    it('should handle case-insensitive .md extension (.MD, .Md, etc.)', () => {
      const input = `
        <span data-wikilink="Page1.MD">Page 1</span>
        <span data-wikilink="Page2.Md">Page 2</span>
      `;
      const result = (renderer as any).cleanDataviewLinks(input);

      expect(result).toContain('data-wikilink="Page1"');
      expect(result).toContain('data-wikilink="Page2"');
    });

    it('should preserve asset extensions (images, PDFs)', () => {
      const input = `
        <img src="image.png" />
        <a href="document.pdf">PDF</a>
        <a href="Notes/Page.md">Note</a>
      `;
      const result = (renderer as any).cleanDataviewLinks(input);

      // Assets should keep their extensions
      expect(result).toContain('image.png');
      expect(result).toContain('document.pdf');
      // But .md should be removed
      expect(result).toContain('href="Notes/Page"');
    });
  });

  describe('real-world Dataview scenarios', () => {
    it('should clean Dataview TABLE output', () => {
      const input = `
        <table>
          <thead><tr><th>Name</th><th>Link</th></tr></thead>
          <tbody>
            <tr>
              <td>Note 1</td>
              <td><span class="wikilink" data-wikilink="Folder/Note1.md">Note1</span></td>
            </tr>
            <tr>
              <td>Note 2</td>
              <td><a class="internal-link" href="Folder/Note2.md">Note2</a></td>
            </tr>
          </tbody>
        </table>
      `;
      const result = (renderer as any).cleanDataviewLinks(input);

      expect(result).toContain('data-wikilink="Folder/Note1"');
      expect(result).toContain('href="Folder/Note2"');
      expect(result).not.toContain('.md');
    });

    it('should clean Dataview LIST output', () => {
      const input = `
        <ul>
          <li><span data-wikilink="Page1.md">Page 1</span></li>
          <li><span data-wikilink="Page2.md">Page 2</span></li>
          <li><span data-wikilink="Folder/Page3.md#section">Page 3 - Section</span></li>
        </ul>
      `;
      const result = (renderer as any).cleanDataviewLinks(input);

      expect(result).toContain('data-wikilink="Page1"');
      expect(result).toContain('data-wikilink="Page2"');
      expect(result).toContain('data-wikilink="Folder/Page3#section"');
      expect(result).not.toContain('.md');
    });

    it('should clean DataviewJS custom HTML', () => {
      const input = `
        <div>
          <span style="background-color:#800020;color:white;">
            <a href="Classes/Wizard.md" data-wikilink="Classes/Wizard.md">Wizard</a>
          </span>
        </div>
      `;
      const result = (renderer as any).cleanDataviewLinks(input);

      expect(result).toContain('href="Classes/Wizard"');
      expect(result).toContain('data-wikilink="Classes/Wizard"');
      expect(result).toContain('style="background-color:#800020;color:white;"'); // Preserve styles
      expect(result).not.toContain('.md');
    });
  });
});
