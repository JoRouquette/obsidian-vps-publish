/**
 * Tests for MarkdownItRenderer - Link Validation with Manifest
 *
 * Validates that links are checked against the manifest and:
 * - Valid links (page exists) remain as <a> tags with proper routing
 * - Invalid links (page missing) are converted to <span class="wikilink-unresolved">
 */

import { describe, expect, it } from '@jest/globals';

import { MarkdownItRenderer } from '../infra/markdown/markdown-it.renderer';

describe('MarkdownItRenderer - Link Validation', () => {
  let renderer: MarkdownItRenderer;

  beforeEach(() => {
    renderer = new MarkdownItRenderer();
  });

  describe('link validation with manifest', () => {
    it('should transform invalid links to unresolved spans', () => {
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

      const input = `
        <a href="Known.md">Known</a>
        <a href="Unknown.md">Unknown</a>
        <a href="Missing/Page.md">Missing</a>
      `;
      const result = (renderer as any).cleanAndNormalizeLinks(input, mockManifest);

      // Known page should be a valid link
      expect(result).toMatch(/<a[^>]*href="\/known"[^>]*>Known<\/a>/);
      expect(result).toMatch(/<a[^>]*class="[^"]*wikilink[^"]*"[^>]*>Known<\/a>/);

      // Unknown pages should be unresolved spans
      expect(result).toContain('class="wikilink wikilink-unresolved"');
      expect(result).toContain('>Unknown<');
      expect(result).toContain('>Missing<');

      // Should not contain <a> tags for unknown pages
      const unknownLinkMatch = result.match(/<a[^>]*>Unknown<\/a>/);
      expect(unknownLinkMatch).toBeNull();

      const missingLinkMatch = result.match(/<a[^>]*>Missing<\/a>/);
      expect(missingLinkMatch).toBeNull();
    });

    it('should preserve valid links and convert invalid ones in Dataview output', () => {
      const mockManifest = {
        sessionId: 'test',
        createdAt: new Date(),
        lastUpdatedAt: new Date(),
        pages: [
          {
            id: '1',
            title: 'Character A',
            slug: 'character-a',
            route: '/characters/character-a',
            vaultPath: 'Characters/CharacterA.md',
            relativePath: 'Characters/CharacterA.md',
            publishedAt: new Date(),
          },
        ],
      };

      const input = `
        <table>
          <tr>
            <td><a href="Characters/CharacterA.md">Character A</a></td>
            <td><a href="Characters/CharacterB.md">Character B</a></td>
          </tr>
        </table>
      `;
      const result = (renderer as any).cleanAndNormalizeLinks(input, mockManifest);

      // Character A exists - should be valid link
      expect(result).toContain('href="/characters/character-a"');
      expect(result).toMatch(/<a[^>]*>Character A<\/a>/);

      // Character B doesn't exist - should be unresolved span
      expect(result).toContain('class="wikilink wikilink-unresolved"');
      expect(result).toContain('>Character B<');
      expect(result).not.toMatch(/<a[^>]*>Character B<\/a>/);
    });

    it('should handle links with anchors correctly for validation', () => {
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

      const input = `
        <a href="Le Code.md#section">Valid Section</a>
        <a href="Unknown.md#section">Invalid Section</a>
      `;
      const result = (renderer as any).cleanAndNormalizeLinks(input, mockManifest);

      // Valid page with anchor should remain a link
      expect(result).toContain('href="/cultures/le-code#section"');
      expect(result).toMatch(/<a[^>]*>Valid Section<\/a>/);

      // Invalid page with anchor should be unresolved span
      expect(result).toContain('>Invalid Section<');
      expect(result).not.toMatch(/<a[^>]*>Invalid Section<\/a>/);
    });

    it('should skip fragment-only links during validation', () => {
      const mockManifest = {
        sessionId: 'test',
        createdAt: new Date(),
        lastUpdatedAt: new Date(),
        pages: [],
      };

      const input = '<a href="#section">Jump to section</a>';
      const result = (renderer as any).cleanAndNormalizeLinks(input, mockManifest);

      // Fragment-only links should be skipped (not validated)
      expect(result).toContain('href="#section"');
      expect(result).toContain('>Jump to section<');
    });

    it('should assume links are valid when no manifest provided', () => {
      const input = '<a href="Unknown.md">Unknown</a>';
      const result = (renderer as any).cleanAndNormalizeLinks(input);

      // Without manifest, should assume link is valid (no validation)
      expect(result).toContain('href="Unknown"');
      expect(result).toMatch(/<a[^>]*>Unknown<\/a>/);
      expect(result).not.toContain('wikilink-unresolved');
    });

    it('should transform unresolved link to span with proper attributes', () => {
      const mockManifest = {
        sessionId: 'test',
        createdAt: new Date(),
        lastUpdatedAt: new Date(),
        pages: [],
      };

      const input = '<a href="NotPublished.md" class="custom-class">Not Published</a>';
      const result = (renderer as any).cleanAndNormalizeLinks(input, mockManifest);

      // Should be transformed to span
      expect(result).toContain('<span');
      expect(result).toContain('class="wikilink wikilink-unresolved"');
      expect(result).toContain('role="link"');
      expect(result).toContain('aria-disabled="true"');
      expect(result).toContain('title="Cette page arrive prochainement"');
      expect(result).toContain('data-tooltip="Cette page arrive prochainement"');
      expect(result).toContain('>Not Published<');

      // Should not be a link
      expect(result).not.toMatch(/<a[^>]*>Not Published<\/a>/);
    });
  });
});
