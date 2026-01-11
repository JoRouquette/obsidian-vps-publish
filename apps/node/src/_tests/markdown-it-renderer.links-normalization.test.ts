/**
 * Tests for MarkdownItRenderer - Link Normalization
 *
 * Validates that all <a> tags in rendered HTML have:
 * - No .md extensions in href attributes
 * - Correct CSS classes (wikilink for internal links)
 * - Proper routing format
 *
 * Covers links from:
 * - Dataview blocks (pre-rendered HTML)
 * - DataviewJS custom views
 * - Any plugin-generated content
 */

import { describe, expect, it } from '@jest/globals';

import { MarkdownItRenderer } from '../infra/markdown/markdown-it.renderer';

describe('MarkdownItRenderer - cleanAndNormalizeLinks()', () => {
  let renderer: MarkdownItRenderer;

  beforeEach(() => {
    renderer = new MarkdownItRenderer();
  });

  describe('data-wikilink attribute cleaning', () => {
    it('should remove .md extension from data-wikilink attributes', () => {
      const input = '<a href="/notes/page.md" data-wikilink="Notes/MyPage.md">My Page</a>';
      const result = (renderer as any).cleanAndNormalizeLinks(input);

      expect(result).toContain('data-wikilink="Notes/MyPage"');
      expect(result).not.toContain('data-wikilink="Notes/MyPage.md"');
    });

    it('should handle data-wikilink with anchors', () => {
      const input = '<a data-wikilink="Notes/MyPage.md#section">My Page</a>';
      const result = (renderer as any).cleanAndNormalizeLinks(input);

      expect(result).toContain('data-wikilink="Notes/MyPage#section"');
      expect(result).not.toContain('.md');
    });

    it('should handle multiple data-wikilink attributes in same HTML', () => {
      const input = `
        <a data-wikilink="Page1.md">Page 1</a>
        <a data-wikilink="Page2.md">Page 2</a>
        <a data-wikilink="Folder/Page3.md">Page 3</a>
      `;
      const result = (renderer as any).cleanAndNormalizeLinks(input);

      expect(result).toContain('data-wikilink="Page1"');
      expect(result).toContain('data-wikilink="Page2"');
      expect(result).toContain('data-wikilink="Folder/Page3"');
      expect(result).not.toContain('.md');
    });
  });

  describe('href attribute cleaning', () => {
    it('should remove .md extension from href attributes', () => {
      const input = '<a href="Notes/MyPage.md" class="wikilink">My Page</a>';
      const result = (renderer as any).cleanAndNormalizeLinks(input);

      expect(result).toContain('href="Notes/MyPage"');
      expect(result).not.toContain('href="Notes/MyPage.md"');
    });

    it('should handle href with anchors', () => {
      const input = '<a href="Notes/MyPage.md#section">My Page</a>';
      const result = (renderer as any).cleanAndNormalizeLinks(input);

      expect(result).toContain('href="Notes/MyPage#section"');
      expect(result).not.toContain('.md');
    });

    it('should NOT modify external URLs (http/https)', () => {
      const input = '<a href="https://example.com/file.md">External</a>';
      const result = (renderer as any).cleanAndNormalizeLinks(input);

      // External URLs should remain unchanged
      expect(result).toContain('https://example.com/file.md');
    });

    it('should NOT modify mailto: links', () => {
      const input = '<a href="mailto:user@example.md">Email</a>';
      const result = (renderer as any).cleanAndNormalizeLinks(input);

      // mailto: links should remain unchanged
      expect(result).toContain('mailto:user@example.md');
    });

    it('should handle multiple href attributes', () => {
      const input = `
        <a href="Page1.md">Page 1</a>
        <a href="Page2.md">Page 2</a>
        <a href="https://external.com/page.md">External</a>
      `;
      const result = (renderer as any).cleanAndNormalizeLinks(input);

      expect(result).toContain('href="Page1"');
      expect(result).toContain('href="Page2"');
      expect(result).toContain('href="https://external.com/page.md"'); // External unchanged
    });
  });

  describe('CSS class normalization', () => {
    it('should add wikilink class to links with data-wikilink', () => {
      const input = '<a href="/page" data-wikilink="Page.md">Page</a>';
      const result = (renderer as any).cleanAndNormalizeLinks(input);

      expect(result).toContain('class="wikilink"');
      expect(result).toContain('data-wikilink="Page"');
    });

    it('should preserve existing classes when adding wikilink', () => {
      const input = '<a href="/page.md" data-wikilink="Page.md" class="internal-link">Page</a>';
      const result = (renderer as any).cleanAndNormalizeLinks(input);

      expect(result).toContain('class="internal-link wikilink"');
    });

    it('should NOT duplicate wikilink class if already present', () => {
      const input = '<a href="/page.md" data-wikilink="Page.md" class="wikilink">Page</a>';
      const result = (renderer as any).cleanAndNormalizeLinks(input);

      // Should have exactly one wikilink class value, not duplicated
      expect(result).toMatch(/class="[^"]*wikilink[^"]*"/);
      expect(result).not.toMatch(/class="[^"]*wikilink[^"]*wikilink[^"]*"/);

      // Or check more precisely: extract class attribute value
      const classMatch = result.match(/class="([^"]*)"/);
      expect(classMatch).toBeTruthy();
      const classes = classMatch![1].split(/\s+/);
      const wikilinkCount = classes.filter((c: string) => c === 'wikilink').length;
      expect(wikilinkCount).toBe(1);
    });

    it('should add wikilink class to internal links (starting with /)', () => {
      const input = '<a href="/notes/page.md">Page</a>';
      const result = (renderer as any).cleanAndNormalizeLinks(input);

      expect(result).toContain('class="wikilink"');
      expect(result).toContain('href="/notes/page"');
    });

    it('should add wikilink class to relative internal links', () => {
      const input = '<a href="page.md">Page</a>';
      const result = (renderer as any).cleanAndNormalizeLinks(input);

      expect(result).toContain('class="wikilink"');
      expect(result).toContain('href="page"');
    });

    it('should NOT add wikilink class to external links', () => {
      const input = '<a href="https://example.com">External</a>';
      const result = (renderer as any).cleanAndNormalizeLinks(input);

      expect(result).not.toContain('class="wikilink"');
    });
  });

  describe('wikilink template conformity', () => {
    it('should ensure all internal links follow wikilink template', () => {
      const input = '<a href="/page.md">Page</a>';
      const result = (renderer as any).cleanAndNormalizeLinks(input);

      // Must have class="wikilink"
      expect(result).toMatch(/<a[^>]*class="[^"]*wikilink[^"]*"/);
      // Must have data-wikilink
      expect(result).toMatch(/<a[^>]*data-wikilink="[^"]*"/);
      // Must have href
      expect(result).toMatch(/<a[^>]*href="[^"]*"/);
    });

    it('should add data-wikilink when missing (derived from href)', () => {
      const input = '<a href="/notes/page.md">Page</a>';
      const result = (renderer as any).cleanAndNormalizeLinks(input);

      // Should derive data-wikilink from href
      expect(result).toContain('data-wikilink="notes/page"');
      expect(result).toContain('href="/notes/page"');
      expect(result).toContain('class="wikilink"');
    });

    it('should strip anchor from data-wikilink when deriving from href', () => {
      const input = '<a href="/page.md#section">Page Section</a>';
      const result = (renderer as any).cleanAndNormalizeLinks(input);

      // data-wikilink should not include the anchor
      expect(result).toContain('data-wikilink="page"');
      // but href should keep it
      expect(result).toContain('href="/page#section"');
      expect(result).toContain('class="wikilink"');
    });

    it('should normalize Dataview links to wikilink template', () => {
      const input = `
        <table>
          <tr>
            <td><a href="Note1.md" class="internal-link">Note 1</a></td>
            <td><a href="/folder/Note2.md">Note 2</a></td>
          </tr>
        </table>
      `;
      const result = (renderer as any).cleanAndNormalizeLinks(input);

      // All links should have wikilink class
      expect(result).toMatch(/<a[^>]*href="Note1"[^>]*class="[^"]*wikilink[^"]*"[^>]*>Note 1<\/a>/);
      expect(result).toMatch(
        /<a[^>]*href="\/folder\/Note2"[^>]*class="[^"]*wikilink[^"]*"[^>]*>Note 2<\/a>/
      );
      // All should have data-wikilink
      expect(result).toContain('data-wikilink="Note1"');
      expect(result).toContain('data-wikilink="folder/Note2"');
    });

    it('should add wikilink class while preserving existing classes', () => {
      const input = '<a href="/page.md" class="custom-class">Page</a>';
      const result = (renderer as any).cleanAndNormalizeLinks(input);

      // wikilink should be added to existing classes
      expect(result).toMatch(/class="custom-class wikilink"/);
    });
  });

  describe('mixed attributes cleaning', () => {
    it('should clean both data-wikilink and href in same link', () => {
      const input = '<a href="Note3.md" data-wikilink="Note3.md">Note 3</a>';
      const result = (renderer as any).cleanAndNormalizeLinks(input);

      expect(result).toContain('href="Note3"');
      expect(result).toContain('data-wikilink="Note3"');
      expect(result).toContain('class="wikilink"');
      expect(result).not.toContain('.md');
    });

    it('should handle complex Dataview table HTML', () => {
      const input = `
        <table>
          <tr>
            <td><a data-wikilink="Notes/Page1.md">Page 1</a></td>
            <td><a href="Notes/Page2.md">Page 2</a></td>
          </tr>
        </table>
      `;
      const result = (renderer as any).cleanAndNormalizeLinks(input);

      expect(result).toContain('data-wikilink="Notes/Page1"');
      expect(result).toContain('href="Notes/Page2"');
      expect(result).not.toContain('.md');
    });
  });

  describe('edge cases', () => {
    it('should handle links without .md extension (no-op for path)', () => {
      const input = '<a href="MyPage">My Page</a>';
      const result = (renderer as any).cleanAndNormalizeLinks(input);

      expect(result).toContain('href="MyPage"');
      expect(result).toContain('class="wikilink"'); // Should still add class
    });

    it('should handle links without href or data-wikilink', () => {
      const input = '<a>Anchor without href</a>';
      const result = (renderer as any).cleanAndNormalizeLinks(input);

      // Should not crash, just return as-is (or with minimal changes)
      expect(result).toContain('<a');
    });

    it('should handle empty attributes', () => {
      const input = '<a href="" data-wikilink="">Empty</a>';
      const result = (renderer as any).cleanAndNormalizeLinks(input);

      // Should not crash
      expect(result).toContain('<a');
    });

    it('should handle case-insensitive .md extension (.MD, .Md, etc.)', () => {
      const input = `
        <a href="Page1.MD">Page 1</a>
        <a href="Page2.Md">Page 2</a>
      `;
      const result = (renderer as any).cleanAndNormalizeLinks(input);

      expect(result).toContain('href="Page1"');
      expect(result).toContain('href="Page2"');
    });

    it('should preserve non-link elements and attributes', () => {
      const input = `
        <div class="container">
          <a href="page.md" style="color:red;">Link</a>
          <img src="image.png" />
          <span data-custom="value">Text</span>
        </div>
      `;
      const result = (renderer as any).cleanAndNormalizeLinks(input);

      // Non-link elements should remain intact
      expect(result).toContain('<div class="container">');
      expect(result).toContain('<img src="image.png"');
      expect(result).toContain('<span data-custom="value">');
      expect(result).toContain('style="color:red;"');
      // Link should be cleaned
      expect(result).toContain('href="page"');
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
              <td><a class="internal-link" data-wikilink="Folder/Note1.md">Note1</a></td>
            </tr>
            <tr>
              <td>Note 2</td>
              <td><a class="internal-link" href="Folder/Note2.md">Note2</a></td>
            </tr>
          </tbody>
        </table>
      `;
      const result = (renderer as any).cleanAndNormalizeLinks(input);

      expect(result).toContain('data-wikilink="Folder/Note1"');
      expect(result).toContain('href="Folder/Note2"');
      expect(result).toContain('class="internal-link wikilink"');
      expect(result).not.toContain('.md');
    });

    it('should clean Dataview LIST output', () => {
      const input = `
        <ul>
          <li><a data-wikilink="Page1.md">Page 1</a></li>
          <li><a href="Page2.md">Page 2</a></li>
          <li><a data-wikilink="Folder/Page3.md#section">Page 3 - Section</a></li>
        </ul>
      `;
      const result = (renderer as any).cleanAndNormalizeLinks(input);

      expect(result).toContain('data-wikilink="Page1"');
      expect(result).toContain('href="Page2"');
      expect(result).toContain('data-wikilink="Folder/Page3#section"');
      expect(result).toContain('class="wikilink"');
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
      const result = (renderer as any).cleanAndNormalizeLinks(input);

      expect(result).toContain('href="Classes/Wizard"');
      expect(result).toContain('data-wikilink="Classes/Wizard"');
      expect(result).toContain('class="wikilink"');
      expect(result).toContain('style="background-color:#800020;color:white;"'); // Preserve styles
      expect(result).not.toContain('.md');
    });

    it('should handle dv.view() output with styled links', () => {
      const input = `
        <div class="dataview-view-result">
          <p><strong><a href="Book A.md" class="custom-book-link">Book A</a></strong> by Author A</p>
          <p>---</p>
          <p><strong><a href="Book B.md" data-wikilink="Book B.md">Book B</a></strong> by Author B</p>
        </div>
      `;
      const result = (renderer as any).cleanAndNormalizeLinks(input);

      expect(result).toContain('href="Book A"');
      expect(result).toContain('href="Book B"');
      expect(result).toContain('data-wikilink="Book B"');
      expect(result).toContain('class="custom-book-link wikilink"');
      expect(result).not.toContain('.md');
    });
  });

  describe('routing compliance', () => {
    it('should produce hrefs compatible with frontend routing', () => {
      const input = `
        <a href="/folder/note.md">Absolute</a>
        <a href="note.md">Relative</a>
        <a href="note.md#section">With anchor</a>
      `;
      const result = (renderer as any).cleanAndNormalizeLinks(input);

      // Routing-compatible paths (no .md)
      expect(result).toContain('href="/folder/note"');
      expect(result).toContain('href="note"');
      expect(result).toContain('href="note#section"');
    });

    it('should not break already-clean routing paths', () => {
      const input = `
        <a href="/folder/note">Already clean</a>
        <a href="/folder/note#section">With anchor</a>
      `;
      const result = (renderer as any).cleanAndNormalizeLinks(input);

      // Should remain unchanged (no .md to remove)
      expect(result).toContain('href="/folder/note"');
      expect(result).toContain('href="/folder/note#section"');
    });
  });

  describe('vault-to-route path translation', () => {
    it('should translate vault paths to routed paths when manifest is provided', () => {
      const mockManifest = {
        sessionId: 'test',
        createdAt: new Date(),
        lastUpdatedAt: new Date(),
        pages: [
          {
            id: '1',
            title: "Aran'talas",
            slug: 'arantalas',
            route: "/aran-talas/Aran'talas/Aran'talas",
            vaultPath: "Aran'talas/Aran'talas.md",
            relativePath: "Aran'talas/Aran'talas.md",
            publishedAt: new Date(),
          },
          {
            id: '2',
            title: 'Wizard',
            slug: 'wizard',
            route: '/lore/classes/Wizard',
            vaultPath: '_Codex/Classes/Wizard.md',
            relativePath: '_Codex/Classes/Wizard.md',
            publishedAt: new Date(),
          },
        ],
      };

      const input = `
        <a href="Aran'talas/Aran'talas.md" class="internal-link" data-href="Aran'talas/Aran'talas.md">Aran'talas</a>
        <a href="_Codex/Classes/Wizard.md">Wizard</a>
      `;

      const result = (renderer as any).cleanAndNormalizeLinks(input, mockManifest);

      // Should translate to routed paths
      expect(result).toContain('href="/aran-talas/Aran\'talas/Aran\'talas"');
      expect(result).toContain('href="/lore/classes/Wizard"');
      expect(result).not.toContain('.md');
    });

    it('should preserve anchors when translating vault paths', () => {
      const mockManifest = {
        sessionId: 'test',
        createdAt: new Date(),
        lastUpdatedAt: new Date(),
        pages: [
          {
            id: '1',
            title: 'Code',
            slug: 'le-code',
            route: '/cultures/le-code',
            vaultPath: 'Le Code.md',
            relativePath: 'Le Code.md',
            publishedAt: new Date(),
          },
        ],
      };

      const input = '<a href="Le Code.md#systeme-de-gouvernance">Section</a>';
      const result = (renderer as any).cleanAndNormalizeLinks(input, mockManifest);

      // Should translate path and preserve anchor
      expect(result).toContain('href="/cultures/le-code#systeme-de-gouvernance"');
      expect(result).not.toContain('.md');
    });

    it('should handle case-insensitive vault path matching', () => {
      const mockManifest = {
        sessionId: 'test',
        createdAt: new Date(),
        lastUpdatedAt: new Date(),
        pages: [
          {
            id: '1',
            title: 'Yalgranthir',
            slug: 'yalgranthir',
            route: '/mundis/yalgranthir/Yalgranthir',
            vaultPath: 'Yalgranthir/Yalgranthir.md',
            relativePath: 'Yalgranthir/Yalgranthir.md',
            publishedAt: new Date(),
          },
        ],
      };

      // Input with different case
      const input = '<a href="yalgranthir/yalgranthir.md">Yalgranthir</a>';
      const result = (renderer as any).cleanAndNormalizeLinks(input, mockManifest);

      // Should match case-insensitively and translate
      expect(result).toContain('href="/mundis/yalgranthir/Yalgranthir"');
    });

    it('should transform to unresolved span when page not found in manifest', () => {
      const mockManifest = {
        sessionId: 'test',
        createdAt: new Date(),
        lastUpdatedAt: new Date(),
        pages: [
          {
            id: '1',
            title: 'Known Page',
            slug: 'known',
            route: '/known',
            vaultPath: 'Known.md',
            publishedAt: new Date(),
          },
        ],
      };

      const input = '<a href="Unknown/Page.md">Unknown</a>';
      const result = (renderer as any).cleanAndNormalizeLinks(input, mockManifest);

      // Page not in manifest, should transform to unresolved span
      expect(result).toContain('class="wikilink wikilink-unresolved"');
      expect(result).toContain('>Unknown<');
      expect(result).not.toContain('<a');
      expect(result).not.toContain('.md');
    });
  });
});
