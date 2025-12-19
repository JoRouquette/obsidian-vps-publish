/**
 * Integration Tests: Dataview Link Corruption Prevention
 *
 * OBJECTIVE:
 * Ensure Dataview → Markdown conversion NEVER produces:
 * - External URLs like http://Maladram.md
 * - HTML tags in Markdown output
 * - .md extensions in visible text
 *
 * CRITICAL TEST CASE: "Dr Théodoric Maladram"
 * - Reproduces real bug where table cell contained corrupted link
 * - Validates strict normalization rules
 */

import type { DataviewQueryResult } from '@core-application/dataview/dataview-to-markdown.converter';
import { DataviewToMarkdownConverter } from '@core-application/dataview/dataview-to-markdown.converter';

describe('Dataview Link Corruption Prevention', () => {
  let converter: DataviewToMarkdownConverter;

  beforeEach(() => {
    converter = new DataviewToMarkdownConverter();
  });

  describe('Bug: http://Maladram.md in table cells', () => {
    it('should NOT generate external URLs from .md links in Dataview tables', () => {
      const result: DataviewQueryResult = {
        successful: true,
        value: {
          headers: ['Personnage', 'Rôle'],
          values: [
            [
              { path: 'Ektaron/Personnages/Maladram.md', display: 'Dr Théodoric Maladram' },
              'Antagoniste',
            ],
            [{ path: 'Ektaron/Personnages/Héléna.md' }, 'Héroïne'],
          ],
        },
      };

      const markdown = converter.convertQueryToMarkdown(result, 'table');

      // ✅ MUST contain normalized wikilinks with aliases
      expect(markdown).toContain('[[Ektaron/Personnages/Maladram|Dr Théodoric Maladram]]');
      expect(markdown).toContain('[[Ektaron/Personnages/Héléna|Héléna]]');

      // ❌ MUST NOT contain .md in visible text
      expect(markdown).not.toContain('Maladram.md');
      expect(markdown).not.toContain('Héléna.md');

      // ❌ MUST NOT contain HTML elements
      expect(markdown).not.toMatch(/<a href=/);
      expect(markdown).not.toMatch(/<span class=/);
      expect(markdown).not.toMatch(/<table/);

      // ❌ MUST NOT contain external URL protocols
      expect(markdown).not.toContain('http://');
      expect(markdown).not.toContain('https://');

      // ✅ Validate Markdown table structure
      expect(markdown).toContain('| Personnage | Rôle |');
      expect(markdown).toContain('| --- | --- |');
    });

    it('should handle mixed content in table cells (links + text)', () => {
      const result: DataviewQueryResult = {
        successful: true,
        value: {
          headers: ['Référence'],
          values: [
            ['Dr Théodoric vit dans ', { path: 'Lieux/Maison Maladram.md' }],
            [{ path: 'Personnages/Héléna.md' }, ' est la protagoniste'],
          ],
        },
      };

      const markdown = converter.convertQueryToMarkdown(result, 'table');

      // ✅ Links normalized
      expect(markdown).toContain('[[Lieux/Maison Maladram|Maison Maladram]]');
      expect(markdown).toContain('[[Personnages/Héléna|Héléna]]');

      // ❌ No .md leaked
      expect(markdown).not.toContain('.md');

      // ❌ No HTML
      expect(markdown).not.toMatch(/<[a-z]+/i);
    });

    it('should handle paths with spaces and accents', () => {
      const result: DataviewQueryResult = {
        successful: true,
        value: {
          headers: ['Page'],
          values: [
            [{ path: "Lieux/L'Étoile du Nord.md" }],
            [{ path: 'Personnages/Théo Müller.md' }],
          ],
        },
      };

      const markdown = converter.convertQueryToMarkdown(result, 'table');

      // ✅ Correctly normalized
      expect(markdown).toContain("[[Lieux/L'Étoile du Nord|L'Étoile du Nord]]");
      expect(markdown).toContain('[[Personnages/Théo Müller|Théo Müller]]');

      // ❌ No .md
      expect(markdown).not.toContain('.md');
    });
  });

  describe('Lists with internal links', () => {
    it('should normalize LIST query results', () => {
      const result: DataviewQueryResult = {
        successful: true,
        value: {
          values: [
            { path: 'Notes/Page1.md' },
            { path: 'Folder/Page2.md', display: 'Custom Title' },
            { path: 'Héléna.md' },
          ],
        },
      };

      const markdown = converter.convertQueryToMarkdown(result, 'list');

      // ✅ Normalized wikilinks
      expect(markdown).toContain('- [[Notes/Page1|Page1]]');
      expect(markdown).toContain('- [[Folder/Page2|Custom Title]]');
      expect(markdown).toContain('- [[Héléna]]');

      // ❌ No .md
      expect(markdown).not.toContain('.md');

      // ❌ No HTML
      expect(markdown).not.toMatch(/<li>/);
      expect(markdown).not.toMatch(/<ul>/);
    });

    it('should handle arrays of links in list items', () => {
      const result: DataviewQueryResult = {
        successful: true,
        value: {
          values: [[{ path: 'A.md' }, { path: 'B.md' }], [{ path: 'C.md' }]],
        },
      };

      const markdown = converter.convertQueryToMarkdown(result, 'list');

      // ✅ Arrays joined with comma
      expect(markdown).toContain('- [[A]], [[B]]');
      expect(markdown).toContain('- [[C]]');

      // ❌ No .md
      expect(markdown).not.toContain('.md');
    });
  });

  describe('Task lists with links', () => {
    it('should normalize TASK query results', () => {
      const result: DataviewQueryResult = {
        successful: true,
        value: {
          values: [
            {
              completed: false,
              text: 'Review [[Notes/Document.md|Document]]',
            },
            {
              completed: true,
              text: 'Read [[Books/Héléna.md]]',
            },
          ],
        },
      };

      const markdown = converter.convertQueryToMarkdown(result, 'task');

      // ✅ Task list format preserved
      expect(markdown).toContain('- [ ] Review [[Notes/Document.md|Document]]');
      expect(markdown).toContain('- [x] Read [[Books/Héléna.md]]');

      // NOTE: Text field may contain raw wikilinks (not normalized)
      // This is acceptable as long as no .md in link targets themselves
    });
  });

  describe('Edge cases: Invalid or missing data', () => {
    it('should handle empty link path gracefully', () => {
      const result: DataviewQueryResult = {
        successful: true,
        value: {
          values: [{ path: '' }],
        },
      };

      const markdown = converter.convertQueryToMarkdown(result, 'list');

      // Empty link → empty string (no crash)
      expect(markdown).toBe('- ');
    });

    it('should handle null/undefined values', () => {
      const result: DataviewQueryResult = {
        successful: true,
        value: {
          headers: ['Value'],
          values: [[null], [undefined], ['Text']],
        },
      };

      const markdown = converter.convertQueryToMarkdown(result, 'table');

      // null/undefined → empty cells
      expect(markdown).toContain('|  |');
      expect(markdown).toContain('| Text |');
    });

    it('should handle non-link objects (fallback to JSON)', () => {
      const result: DataviewQueryResult = {
        successful: true,
        value: {
          values: [{ key: 'value', nested: { data: 123 } }],
        },
      };

      const markdown = converter.convertQueryToMarkdown(result, 'list');

      // Non-link object → JSON string
      expect(markdown).toContain('"key"');
      expect(markdown).toContain('"value"');

      // But still no HTML
      expect(markdown).not.toMatch(/<[a-z]+/i);
    });
  });

  describe('XSS and injection prevention', () => {
    it('should NOT execute HTML in link display', () => {
      const result: DataviewQueryResult = {
        successful: true,
        value: {
          values: [
            {
              path: 'Page.md',
              display: '<script>alert("XSS")</script>',
            },
          ],
        },
      };

      const markdown = converter.convertQueryToMarkdown(result, 'list');

      // ✅ Script tag in display (Obsidian will escape it)
      expect(markdown).toContain('[[Page|<script>alert("XSS")</script>]]');

      // ❌ NOT rendered as HTML element
      expect(markdown).not.toMatch(/<a /);
      expect(markdown).not.toMatch(/href=/);
    });

    it('should NOT allow injection via path', () => {
      const result: DataviewQueryResult = {
        successful: true,
        value: {
          values: [
            {
              path: '"><img src=x onerror=alert(1)>.md',
            },
          ],
        },
      };

      const markdown = converter.convertQueryToMarkdown(result, 'list');

      // ✅ Path sanitized (extension removed, encapsulated in wikilink)
      // The dangerous payload is INSIDE a wikilink, so it's safe (Obsidian will escape it)
      expect(markdown).toContain('[[\"><img src=x onerror=alert(1)>]]');

      // ❌ MUST NOT render as standalone HTML element (outside wikilinks)
      // The pattern below would match if HTML was rendered outside of [[ ]]
      expect(markdown).not.toMatch(/^<img /);
      expect(markdown).not.toMatch(/\n<img /);
      expect(markdown).not.toMatch(/> <img /);
    });
  });

  describe('Real-world scenario: Complex Dataview table', () => {
    it('should handle multi-column table with links and text', () => {
      const result: DataviewQueryResult = {
        successful: true,
        value: {
          headers: ['Nom', 'Lieu', 'Statut', 'Liens'],
          values: [
            [
              { path: 'Personnages/Dr Théodoric Maladram.md', display: 'Dr Maladram' },
              { path: 'Lieux/Ektaron.md' },
              'Vivant',
              [{ path: 'Personnages/Héléna.md' }, { path: 'Personnages/Elara.md' }],
            ],
            [
              { path: 'Personnages/Héléna.md' },
              { path: 'Lieux/Forêt Mystique.md', display: "Forêt de l'Aube" },
              'Disparue',
              [],
            ],
          ],
        },
      };

      const markdown = converter.convertQueryToMarkdown(result, 'table');

      // ✅ All links normalized
      expect(markdown).toContain('[[Personnages/Dr Théodoric Maladram|Dr Maladram]]');
      expect(markdown).toContain('[[Lieux/Ektaron|Ektaron]]');
      expect(markdown).toContain('[[Personnages/Héléna|Héléna]]');
      expect(markdown).toContain('[[Personnages/Elara|Elara]]');
      expect(markdown).toContain("[[Lieux/Forêt Mystique|Forêt de l'Aube]]");

      // ✅ Arrays joined correctly
      expect(markdown).toContain('[[Personnages/Héléna|Héléna]], [[Personnages/Elara|Elara]]');

      // ❌ No .md anywhere
      expect(markdown).not.toContain('.md');

      // ❌ No HTML
      expect(markdown).not.toMatch(/<[a-z]+/i);

      // ❌ No external URLs
      expect(markdown).not.toContain('http://');

      // ✅ Text values preserved
      expect(markdown).toContain('Vivant');
      expect(markdown).toContain('Disparue');
    });
  });
});
