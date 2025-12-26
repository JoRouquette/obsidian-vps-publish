import { promises as fs } from 'fs';
import * as path from 'path';

import { MarkdownItRenderer } from '../infra/markdown/markdown-it.renderer';

describe('Real-world Markdown Rendering (le-code.md)', () => {
  let renderer: MarkdownItRenderer;
  let markdown: string;

  beforeAll(async () => {
    renderer = new MarkdownItRenderer();
    const testFilePath = path.resolve(__dirname, '../../../../test-files/le-code.md');
    markdown = await fs.readFile(testFilePath, 'utf-8');
  });

  it('should strip .md extension from markdown links', async () => {
    const testMarkdown = "- **_L'[Ambassade](Ambassade.md)._**";
    const note = {
      noteId: 'test',
      slug: { value: 'test', isValid: true },
      title: 'Test',
      content: testMarkdown,
      relativePath: 'test.md',
      frontmatter: {},
      assets: [],
      tags: [],
      folderConfig: { routeBase: '' },
      resolvedWikilinks: [],
    } as any;

    const html = await renderer.render(note);

    // Markdown links to unpublished notes should render as unresolved spans
    expect(html).toContain('<span class="wikilink wikilink-unresolved"');
    expect(html).toContain('data-wikilink="Ambassade"');
    expect(html).not.toContain('href="Ambassade.md"');
  });

  it('should strip .md extension from all markdown links in le-code.md', async () => {
    const note = {
      noteId: 'le-code',
      slug: { value: 'le-code', isValid: true },
      title: 'Le Code',
      content: markdown,
      relativePath: 'Le Code.md',
      frontmatter: {},
      assets: [],
      tags: [],
      folderConfig: { routeBase: '' },
      resolvedWikilinks: [],
    } as any;

    const html = await renderer.render(note);

    // Should not contain any .md extensions in hrefs
    const mdLinksRegex = /href="[^"]*\.md"/g;
    const matches = html.match(mdLinksRegex);

    if (matches) {
      console.log('Found .md extensions in links:', matches);
    }

    expect(matches).toBeNull();
  });

  it('should preserve wikilinks without .md extension', () => {
    const testMarkdown = 'Voir [[Cataclysme]] et [[Le Code#Système de gouvernance]].';
    // Simulate wikilinks already resolved
    const noteWithResolvedLinks = {
      noteId: 'test',
      slug: { value: 'test', isValid: true },
      title: 'Test',
      content: testMarkdown,
      relativePath: 'test.md',
      frontmatter: {},
      assets: [],
      tags: [],
      folderConfig: { routeBase: '' },
      resolvedWikilinks: [
        {
          raw: '[[Cataclysme]]',
          target: 'Cataclysme',
          path: '/evenements/cataclysme',
          kind: 'page' as const,
          isResolved: true,
          href: '/evenements/cataclysme',
        },
        {
          raw: '[[Le Code#Système de gouvernance]]',
          target: 'Le Code',
          path: '/cultures/le-code',
          subpath: 'Système de gouvernance',
          kind: 'page' as const,
          isResolved: true,
          href: '/cultures/le-code#systeme-de-gouvernance',
        },
      ],
    } as any;

    return renderer.render(noteWithResolvedLinks).then((result: string) => {
      expect(result).toContain('href="/evenements/cataclysme"');
      expect(result).toContain('href="/cultures/le-code#systeme-de-gouvernance"');
      expect(result).not.toContain('.md');
    });
  });

  it('should handle Cartulaire markdown link', async () => {
    const testMarkdown = '- **_Le [Cartulaire](Cartulaire.md)._**';
    const note = {
      noteId: 'test',
      slug: { value: 'test', isValid: true },
      title: 'Test',
      content: testMarkdown,
      relativePath: 'test.md',
      frontmatter: {},
      assets: [],
      tags: [],
      folderConfig: { routeBase: '' },
      resolvedWikilinks: [],
    } as any;

    const html = await renderer.render(note);

    // Markdown link to unpublished note should render as unresolved span
    expect(html).toContain('<span class="wikilink wikilink-unresolved"');
    expect(html).toContain('data-wikilink="Cartulaire"');
    expect(html).not.toContain('href="Cartulaire.md"');
  });

  it('should handle mixed wikilinks and markdown links', () => {
    const testMarkdown =
      'Après le [[Cataclysme]], voir [Ambassade](Ambassade.md) et [[Capitaine Alastor]].';

    const noteWithResolvedLinks = {
      noteId: 'test',
      slug: { value: 'test', isValid: true },
      title: 'Test',
      content: testMarkdown,
      relativePath: 'test.md',
      frontmatter: {},
      assets: [],
      tags: [],
      folderConfig: { routeBase: '' },
      resolvedWikilinks: [
        {
          raw: '[[Cataclysme]]',
          target: 'Cataclysme',
          path: '/evenements/cataclysme',
          kind: 'page' as const,
          isResolved: true,
          href: '/evenements/cataclysme',
        },
        {
          raw: '[[Capitaine Alastor]]',
          target: 'Capitaine Alastor',
          path: 'Capitaine Alastor',
          kind: 'page' as const,
          isResolved: false, // Not published
        },
      ],
    } as any;

    return renderer.render(noteWithResolvedLinks).then((html: string) => {
      // Wikilink resolved
      expect(html).toContain('href="/evenements/cataclysme"');

      // Markdown link to unpublished note becomes unresolved span
      expect(html).toContain('<span class="wikilink wikilink-unresolved"');
      expect(html).toContain('data-wikilink="Ambassade"');
      expect(html).not.toContain('href="Ambassade.md"');

      // Wikilink unresolved becomes span
      expect(html).toContain('wikilink-unresolved');
      expect(html).toContain('data-wikilink="Capitaine Alastor"');
    });
  });
});
