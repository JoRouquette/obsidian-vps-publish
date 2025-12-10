import type { PublishableNote } from '@core-domain';

import { MarkdownItRenderer } from '../infra/markdown/markdown-it.renderer';

describe('MarkdownItRenderer - Table Wrapper Integration', () => {
  const createNote = (content: string): PublishableNote => ({
    noteId: 'test-note',
    title: 'Test Note',
    vaultPath: 'vault/test.md',
    relativePath: 'test.md',
    content,
    frontmatter: { flat: {}, nested: {}, tags: [] },
    folderConfig: {
      id: 'folder',
      vaultFolder: 'notes',
      routeBase: '/notes',
      vpsId: 'vps',
      ignoredCleanupRuleIds: [],
    },
    routing: { slug: 'test', path: '', routeBase: '/notes', fullPath: '/notes/test' },
    publishedAt: new Date(),
    eligibility: { isPublishable: true },
  });

  it('should wrap a simple markdown table with .table-wrapper', async () => {
    const renderer = new MarkdownItRenderer();
    const markdown = `
# Test Table

| Column A | Column B | Column C |
| -------- | -------- | -------- |
| Value 1  | Value 2  | Value 3  |
| Value 4  | Value 5  | Value 6  |

End of content.
`.trim();

    const note = createNote(markdown);
    const html = await renderer.render(note);

    // Vérifier la structure du wrapper
    expect(html).toMatch(/<div class="table-wrapper">\s*<table>/);
    expect(html).toMatch(/<\/table>\s*<\/div>/);

    // Vérifier que le contenu de la table est bien présent
    expect(html).toContain('<th>Column A</th>');
    expect(html).toContain('<td>Value 1</td>');
  });

  it('should wrap multiple tables independently', async () => {
    const renderer = new MarkdownItRenderer();
    const markdown = `
# First Table

| A | B |
| - | - |
| 1 | 2 |

Some text between tables.

# Second Table

| X | Y | Z |
| - | - | - |
| 7 | 8 | 9 |
`.trim();

    const note = createNote(markdown);
    const html = await renderer.render(note);

    // Compter le nombre de wrappers et de tables
    const wrapperCount = (html.match(/<div class="table-wrapper">/g) || []).length;
    const tableCount = (html.match(/<table>/g) || []).length;

    expect(wrapperCount).toBe(2);
    expect(tableCount).toBe(2);

    // Vérifier que chaque table est dans son propre wrapper
    expect(html).toContain('<th>A</th>');
    expect(html).toContain('<th>X</th>');
  });

  it('should handle tables with complex content', async () => {
    const renderer = new MarkdownItRenderer();
    const markdown = `
| Name | Description | Status |
| ---- | ----------- | ------ |
| **Feature A** | This is a _description_ | ✅ Done |
| **Feature B** | Another description with \`code\` | 🚧 In Progress |
`.trim();

    const note = createNote(markdown);
    const html = await renderer.render(note);

    expect(html).toContain('<div class="table-wrapper">');
    expect(html).toContain('<strong>Feature A</strong>');
    expect(html).toContain('<em>description</em>');
    expect(html).toContain('<code>code</code>');
  });

  it('should work with tables that have alignment', async () => {
    const renderer = new MarkdownItRenderer();
    const markdown = `
| Left | Center | Right |
| :--- | :----: | ----: |
| L1   |   C1   |    R1 |
| L2   |   C2   |    R2 |
`.trim();

    const note = createNote(markdown);
    const html = await renderer.render(note);

    expect(html).toContain('<div class="table-wrapper">');
    expect(html).toContain('<table>');
    expect(html).toContain('<th style="text-align:left">Left</th>');
    expect(html).toContain('<th style="text-align:center">Center</th>');
    expect(html).toContain('<th style="text-align:right">Right</th>');
  });
});
