import { type PublishableNote } from '@core-domain';

import { MarkdownItRenderer } from '../infra/markdown/markdown-it.renderer';

describe('MarkdownItRenderer', () => {
  const baseNote = (): PublishableNote => ({
    noteId: 'note-1',
    title: 'Test Note',
    vaultPath: 'vault/note-1.md',
    relativePath: 'note-1.md',
    content: '',
    frontmatter: { flat: {}, nested: {}, tags: [] },
    folderConfig: {
      id: 'folder',
      vaultFolder: 'notes',
      routeBase: '/notes',
      vpsId: 'vps',
      ignoredCleanupRuleIds: [],
    },
    routing: { slug: 'note-1', path: '', routeBase: '/notes', fullPath: '/notes/note-1' },
    publishedAt: new Date('2024-01-01T00:00:00Z'),
    eligibility: { isPublishable: true },
  });

  it('renders markdown to HTML', async () => {
    const renderer = new MarkdownItRenderer();
    const note = baseNote();
    note.content = '# Title';
    const html = await renderer.render(note);
    expect(html).toContain('<h1>Title</h1>');
  });

  it('injects assets with display options', async () => {
    const renderer = new MarkdownItRenderer();
    const note = baseNote();
    note.content = 'Intro ![[images/pic.png|right|300]] ending.';
    note.assets = [
      {
        raw: '![[images/pic.png|right|300]]',
        target: 'images/pic.png',
        kind: 'image',
        display: { alignment: 'right', width: 300, classes: ['rounded'], rawModifiers: [] },
      },
    ];

    const html = await renderer.render(note);

    expect(html).toContain('<img class="md-asset md-asset-image align-right is-inline rounded"');
    expect(html).toContain('src="/assets/images/pic.png"');
    expect(html).toContain('max-width:300px');
  });

  it('renders pdf as download button', async () => {
    const renderer = new MarkdownItRenderer();
    const note = baseNote();
    note.content = '![[docs/file.pdf]]';
    note.assets = [
      {
        raw: '![[docs/file.pdf]]',
        target: 'docs/file.pdf',
        kind: 'pdf',
        display: { classes: [], rawModifiers: [] },
      },
    ];

    const html = await renderer.render(note);

    expect(html).toContain('md-asset-download');
    expect(html).toContain('href="/assets/docs/file.pdf"');
    expect(html).not.toContain('<iframe');
  });

  it('ignores assets coming from frontmatter when injecting content', async () => {
    const renderer = new MarkdownItRenderer();
    const note = baseNote();
    note.content = 'Hello';
    note.assets = [
      {
        raw: '![[images/pic.png]]',
        target: 'images/pic.png',
        kind: 'image',
        origin: 'frontmatter',
        display: { classes: [], rawModifiers: [] },
      },
    ];

    const html = await renderer.render(note);

    expect(html).not.toContain('<img');
  });

  it('renders resolved wikilinks as anchors and unresolved as accent text', async () => {
    const renderer = new MarkdownItRenderer();
    const note = baseNote();
    note.content = 'Go to [[Resolved|Alias]] then [[Missing]].';
    note.resolvedWikilinks = [
      {
        raw: '[[Resolved|Alias]]',
        target: 'Resolved',
        path: '/notes/resolved',
        alias: 'Alias',
        kind: 'note',
        isResolved: true,
        href: '/notes/resolved',
      },
      {
        raw: '[[Missing]]',
        target: 'Missing',
        path: '/notes/missing',
        kind: 'note',
        isResolved: false,
      },
    ];

    const html = await renderer.render(note);

    expect(html).toContain(
      '<a class="wikilink" data-wikilink="Resolved" href="/notes/resolved">Alias</a>'
    );
    expect(html).toContain('<span class="wikilink wikilink-unresolved"');
    expect(html).not.toContain('[[Missing]]');
  });

  it('renders obsidian callouts with title and body', async () => {
    const renderer = new MarkdownItRenderer();
    const note = baseNote();
    note.content = ['> [!warning] Attention', '> Something went wrong.'].join('\n');

    const html = await renderer.render(note);

    expect(html).toContain('class="callout"');
    expect(html).toContain('data-callout="warning"');
    expect(html).toContain('class="callout-icon material-symbols-outlined"');
    expect(html).toContain('<span class="callout-label">Attention</span>');
    expect(html).toContain('<div class="callout-content">');
    expect(html).toContain('<p>Something went wrong.</p>');
    expect(html).not.toContain('[!warning]');
  });

  it('supports collapsible callouts syntax', async () => {
    const renderer = new MarkdownItRenderer();
    const note = baseNote();
    note.content = ['> [!note]- Collapsible', '> Hidden by default.'].join('\n');

    const html = await renderer.render(note);

    expect(html).toContain('<details class="callout"');
    expect(html).toContain('data-callout-fold="closed"');
    expect(html).toContain('class="callout-icon material-symbols-outlined"');
    expect(html).not.toContain('[!note]-');
  });

  it('wraps tables in .table-wrapper for horizontal scroll and sticky header', async () => {
    const renderer = new MarkdownItRenderer();
    const note = baseNote();
    note.content = [
      '| Header 1 | Header 2 | Header 3 |',
      '| -------- | -------- | -------- |',
      '| Cell 1   | Cell 2   | Cell 3   |',
      '| Cell 4   | Cell 5   | Cell 6   |',
    ].join('\n');

    const html = await renderer.render(note);

    // Vérifier que la table est wrappée
    expect(html).toContain('<div class="table-wrapper">');
    expect(html).toContain('<table>');
    expect(html).toContain('</table>');
    expect(html).toContain('</div>');

    // Vérifier que le wrapper entoure bien la table
    const wrapperStart = html.indexOf('<div class="table-wrapper">');
    const tableStart = html.indexOf('<table>');
    const tableEnd = html.indexOf('</table>');
    const wrapperEnd = html.indexOf('</div>', tableEnd);

    expect(wrapperStart).toBeGreaterThan(-1);
    expect(tableStart).toBeGreaterThan(wrapperStart);
    expect(tableEnd).toBeGreaterThan(tableStart);
    expect(wrapperEnd).toBeGreaterThan(tableEnd);

    // Vérifier le contenu de la table
    expect(html).toContain('<thead>');
    expect(html).toContain('<th>Header 1</th>');
    expect(html).toContain('<tbody>');
    expect(html).toContain('<td>Cell 1</td>');
  });
});
