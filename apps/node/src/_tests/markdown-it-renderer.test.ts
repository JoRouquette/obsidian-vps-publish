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
    // Headings now have automatic IDs via markdown-it-anchor
    expect(html).toContain('<h1 id="title"');
    expect(html).toContain('>Title</h1>');
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

    // Resolved wikilink
    expect(html).toContain(
      '<a class="wikilink" data-wikilink="Resolved" href="/notes/resolved">Alias</a>'
    );

    // Unresolved wikilink: rendered as <span> (not <a>)
    expect(html).toContain('<span class="wikilink wikilink-unresolved"');
    expect(html).toContain('data-wikilink="Missing"');
    expect(html).toContain('data-tooltip="Cette page arrive prochainement"');
    expect(html).toContain('>Missing</span>'); // Display basename in span
    expect(html).not.toContain('[[Missing]]'); // No raw wikilink syntax
  });

  it('strips .md extension from wikilink paths (fallback for malformed paths)', async () => {
    const renderer = new MarkdownItRenderer();
    const note = baseNote();
    note.content = 'See [[Ambassade]] and [[Cartulaire]].';
    note.resolvedWikilinks = [
      {
        raw: '[[Ambassade]]',
        target: 'Ambassade',
        path: 'Ambassade.md', // Malformed path with .md extension
        kind: 'note',
        isResolved: true,
        targetNoteId: 'ambassade-id',
        // No href defined - renderer must handle this
      },
      {
        raw: '[[Cartulaire]]',
        target: 'Cartulaire',
        path: 'Cartulaire.md', // Malformed path with .md extension
        kind: 'note',
        isResolved: true,
        targetNoteId: 'cartulaire-id',
        // No href defined - renderer must handle this
      },
    ];

    const html = await renderer.render(note);

    // Should strip .md and render clean links
    expect(html).toContain('<a class="wikilink" data-wikilink="Ambassade" href="Ambassade">');
    expect(html).toContain('<a class="wikilink" data-wikilink="Cartulaire" href="Cartulaire">');

    // Should NOT contain .md in href
    expect(html).not.toContain('href="Ambassade.md"');
    expect(html).not.toContain('href="Cartulaire.md"');
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

  it('preserves inline HTML in markdown content (for Dataview rendered blocks)', async () => {
    const renderer = new MarkdownItRenderer();
    const note = baseNote();

    // Simuler un bloc Dataview déjà rendu en HTML (Priority 1 approach)
    note.content = `# My Page

Some text before.

<div class="dataview dataview-container">
  <ul class="dataview-result-list-ul">
    <li>Item 1</li>
    <li>Item 2</li>
  </ul>
</div>

Some text after.`;

    const html = await renderer.render(note);

    // Le HTML inline doit être préservé tel quel
    expect(html).toContain('<div class="dataview dataview-container">');
    expect(html).toContain('<ul class="dataview-result-list-ul">');
    expect(html).toContain('<li>Item 1</li>');
    expect(html).toContain('<li>Item 2</li>');
    expect(html).toContain('</ul>');
    expect(html).toContain('</div>');

    // Le markdown autour doit aussi être rendu
    // Headings now have automatic IDs via markdown-it-anchor
    expect(html).toContain('<h1 id="my-page"');
    expect(html).toContain('>My Page</h1>');
    expect(html).toContain('Some text before.');
    expect(html).toContain('Some text after.');
  });

  it('should NOT add <p> tags inside <li> elements (Dataview lists)', async () => {
    const renderer = new MarkdownItRenderer();
    const note = baseNote();

    // Markdown list généré par Dataview
    note.content = `# Factions

- [[Conclave Saphir|Conclave Saphir]]
- [[Larmes de Miséricorde|Larmes de Miséricorde]]
- [[Ligue d'Émeraude|Ligue d'Émeraude]]
- [[Monairie|Monairie]]`;

    note.resolvedWikilinks = [
      {
        raw: '[[Conclave Saphir|Conclave Saphir]]',
        target: 'Conclave Saphir',
        path: '/factions/conclave-saphir',
        isResolved: true,
        alias: 'Conclave Saphir',
        kind: 'note',
      },
      {
        raw: '[[Larmes de Miséricorde|Larmes de Miséricorde]]',
        target: 'Larmes de Miséricorde',
        path: '/factions/larmes-de-misericorde',
        isResolved: true,
        alias: 'Larmes de Miséricorde',
        kind: 'note',
      },
      {
        raw: "[[Ligue d'Émeraude|Ligue d'Émeraude]]",
        target: "Ligue d'Émeraude",
        path: '/factions/ligue-demeraude',
        isResolved: true,
        alias: "Ligue d'Émeraude",
        kind: 'note',
      },
      {
        raw: '[[Monairie|Monairie]]',
        target: 'Monairie',
        path: '/factions/monairie',
        isResolved: true,
        alias: 'Monairie',
        kind: 'note',
      },
    ];

    const html = await renderer.render(note);

    // ✅ MUST contain <ul> and <li>
    expect(html).toContain('<ul>');
    expect(html).toContain('<li>');

    // ✅ MUST contain wikilinks as anchors
    expect(html).toContain('href="/factions/conclave-saphir"');
    expect(html).toContain('>Conclave Saphir</a>');

    // ❌ MUST NOT contain <p> inside <li> (adds unwanted padding/margin)
    expect(html).not.toMatch(/<li>\s*<p>/);
    expect(html).not.toMatch(/<\/p>\s*<\/li>/);
  });

  it('should render separate Dataview blocks as separate lists', async () => {
    const renderer = new MarkdownItRenderer();
    const note = baseNote();

    // Deux blocks Dataview distincts (séparés par ligne vide)
    note.content = `# Factions

## Block 1
- Item 1
- Item 2

## Block 2
- Item 3
- Item 4`;

    const html = await renderer.render(note);

    // Should contain two separate <ul> elements
    const ulMatches = html.match(/<ul>/g);
    expect(ulMatches).toBeTruthy();
    expect(ulMatches!.length).toBe(2);
  });
});
