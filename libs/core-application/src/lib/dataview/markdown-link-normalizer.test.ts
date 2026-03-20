/**
 * Tests: Markdown Link Normalizer
 *
 * Validates strict normalization rules for Dataview links → Obsidian wikilinks.
 */

import { type DataviewLink, MarkdownLinkNormalizer } from './markdown-link-normalizer';

describe('MarkdownLinkNormalizer', () => {
  let normalizer: MarkdownLinkNormalizer;

  beforeEach(() => {
    normalizer = new MarkdownLinkNormalizer();
  });

  describe('normalize() - Dataview Link objects', () => {
    it('should remove .md extension and generate basename alias', () => {
      const link: DataviewLink = { path: 'Ektaron/Personnages/Héléna.md' };
      const result = normalizer.normalize(link);

      expect(result).toBe('[[Ektaron/Personnages/Héléna|Héléna]]');
      expect(result).not.toContain('.md');
    });

    it('should handle accents in paths and basenames', () => {
      const link: DataviewLink = { path: 'Étoiles/Héléna.md' };
      const result = normalizer.normalize(link);

      expect(result).toBe('[[Étoiles/Héléna|Héléna]]');
    });

    it('should handle spaces in paths', () => {
      const link: DataviewLink = { path: 'My Notes/Dr Théodoric.md' };
      const result = normalizer.normalize(link);

      expect(result).toBe('[[My Notes/Dr Théodoric|Dr Théodoric]]');
    });

    it('should handle apostrophes (typographic quotes)', () => {
      const link: DataviewLink = { path: "Notes/L'Étoile.md" };
      const result = normalizer.normalize(link);

      expect(result).toBe("[[Notes/L'Étoile|L'Étoile]]");
    });

    it('should use custom display when provided', () => {
      const link: DataviewLink = {
        path: 'Ektaron/Personnages/Maladram.md',
        display: 'Dr Théodoric Maladram',
      };
      const result = normalizer.normalize(link);

      expect(result).toBe('[[Ektaron/Personnages/Maladram|Dr Théodoric Maladram]]');
      expect(result).not.toContain('Maladram.md');
    });

    it('should remove .md before fragments and preserve unicode paths', () => {
      const link: DataviewLink = { path: 'My Notes/HÃ©lÃ©na.md#CapacitÃ© spÃ©ciale' };
      const result = normalizer.normalize(link);

      expect(result).toBe('[[My Notes/HÃ©lÃ©na#CapacitÃ© spÃ©ciale|HÃ©lÃ©na]]');
      expect(result).not.toContain('.md#');
    });

    it('should handle paths without .md extension', () => {
      const link: DataviewLink = { path: 'Notes/Page' };
      const result = normalizer.normalize(link);

      // No alias needed if path === basename
      expect(result).toBe('[[Notes/Page|Page]]');
    });

    it('should handle single-segment paths (no directory)', () => {
      const link: DataviewLink = { path: 'SimplePage.md' };
      const result = normalizer.normalize(link);

      // basename === path (without .md) → no alias
      expect(result).toBe('[[SimplePage]]');
    });

    it('should handle embeds with ![[...]]', () => {
      const link: DataviewLink = {
        path: 'Assets/Image.png',
        embed: true,
      };
      const result = normalizer.normalize(link);

      expect(result).toBe('![[Assets/Image.png]]');
      // Embeds keep extension (for images, PDFs, etc.)
      expect(result).toContain('.png');
    });

    it('should handle PDF embeds', () => {
      const link: DataviewLink = {
        path: 'Documents/Report.pdf',
        embed: true,
      };
      const result = normalizer.normalize(link);

      expect(result).toBe('![[Documents/Report.pdf]]');
    });

    it('should return empty string for invalid link (no path)', () => {
      const link: DataviewLink = { path: '' };
      const result = normalizer.normalize(link);

      expect(result).toBe('');
    });

    it('should handle Windows-style path separators', () => {
      const link: DataviewLink = { path: 'Folder\\Subfolder\\Page.md' };
      const result = normalizer.normalize(link);

      expect(result).toBe('[[Folder\\Subfolder\\Page|Page]]');
    });
  });

  describe('normalizeValue() - Any Dataview value', () => {
    it('should normalize DataviewLink objects', () => {
      const value: DataviewLink = { path: 'Notes/Héléna.md' };
      const result = normalizer.normalizeValue(value);

      expect(result).toBe('[[Notes/Héléna|Héléna]]');
    });

    it('should normalize arrays of links', () => {
      const value: DataviewLink[] = [
        { path: 'A.md' },
        { path: 'Folder/B.md' },
        { path: 'C.md', display: 'Custom' },
      ];
      const result = normalizer.normalizeValue(value);

      expect(result).toBe('[[A]], [[Folder/B|B]], [[C|Custom]]');
    });

    it('should handle single-element arrays', () => {
      const value: DataviewLink[] = [{ path: 'Page.md' }];
      const result = normalizer.normalizeValue(value);

      expect(result).toBe('[[Page]]');
    });

    it('should handle empty arrays', () => {
      const value: unknown[] = [];
      const result = normalizer.normalizeValue(value);

      expect(result).toBe('');
    });

    it('should handle null', () => {
      const result = normalizer.normalizeValue(null);

      expect(result).toBe('');
    });

    it('should handle undefined', () => {
      const result = normalizer.normalizeValue(undefined);

      expect(result).toBe('');
    });

    it('should handle string primitives', () => {
      const result = normalizer.normalizeValue('Plain text');

      expect(result).toBe('Plain text');
    });

    it('should handle number primitives', () => {
      const result = normalizer.normalizeValue(42);

      expect(result).toBe('42');
    });

    it('should handle boolean primitives', () => {
      expect(normalizer.normalizeValue(true)).toBe('true');
      expect(normalizer.normalizeValue(false)).toBe('false');
    });

    it('should stringify non-link objects (fallback)', () => {
      const value = { key: 'value', nested: { data: 123 } };
      const result = normalizer.normalizeValue(value);

      // Should be JSON string
      expect(result).toContain('"key"');
      expect(result).toContain('"value"');
    });

    it('should handle mixed arrays (links + primitives)', () => {
      const value = [{ path: 'Page.md' }, 'text', 42];
      const result = normalizer.normalizeValue(value);

      expect(result).toBe('[[Page]], text, 42');
    });

    it('should normalize links with encoded spaces and fragments', () => {
      const value: DataviewLink = {
        path: 'Folder/Space%20Page.md#Heading%20One',
        display: 'Alias',
      };
      const result = normalizer.normalizeValue(value);

      expect(result).toBe('[[Folder/Space%20Page#Heading%20One|Alias]]');
    });
  });

  describe('Edge cases and special characters', () => {
    it('should handle paths with parentheses', () => {
      const link: DataviewLink = { path: 'Notes/Page (v2).md' };
      const result = normalizer.normalize(link);

      expect(result).toBe('[[Notes/Page (v2)|Page (v2)]]');
    });

    it('should handle paths with brackets', () => {
      const link: DataviewLink = { path: 'Notes/[Draft] Page.md' };
      const result = normalizer.normalize(link);

      expect(result).toBe('[[Notes/[Draft] Page|[Draft] Page]]');
    });

    it('should handle paths with dashes and underscores', () => {
      const link: DataviewLink = { path: 'my-folder/my_page.md' };
      const result = normalizer.normalize(link);

      expect(result).toBe('[[my-folder/my_page|my_page]]');
    });

    it('should handle emoji in paths', () => {
      const link: DataviewLink = { path: 'Notes/🚀 Rocket.md' };
      const result = normalizer.normalize(link);

      expect(result).toBe('[[Notes/🚀 Rocket|🚀 Rocket]]');
    });

    it('should NOT generate external URLs (no http://)', () => {
      const link: DataviewLink = { path: 'Maladram.md' };
      const result = normalizer.normalize(link);

      expect(result).not.toContain('http://');
      expect(result).not.toContain('<a');
      expect(result).toBe('[[Maladram]]');
    });

    it('should NOT generate HTML tags', () => {
      const link: DataviewLink = { path: 'Page.md', display: '<script>alert("XSS")</script>' };
      const result = normalizer.normalize(link);

      // Should be plain Markdown (HTML in alias is OK for Obsidian)
      expect(result).toBe('[[Page|<script>alert("XSS")</script>]]');
      // But NOT as rendered HTML elements
      expect(result).not.toMatch(/<a href=/);
      expect(result).not.toMatch(/<span class=/);
    });
  });

  describe('Real-world Dataview scenarios', () => {
    it('should handle TABLE query results (array of link objects)', () => {
      const rows = [
        [{ path: 'Ektaron/Héléna.md' }, 'Hero'],
        [{ path: 'Ektaron/Maladram.md', display: 'Dr Théodoric' }, 'Villain'],
      ];

      const result = rows.map((row) => row.map((cell) => normalizer.normalizeValue(cell)));

      expect(result[0][0]).toBe('[[Ektaron/Héléna|Héléna]]');
      expect(result[0][1]).toBe('Hero');
      expect(result[1][0]).toBe('[[Ektaron/Maladram|Dr Théodoric]]');
      expect(result[1][1]).toBe('Villain');

      // CRITICAL: No .md in output
      expect(result.flat().join(' ')).not.toContain('.md');
    });

    it('should handle LIST query results (array of links)', () => {
      const items = [
        { path: 'Page1.md' },
        { path: 'Folder/Page2.md', display: 'Custom Title' },
        { path: 'Page3.md' },
      ];

      const result = items.map((item) => normalizer.normalizeValue(item));

      expect(result).toEqual(['[[Page1]]', '[[Folder/Page2|Custom Title]]', '[[Page3]]']);
    });

    it('should handle nested link arrays (outlinks, backlinks)', () => {
      const value = [[{ path: 'A.md' }, { path: 'B.md' }], [{ path: 'C.md' }]];

      const result = normalizer.normalizeValue(value);

      // Arrays within arrays → nested join
      expect(result).toBe('[[A]], [[B]], [[C]]');
    });
  });
});
