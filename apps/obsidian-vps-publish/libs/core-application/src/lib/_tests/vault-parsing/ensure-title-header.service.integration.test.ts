import { type LoggerPort, LogLevel, type PublishableNote } from '@core-domain';

import { EnsureTitleHeaderService } from '../../vault-parsing/services/ensure-title-header.service';

describe('EnsureTitleHeaderService - Integration', () => {
  let service: EnsureTitleHeaderService;

  beforeEach(() => {
    const logger: LoggerPort = {
      level: LogLevel.debug,
      child: () => logger,
      info: jest.fn(),
      debug: jest.fn(),
      warn: jest.fn(),
      error: jest.fn(),
    };
    service = new EnsureTitleHeaderService(logger);
  });

  const createNote = (title: string, content: string): PublishableNote =>
    ({
      noteId: 'test-note-id',
      title,
      vaultPath: 'vault/test.md',
      relativePath: 'test.md',
      content,
      frontmatter: { flat: {}, nested: {}, tags: [] },
      folderConfig: {
        id: 'folder-id',
        vaultFolder: 'vault',
        routeBase: '/blog',
        vpsId: 'vps-id',
        ignoredCleanupRuleIds: [],
      },
      routing: { slug: 'test', path: '', routeBase: '/blog', fullPath: '/blog/test' },
      publishedAt: new Date(),
      eligibility: { isPublishable: true },
    }) as PublishableNote;

  it('should handle real-world note content with complex markdown', () => {
    const content = `
## Introduction

This is a paragraph with **bold** and *italic* text.

### Subsection

- List item 1
- List item 2
  - Nested item

\`\`\`typescript
const code = 'example';
\`\`\`

> A blockquote

## Conclusion

Final thoughts.
`.trim();

    const note = createNote('Complex Note', content);
    const [result] = service.process([note]);

    expect(result.content).toContain('# Complex Note');
    expect(result.content).toContain('## Introduction');
    expect(result.content).toContain('### Subsection');
    expect(result.content).toContain('## Conclusion');
    expect(result.content).toContain('**bold**');
    expect(result.content).toContain('```typescript');
  });

  it('should handle note that mimics frontmatter stripping scenario', () => {
    // Simuler une note après stripFrontmatter()
    const contentAfterStripping = `
Content starts here after frontmatter removal.

## Section 1

Text content.
`.trim();

    const note = createNote('Post-Frontmatter Note', contentAfterStripping);
    const [result] = service.process([note]);

    expect(result.content.startsWith('# Post-Frontmatter Note\n\nContent starts here')).toBe(true);
    expect(result.content).toContain('## Section 1');
  });

  it('should handle notes with wikilinks and assets placeholders', () => {
    const content = `
[[Another Note]] is referenced here.

![[image.png]]

Some text between.

### Details

More [[Wikilinks]] and ![[another-image.jpg]].
`.trim();

    const note = createNote('Note with Links', content);
    const [result] = service.process([note]);

    expect(result.content).toContain('# Note with Links');
    expect(result.content).toContain('[[Another Note]]');
    expect(result.content).toContain('![[image.png]]');
    expect(result.content).toContain('### Details');
  });

  it('should handle notes with inline dataview syntax (already processed)', () => {
    const content = `
This property is: Rendered Value

## Section

Content here.
`.trim();

    const note = createNote('Dataview Note', content);
    const [result] = service.process([note]);

    expect(result.content).toContain('# Dataview Note');
    expect(result.content).toContain('This property is: Rendered Value');
  });

  it('should not break when title contains special characters', () => {
    const note = createNote('Title: Special & "Quoted" <Tag>', 'Content here.');
    const [result] = service.process([note]);

    expect(result.content).toContain('# Title: Special & "Quoted" <Tag>');
    expect(result.content).toContain('Content here.');
  });

  it('should handle title with markdown syntax in it', () => {
    const note = createNote('**Bold Title** with *Italic*', '## Section\n\nContent.');
    const [result] = service.process([note]);

    // Le titre markdown est inséré tel quel
    expect(result.content).toContain('# **Bold Title** with *Italic*');
    expect(result.content).toContain('## Section');
  });

  it('should detect title header even when it has extra markdown formatting', () => {
    const note = createNote('My Title', '# **My Title**\n\nContent.');
    const [result] = service.process([note]);

    // Ne doit pas dupliquer le header car "My Title" existe déjà (normalisé)
    expect(result.content).toBe('# **My Title**\n\nContent.');
  });

  it('should handle very long content with many headers', () => {
    let content = '';
    for (let i = 1; i <= 20; i++) {
      content += `## Section ${i}\n\nSome content for section ${i}.\n\n`;
    }

    const note = createNote('Long Document', content.trim());
    const [result] = service.process([note]);

    expect(result.content).toContain('# Long Document');
    expect(result.content).toContain('## Section 1');
    expect(result.content).toContain('## Section 20');
  });

  it('should preserve exact content structure after header insertion', () => {
    const originalContent = 'First line\n\nSecond paragraph\n\n## Header\n\nThird paragraph';
    const note = createNote('Structure Test', originalContent);
    const [result] = service.process([note]);

    const expected = `# Structure Test\n\n${originalContent}`;
    expect(result.content).toBe(expected);
  });
});
