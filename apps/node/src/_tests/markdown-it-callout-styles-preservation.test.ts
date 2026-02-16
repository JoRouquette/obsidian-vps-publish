import { MarkdownItRenderer } from '../infra/markdown/markdown-it.renderer';

describe('MarkdownItRenderer - Callout Styles Preservation', () => {
  let renderer: MarkdownItRenderer;

  const mockLogger = {
    child: jest.fn().mockReturnThis(),
    debug: jest.fn(),
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
  } as any;

  const makeNote = (content: string, noteId = 'test') => ({
    noteId,
    title: 'Test Note',
    vaultPath: 'test.md',
    relativePath: 'test.md',
    content,
    frontmatter: { flat: {}, nested: {}, tags: [] },
    folderConfig: {
      id: 'folder-1',
      vaultFolder: '',
      routeBase: '/',
      vpsId: 'vps-1',
      ignoredCleanupRuleIds: [],
    },
    routing: {
      slug: noteId,
      path: '/',
      fullPath: `/${noteId}`,
      routeBase: '/',
    },
    eligibility: { isPublishable: true },
    publishedAt: new Date(),
  });

  beforeEach(() => {
    renderer = new MarkdownItRenderer(undefined, mockLogger);
  });

  it('should preserve callout styles in rendered HTML', async () => {
    const note = makeNote('> [!custom] Custom Callout\n> Test content');

    const calloutStyles = [
      {
        path: '.obsidian/snippets/custom.css',
        css: '.callout[data-callout="custom"] { --callout-color: 255, 0, 0; background: red; }',
      },
    ];

    const html = await renderer.render(note, {
      calloutStyles,
    });

    // Vérifie la présence du <style> tag avec data-callout-styles
    expect(html).toContain('<style data-callout-styles=');

    // Vérifie le CSS custom
    expect(html).toContain('.callout[data-callout="custom"]');
    expect(html).toContain('--callout-color: 255, 0, 0');
    expect(html).toContain('background: red');

    // Vérifie les icon fonts
    expect(html).toContain(
      '<link rel="stylesheet" href="https://fonts.googleapis.com/icon?family=Material+Icons'
    );
    expect(html).toContain(
      '<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Material+Symbols+Outlined'
    );

    // Vérifie que le callout est présent
    expect(html).toContain('data-callout="custom"');
    expect(html).toContain('Test content');
  });

  it('should preserve multiple callout styles', async () => {
    const note = makeNote('> [!idea] Idea\n> Content\n\n> [!danger] Danger\n> Warning');

    const calloutStyles = [
      {
        path: '.obsidian/snippets/idea.css',
        css: '.callout[data-callout="idea"] { --callout-color: 100, 200, 50; }',
      },
      {
        path: '.obsidian/snippets/danger.css',
        css: '.callout[data-callout="danger"] { --callout-color: 255, 0, 0; }',
      },
    ];

    const html = await renderer.render(note, {
      calloutStyles,
    });

    // Les deux styles doivent être présents
    expect(html).toContain('.callout[data-callout="idea"]');
    expect(html).toContain('--callout-color: 100, 200, 50');
    expect(html).toContain('.callout[data-callout="danger"]');
    expect(html).toContain('--callout-color: 255, 0, 0');
  });

  it('should render callouts without custom styles', async () => {
    const note = makeNote('> [!note] Standard Note\n> Default styling');

    const html = await renderer.render(note, {
      calloutStyles: undefined,
    });

    // Icon fonts doivent être présents même sans styles custom
    expect(html).toContain('<link rel="stylesheet"');
    expect(html).toContain('Material+Icons');

    // Le callout standard doit être rendu
    expect(html).toContain('data-callout="note"');
    expect(html).toContain('Default styling');
  });

  it('should preserve styles through tag filtering', async () => {
    const note = makeNote('> [!test] Test\n> Content\n\n#tag1 #tag2');

    const calloutStyles = [
      {
        path: '.obsidian/snippets/test.css',
        css: '.callout[data-callout="test"] { color: blue; }',
      },
    ];

    const html = await renderer.render(note, {
      calloutStyles,
      ignoredTags: ['tag1', 'tag2'],
    });

    // Styles préservés après filtrage des tags
    expect(html).toContain('<style data-callout-styles=');
    expect(html).toContain('.callout[data-callout="test"]');
    expect(html).toContain('color: blue');

    // Tags filtrés
    expect(html).not.toContain('#tag1');
    expect(html).not.toContain('#tag2');
  });

  it('should handle empty callout styles array', async () => {
    const note = makeNote('> [!note] Note\n> Content');

    const html = await renderer.render(note, {
      calloutStyles: [],
    });

    // Icon fonts toujours présents
    expect(html).toContain('<link rel="stylesheet"');

    // Callout rendu
    expect(html).toContain('data-callout="note"');
  });

  it('should preserve styles with complex markdown (wikilinks, images, etc)', async () => {
    const markdown = `
> [!custom] Custom Callout
> Content with [[wikilink]] and ![image](path.png)

Some text between

> [!another] Another
> More content
    `.trim();

    const note = makeNote(markdown);

    const calloutStyles = [
      {
        path: '.obsidian/snippets/multi.css',
        css: '.callout[data-callout="custom"] { color: red; }\n.callout[data-callout="another"] { color: blue; }',
      },
    ];

    const html = await renderer.render(note, {
      calloutStyles,
    });

    // Styles préservés
    expect(html).toContain('<style data-callout-styles=');
    expect(html).toContain('color: red');
    expect(html).toContain('color: blue');

    // Callouts présents
    expect(html).toContain('data-callout="custom"');
    expect(html).toContain('data-callout="another"');
  });
});
