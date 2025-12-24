import type { PublishableNote } from '@core-domain/entities/publishable-note';

import { RemoveNoPublishingMarkerService } from '../../vault-parsing/services/remove-no-publishing-marker.service';

describe('RemoveNoPublishingMarkerService', () => {
  let service: RemoveNoPublishingMarkerService;

  beforeEach(() => {
    service = new RemoveNoPublishingMarkerService();
  });

  it('should remove section with header and marker', () => {
    const content = `# Public Header
Some public content

## Private Section
This is private
^no-publishing

## Another Public
More public content`;

    const result = service.process([createNote(content)]);

    expect(result[0].content).not.toContain('Private Section');
    expect(result[0].content).not.toContain('This is private');
    expect(result[0].content).not.toContain('^no-publishing');
    expect(result[0].content).toContain('Public Header');
    expect(result[0].content).toContain('Another Public');
  });

  it('should remove from start of document if no header precedes marker', () => {
    const content = `Some preamble text
without any header
^no-publishing

## First Real Header
This should remain`;

    const result = service.process([createNote(content)]);

    expect(result[0].content).not.toContain('preamble');
    expect(result[0].content).not.toContain('^no-publishing');
    expect(result[0].content).toContain('First Real Header');
    expect(result[0].content).toContain('This should remain');
  });

  it('should handle multiple markers in same document', () => {
    const content = `## Keep This
Public content

## Remove This One
Private 1
^no-publishing

## Keep This Too
More public

### Remove This Subsection
Private 2
^no-publishing

## Final Public
End`;

    const result = service.process([createNote(content)]);

    expect(result[0].content).toContain('Keep This');
    expect(result[0].content).toContain('Keep This Too');
    expect(result[0].content).toContain('Final Public');
    expect(result[0].content).not.toContain('Remove This One');
    expect(result[0].content).not.toContain('Remove This Subsection');
    expect(result[0].content).not.toContain('Private 1');
    expect(result[0].content).not.toContain('Private 2');
  });

  it('should handle marker with surrounding whitespace', () => {
    const content = `## Header
Content
  ^no-publishing  

## Next`;

    const result = service.process([createNote(content)]);

    expect(result[0].content).not.toContain('Header');
    expect(result[0].content).toContain('Next');
  });

  it('should handle case-insensitive marker', () => {
    const content = `## Test
Content
^NO-PUBLISHING

## After`;

    const result = service.process([createNote(content)]);

    expect(result[0].content).not.toContain('Test');
    expect(result[0].content).toContain('After');
  });

  it('should find closest preceding header', () => {
    const content = `# Level 1
Content 1

## Level 2
Content 2

### Level 3
Private content
^no-publishing

## After`;

    const result = service.process([createNote(content)]);

    // Only Level 3 section should be removed
    expect(result[0].content).toContain('Level 1');
    expect(result[0].content).toContain('Level 2');
    expect(result[0].content).not.toContain('Level 3');
    expect(result[0].content).not.toContain('Private content');
    expect(result[0].content).toContain('After');
  });

  it('should not modify content without markers', () => {
    const content = `## Header
Some content
More content

## Another Header`;

    const result = service.process([createNote(content)]);

    expect(result[0].content).toBe(content);
  });

  it('should clean up excessive blank lines', () => {
    const content = `## Keep
Content


## Remove
Private
^no-publishing


## Keep2
More`;

    const result = service.process([createNote(content)]);

    // Should not have 3+ consecutive newlines
    expect(result[0].content).not.toMatch(/\n{3,}/);
  });

  it('should handle marker at very start of document', () => {
    const content = `^no-publishing

## First Header
Content`;

    const result = service.process([createNote(content)]);

    expect(result[0].content).not.toContain('^no-publishing');
    expect(result[0].content).toContain('First Header');
  });

  it('should handle marker at end of document', () => {
    const content = `## Last Section
This is the end
^no-publishing`;

    const result = service.process([createNote(content)]);

    expect(result[0].content).toBe('');
  });

  it('should preserve headers with different levels', () => {
    const content = `# H1
## H2
### H3
#### H4
##### H5
###### H6

## Remove
^no-publishing

# After`;

    const result = service.process([createNote(content)]);

    expect(result[0].content).toContain('# H1');
    expect(result[0].content).toContain('## H2');
    expect(result[0].content).toContain('### H3');
    expect(result[0].content).not.toContain('Remove');
    expect(result[0].content).toContain('# After');
  });

  it('should use horizontal rule as delimiter when present (priority over header)', () => {
    const content = `## Public Header
This should be kept.

---

This should be removed.
More private content.
^no-publishing

## Next Section`;

    const result = service.process([createNote(content)]);

    expect(result[0].content).toContain('## Public Header');
    expect(result[0].content).toContain('This should be kept.');
    expect(result[0].content).not.toContain('This should be removed.');
    expect(result[0].content).not.toContain('More private content.');
    expect(result[0].content).not.toContain('---');
    expect(result[0].content).toContain('## Next Section');
  });

  it('should handle horizontal rule with asterisks', () => {
    const content = `## Header

***

Private content
^no-publishing`;

    const result = service.process([createNote(content)]);

    expect(result[0].content).toContain('## Header');
    expect(result[0].content).not.toContain('***');
    expect(result[0].content).not.toContain('Private content');
  });

  it('should handle horizontal rule with underscores', () => {
    const content = `## Header

___

Private content
^no-publishing`;

    const result = service.process([createNote(content)]);

    expect(result[0].content).toContain('## Header');
    expect(result[0].content).not.toContain('___');
    expect(result[0].content).not.toContain('Private content');
  });

  it('should use header when no horizontal rule present', () => {
    const content = `## Public Header
Public content.

## Private Header
This should be removed.
^no-publishing`;

    const result = service.process([createNote(content)]);

    expect(result[0].content).toContain('## Public Header');
    expect(result[0].content).toContain('Public content.');
    expect(result[0].content).not.toContain('## Private Header');
    expect(result[0].content).not.toContain('This should be removed.');
  });

  it('should handle horizontal rule with spaces', () => {
    const content = `## Header

- - -

Private content
^no-publishing`;

    const result = service.process([createNote(content)]);

    expect(result[0].content).toContain('## Header');
    expect(result[0].content).not.toContain('- - -');
    expect(result[0].content).not.toContain('Private content');
  });

  it('should handle multiple horizontal rules and use the closest one', () => {
    const content = `## Header

---

Keep this section.

---

Remove this section.
^no-publishing`;

    const result = service.process([createNote(content)]);

    expect(result[0].content).toContain('## Header');
    expect(result[0].content).toContain('Keep this section.');
    expect(result[0].content).not.toContain('Remove this section.');
  });

  // Helper to create a minimal PublishableNote
  function createNote(content: string): PublishableNote {
    return {
      noteId: 'test-note',
      vaultPath: 'test.md',
      relativePath: 'test.md',
      content,
      frontmatter: {
        flat: {},
        nested: {},
        tags: [],
      },
      title: 'Test Note',
      routing: {
        slug: 'test-note',
        path: '',
        routeBase: '',
        fullPath: '/test-note',
      },
      folderConfig: {
        id: 'test-folder-id',
        vpsId: 'test-vps-id',
        vaultFolder: '',
        routeBase: '',
        ignoredCleanupRuleIds: [],
      },
      eligibility: {
        isPublishable: true,
      },
      publishedAt: new Date(),
    };
  }
});
