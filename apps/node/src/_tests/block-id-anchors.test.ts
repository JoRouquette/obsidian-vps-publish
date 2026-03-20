import { MarkdownItRenderer } from '../infra/markdown/markdown-it.renderer';

describe('Block ID anchors', () => {
  it('attaches block IDs to simple paragraphs and strips the marker text', async () => {
    const renderer = new MarkdownItRenderer();

    const html = await renderer.render({
      noteId: 'note-1',
      title: 'Block IDs',
      relativePath: 'notes/block-ids.md',
      content: 'The quick purple gem dashes through the paragraph with blazing speed. ^37066d',
      frontmatter: { flat: {}, nested: {}, tags: [] },
      folderConfig: { routeBase: '', ignoredCleanupRuleIds: [] },
      routing: {
        slug: 'block-ids',
        path: '',
        routeBase: '',
        fullPath: '/block-ids',
      },
      publishedAt: new Date(),
      eligibility: { isPublishable: true },
      resolvedWikilinks: [],
      assets: [],
    } as any);

    expect(html).toContain('<p id="^37066d">The quick purple gem dashes through the paragraph');
    expect(html).not.toContain('^37066d</p>');
  });

  it('attaches block IDs to structured blocks placed on a standalone line', async () => {
    const renderer = new MarkdownItRenderer();

    const html = await renderer.render({
      noteId: 'note-1',
      title: 'Block IDs',
      relativePath: 'notes/block-ids.md',
      content: `> The quick purple gem dashes through the paragraph with blazing speed.

^37066f

This is the tale of Gemmy.`,
      frontmatter: { flat: {}, nested: {}, tags: [] },
      folderConfig: { routeBase: '', ignoredCleanupRuleIds: [] },
      routing: {
        slug: 'block-ids',
        path: '',
        routeBase: '',
        fullPath: '/block-ids',
      },
      publishedAt: new Date(),
      eligibility: { isPublishable: true },
      resolvedWikilinks: [],
      assets: [],
    } as any);

    expect(html).toContain('<blockquote id="^37066f">');
    expect(html).toContain('<p>This is the tale of Gemmy.</p>');
    expect(html).not.toContain('^37066f</p>');
  });

  it('preserves caret fragments in rendered wikilinks', async () => {
    const renderer = new MarkdownItRenderer();

    const html = await renderer.render({
      noteId: 'note-1',
      title: 'Block IDs',
      relativePath: 'notes/block-ids.md',
      content: 'Jump to [[Target#^37066d]].',
      frontmatter: { flat: {}, nested: {}, tags: [] },
      folderConfig: { routeBase: '', ignoredCleanupRuleIds: [] },
      routing: {
        slug: 'block-ids',
        path: '',
        routeBase: '',
        fullPath: '/block-ids',
      },
      publishedAt: new Date(),
      eligibility: { isPublishable: true },
      resolvedWikilinks: [
        {
          raw: '[[Target#^37066d]]',
          target: 'Target#^37066d',
          path: 'Target',
          subpath: '^37066d',
          kind: 'note',
          isResolved: true,
          href: '/target#^37066d',
        },
      ],
      assets: [],
    } as any);

    expect(html).toContain('href="/target#%5E37066d"');
  });
});
