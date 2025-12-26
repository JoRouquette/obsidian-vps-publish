import { type PublishableNote } from '@core-domain';

import { MarkdownItRenderer } from '../infra/markdown/markdown-it.renderer';

describe('Tag Filtering Integration', () => {
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

  it('should filter #à-faire tags from rendered HTML', async () => {
    const renderer = new MarkdownItRenderer();
    const note = baseNote();
    note.content = '# Test\n\nSome content with #à-faire tag and more text.';

    const html = await renderer.render(note, { ignoredTags: ['à-faire'] });

    expect(html).not.toContain('#à-faire');
    expect(html).toContain('Some content with');
    expect(html).toContain('tag and more text');
  });

  it('should filter #à-compléter tags from rendered HTML', async () => {
    const renderer = new MarkdownItRenderer();
    const note = baseNote();
    note.content = '# Test\n\n## Section #à-compléter\n\nContent here.';

    const html = await renderer.render(note, { ignoredTags: ['à-compléter'] });

    expect(html).not.toContain('#à-compléter');
    expect(html).toContain('Section');
    expect(html).toContain('Content here');
  });

  it('should filter #todo tags from rendered HTML', async () => {
    const renderer = new MarkdownItRenderer();
    const note = baseNote();
    note.content = 'Task list:\n- #todo First task\n- #done Second task\n- Regular task';

    const html = await renderer.render(note, { ignoredTags: ['todo', 'done'] });

    expect(html).not.toContain('#todo');
    expect(html).not.toContain('#done');
    expect(html).toContain('First task');
    expect(html).toContain('Second task');
    expect(html).toContain('Regular task');
  });

  it('should filter multiple workflow tags', async () => {
    const renderer = new MarkdownItRenderer();
    const note = baseNote();
    note.content =
      '# Project\n\n' +
      '## Tasks #wip\n\n' +
      'Some #todo items here.\n\n' +
      '## Completed #done\n\n' +
      'Finished #fait work.';

    const html = await renderer.render(note, { ignoredTags: ['wip', 'todo', 'done', 'fait'] });

    expect(html).not.toContain('#wip');
    expect(html).not.toContain('#todo');
    expect(html).not.toContain('#done');
    expect(html).not.toContain('#fait');
    expect(html).toContain('Tasks');
    expect(html).toContain('items here');
    expect(html).toContain('Completed');
    expect(html).toContain('Finished');
    expect(html).toContain('work');
  });

  it('should preserve tags in code blocks', async () => {
    const renderer = new MarkdownItRenderer();
    const note = baseNote();
    note.content = 'Example code:\n\n```\n#todo in code\n```\n\nText #todo outside.';

    const html = await renderer.render(note, { ignoredTags: ['todo'] });

    // Tag in code should be preserved
    expect(html).toContain('<code>#todo in code');
    // Tag outside code should be filtered
    const codeRegex = /<code>.*?<\/code>/gs;
    const textOutsideCode = html.replace(codeRegex, '');
    expect(textOutsideCode).not.toContain('#todo outside');
  });
});
