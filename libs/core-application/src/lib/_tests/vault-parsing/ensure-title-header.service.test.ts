import { type LoggerPort, LogLevel, type PublishableNote } from '@core-domain';

import { EnsureTitleHeaderService } from '../../vault-parsing/services/ensure-title-header.service';

class NoopLogger implements LoggerPort {
  private _level: LogLevel = LogLevel.debug;

  set level(level: LogLevel) {
    this._level = level;
  }

  get level(): LogLevel {
    return this._level;
  }

  child(): LoggerPort {
    return this;
  }

  debug(): void {}
  warn(): void {}
  error(): void {}
}

describe('EnsureTitleHeaderService', () => {
  let service: EnsureTitleHeaderService;
  let logger: LoggerPort;

  beforeEach(() => {
    logger = new NoopLogger();
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

  describe('when note has no headers', () => {
    it('should insert H1 header with title', () => {
      const note = createNote('My Title', 'Some content here.');
      const [result] = service.process([note]);

      expect(result.content).toBe('# My Title\n\nSome content here.');
    });

    it('should preserve empty content', () => {
      const note = createNote('Empty Note', '');
      const [result] = service.process([note]);

      expect(result.content).toBe('# Empty Note\n');
    });
  });

  describe('when note contains only H2 headers', () => {
    it('should insert H1 header above existing H2', () => {
      const note = createNote('Main Title', '## Section 1\nContent 1\n## Section 2\nContent 2');
      const [result] = service.process([note]);

      expect(result.content).toContain('# Main Title\n\n## Section 1');
    });
  });

  describe('when note contains only H3 headers', () => {
    it('should insert H2 header', () => {
      const note = createNote('Document', '### Subsection A\nText\n### Subsection B\nMore text');
      const [result] = service.process([note]);

      expect(result.content).toContain('## Document\n\n### Subsection A');
    });
  });

  describe('when note contains H1 headers', () => {
    it('should still insert H1 if no matching title header exists', () => {
      const note = createNote('My Title', '# Different Header\n\nSome content.');
      const [result] = service.process([note]);

      expect(result.content).toContain('# My Title\n\n# Different Header');
    });
  });

  describe('when title header already exists', () => {
    it('should not insert duplicate header (exact match)', () => {
      const note = createNote('My Title', '# My Title\n\nContent here.');
      const [result] = service.process([note]);

      expect(result.content).toBe('# My Title\n\nContent here.');
    });

    it('should detect header with different case', () => {
      const note = createNote('My Title', '# my title\n\nContent.');
      const [result] = service.process([note]);

      expect(result.content).toBe('# my title\n\nContent.');
    });

    it('should detect header with inline markdown (bold)', () => {
      const note = createNote('My Title', '# **My Title**\n\nContent.');
      const [result] = service.process([note]);

      expect(result.content).toBe('# **My Title**\n\nContent.');
    });

    it('should detect header with inline markdown (italic)', () => {
      const note = createNote('My Title', '# *My Title*\n\nContent.');
      const [result] = service.process([note]);

      expect(result.content).toBe('# *My Title*\n\nContent.');
    });

    it('should detect header with extra whitespace', () => {
      const note = createNote('My Title', '#   My Title  \n\nContent.');
      const [result] = service.process([note]);

      expect(result.content).toBe('#   My Title  \n\nContent.');
    });

    it('should detect title as H2 when it already exists', () => {
      const note = createNote('Section Title', '## Section Title\n\nText content.');
      const [result] = service.process([note]);

      expect(result.content).toBe('## Section Title\n\nText content.');
    });
  });

  describe('when note has no determinable title', () => {
    it('should not insert header if title is empty string', () => {
      const note = createNote('', 'Content without a title.');
      const [result] = service.process([note]);

      expect(result.content).toBe('Content without a title.');
    });

    it('should not insert header if title is whitespace only', () => {
      const note = createNote('   ', 'Content.');
      const [result] = service.process([note]);

      expect(result.content).toBe('Content.');
    });
  });

  describe('header level calculation edge cases', () => {
    it('should insert H1 when lowest existing header is H4', () => {
      const note = createNote('Title', '#### Deep Section\nContent.');
      const [result] = service.process([note]);

      expect(result.content).toContain('### Title\n\n#### Deep Section');
    });

    it('should insert H1 when lowest existing header is H5', () => {
      const note = createNote('Title', '##### Very Deep\nContent.');
      const [result] = service.process([note]);

      expect(result.content).toContain('#### Title\n\n##### Very Deep');
    });

    it('should insert H1 when lowest existing header is H6', () => {
      const note = createNote('Title', '###### Deepest\nContent.');
      const [result] = service.process([note]);

      expect(result.content).toContain('##### Title\n\n###### Deepest');
    });
  });

  describe('multiple notes processing', () => {
    it('should process each note independently', () => {
      const notes = [
        createNote('First', 'Content 1'),
        createNote('Second', '## Section\nContent 2'),
        createNote('Third', '# Third\nContent 3'),
      ];

      const results = service.process(notes);

      expect(results[0].content).toContain('# First');
      expect(results[1].content).toContain('# Second');
      expect(results[2].content).toBe('# Third\nContent 3'); // Already has title
    });
  });

  describe('content formatting preservation', () => {
    it('should preserve line breaks and spacing in content', () => {
      const note = createNote('Title', 'Line 1\n\nLine 2\n\n\nLine 3');
      const [result] = service.process([note]);

      expect(result.content).toBe('# Title\n\nLine 1\n\nLine 2\n\n\nLine 3');
    });

    it('should handle content with code blocks', () => {
      const note = createNote('Code Example', '```typescript\nconst x = 1;\n```');
      const [result] = service.process([note]);

      expect(result.content).toBe('# Code Example\n\n```typescript\nconst x = 1;\n```');
    });

    it('should handle content with lists', () => {
      const note = createNote('List', '- Item 1\n- Item 2\n  - Nested');
      const [result] = service.process([note]);

      expect(result.content).toBe('# List\n\n- Item 1\n- Item 2\n  - Nested');
    });
  });
});
