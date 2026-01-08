/**
 * AUDIT: ^no-publishing marker behavior
 *
 * This test suite audits the complete behavior of ^no-publishing marker
 * in various edge cases and positions to identify issues before fixing them.
 *
 * Test categories:
 * 1. Marker at START of document
 * 2. Marker in MIDDLE of document
 * 3. Marker at END of document
 * 4. With horizontal rules (---, ***, ___)
 * 5. Without horizontal rules (fallback to headers)
 * 6. Edge cases (multiple markers, nested headers, etc.)
 */

import type { PublishableNote } from '@core-domain/entities/publishable-note';

import { RemoveNoPublishingMarkerService } from '../../vault-parsing/services/remove-no-publishing-marker.service';

describe('AUDIT: ^no-publishing marker behavior', () => {
  let service: RemoveNoPublishingMarkerService;

  beforeEach(() => {
    service = new RemoveNoPublishingMarkerService();
  });

  describe('Position: START of document', () => {
    it('should handle marker as first line (no content before)', () => {
      const content = `^no-publishing

## First Header
This should remain`;

      const result = service.process([createNote(content)]);

      console.log('=== AUDIT: Marker at very start ===');
      console.log('INPUT:', JSON.stringify(content));
      console.log('OUTPUT:', JSON.stringify(result[0].content));

      // Expected: marker removed, rest remains
      expect(result[0].content).not.toContain('^no-publishing');
      expect(result[0].content).toContain('## First Header');
      expect(result[0].content).toContain('This should remain');
    });

    it('should handle marker with preamble text (no header)', () => {
      const content = `This is preamble text
without any headers
^no-publishing

## First Header
This should remain`;

      const result = service.process([createNote(content)]);

      console.log('=== AUDIT: Marker with preamble (no header) ===');
      console.log('INPUT:', JSON.stringify(content));
      console.log('OUTPUT:', JSON.stringify(result[0].content));

      // Expected: everything before marker removed (preamble + marker)
      expect(result[0].content).not.toContain('preamble');
      expect(result[0].content).not.toContain('^no-publishing');
      expect(result[0].content).toContain('## First Header');
      expect(result[0].content).toContain('This should remain');
    });

    it('should handle marker after frontmatter-like text at start', () => {
      const content = `Some metadata or intro
More intro text
^no-publishing

# Real Content Starts Here
Content`;

      const result = service.process([createNote(content)]);

      console.log('=== AUDIT: Marker after intro text ===');
      console.log('INPUT:', JSON.stringify(content));
      console.log('OUTPUT:', JSON.stringify(result[0].content));

      // Expected: intro + marker removed
      expect(result[0].content).not.toContain('metadata');
      expect(result[0].content).not.toContain('intro');
      expect(result[0].content).not.toContain('^no-publishing');
      expect(result[0].content).toContain('# Real Content Starts Here');
    });

    it('should handle marker with horizontal rule at start', () => {
      const content = `---

Private content at start
^no-publishing

## Public Section
Public content`;

      const result = service.process([createNote(content)]);

      console.log('=== AUDIT: Marker with HR at document start ===');
      console.log('INPUT:', JSON.stringify(content));
      console.log('OUTPUT:', JSON.stringify(result[0].content));

      // Expected: HR + private content + marker removed
      expect(result[0].content).not.toContain('Private content at start');
      expect(result[0].content).not.toContain('^no-publishing');
      expect(result[0].content).toContain('## Public Section');
      expect(result[0].content).toContain('Public content');
    });

    it('should handle marker immediately after single header at start', () => {
      const content = `## Private Header
^no-publishing

## Public Header
Public content`;

      const result = service.process([createNote(content)]);

      console.log('=== AUDIT: Marker right after header at start ===');
      console.log('INPUT:', JSON.stringify(content));
      console.log('OUTPUT:', JSON.stringify(result[0].content));

      // Expected: Private header + marker removed
      expect(result[0].content).not.toContain('Private Header');
      expect(result[0].content).not.toContain('^no-publishing');
      expect(result[0].content).toContain('## Public Header');
      expect(result[0].content).toContain('Public content');
    });

    it('should handle marker after header with some content at start', () => {
      const content = `## Private Section
This is private intro text
Some more private text
^no-publishing

## Public Section
This should remain`;

      const result = service.process([createNote(content)]);

      console.log('=== AUDIT: Marker after header + content at start ===');
      console.log('INPUT:', JSON.stringify(content));
      console.log('OUTPUT:', JSON.stringify(result[0].content));

      // Expected: Private header + content + marker removed
      expect(result[0].content).not.toContain('Private Section');
      expect(result[0].content).not.toContain('private intro');
      expect(result[0].content).not.toContain('^no-publishing');
      expect(result[0].content).toContain('## Public Section');
      expect(result[0].content).toContain('This should remain');
    });
  });

  describe('Position: MIDDLE of document', () => {
    it('should handle marker in middle with header delimiter', () => {
      const content = `## Public Header 1
Public content 1

## Private Header
Private content
^no-publishing

## Public Header 2
Public content 2`;

      const result = service.process([createNote(content)]);

      console.log('=== AUDIT: Marker in middle with header ===');
      console.log('INPUT:', JSON.stringify(content));
      console.log('OUTPUT:', JSON.stringify(result[0].content));

      // Expected: Private section removed, public sections kept
      expect(result[0].content).toContain('Public Header 1');
      expect(result[0].content).toContain('Public content 1');
      expect(result[0].content).not.toContain('Private Header');
      expect(result[0].content).not.toContain('Private content');
      expect(result[0].content).not.toContain('^no-publishing');
      expect(result[0].content).toContain('Public Header 2');
      expect(result[0].content).toContain('Public content 2');
    });

    it('should handle marker in middle with horizontal rule delimiter', () => {
      const content = `## Public Header
Public content

---

Private content
^no-publishing

## Next Public Header
More public content`;

      const result = service.process([createNote(content)]);

      console.log('=== AUDIT: Marker in middle with HR ===');
      console.log('INPUT:', JSON.stringify(content));
      console.log('OUTPUT:', JSON.stringify(result[0].content));

      // Expected: Public header kept, HR + private content removed
      expect(result[0].content).toContain('## Public Header');
      expect(result[0].content).toContain('Public content');
      expect(result[0].content).not.toContain('---');
      expect(result[0].content).not.toContain('Private content');
      expect(result[0].content).not.toContain('^no-publishing');
      expect(result[0].content).toContain('## Next Public Header');
    });

    it('should handle marker with nested headers in middle', () => {
      const content = `# Level 1
Content 1

## Level 2
Content 2

### Level 3 - Private
Private content
^no-publishing

## Level 2 Again
Public content`;

      const result = service.process([createNote(content)]);

      console.log('=== AUDIT: Marker with nested headers ===');
      console.log('INPUT:', JSON.stringify(content));
      console.log('OUTPUT:', JSON.stringify(result[0].content));

      // Expected: Only Level 3 section removed
      expect(result[0].content).toContain('# Level 1');
      expect(result[0].content).toContain('## Level 2');
      expect(result[0].content).toContain('Content 2');
      expect(result[0].content).not.toContain('Level 3 - Private');
      expect(result[0].content).not.toContain('Private content');
      expect(result[0].content).not.toContain('^no-publishing');
      expect(result[0].content).toContain('## Level 2 Again');
    });

    it('should handle marker between two horizontal rules', () => {
      const content = `## Header

---

Keep this section

---

Remove this section
^no-publishing

## After`;

      const result = service.process([createNote(content)]);

      console.log('=== AUDIT: Marker between two HRs ===');
      console.log('INPUT:', JSON.stringify(content));
      console.log('OUTPUT:', JSON.stringify(result[0].content));

      // Expected: Use closest HR (second one), remove content between second HR and marker
      expect(result[0].content).toContain('## Header');
      expect(result[0].content).toContain('Keep this section');
      expect(result[0].content).not.toContain('Remove this section');
      expect(result[0].content).not.toContain('^no-publishing');
      expect(result[0].content).toContain('## After');
    });

    it('should handle multiple markers in middle', () => {
      const content = `## Public 1
Content 1

## Private 1
Private
^no-publishing

## Public 2
Content 2

## Private 2
More private
^no-publishing

## Public 3
Content 3`;

      const result = service.process([createNote(content)]);

      console.log('=== AUDIT: Multiple markers in middle ===');
      console.log('INPUT:', JSON.stringify(content));
      console.log('OUTPUT:', JSON.stringify(result[0].content));

      // Expected: Both private sections removed, all public kept
      expect(result[0].content).toContain('Public 1');
      expect(result[0].content).not.toContain('Private 1');
      expect(result[0].content).toContain('Public 2');
      expect(result[0].content).not.toContain('Private 2');
      expect(result[0].content).toContain('Public 3');
      expect(result[0].content).not.toContain('^no-publishing');
    });
  });

  describe('Position: END of document', () => {
    it('should handle marker at absolute end (last line)', () => {
      const content = `## Public Header
Public content

## Private Header
Private content
^no-publishing`;

      const result = service.process([createNote(content)]);

      console.log('=== AUDIT: Marker at absolute end ===');
      console.log('INPUT:', JSON.stringify(content));
      console.log('OUTPUT:', JSON.stringify(result[0].content));

      // Expected: Public section kept, private section + marker removed
      expect(result[0].content).toContain('## Public Header');
      expect(result[0].content).toContain('Public content');
      expect(result[0].content).not.toContain('Private Header');
      expect(result[0].content).not.toContain('Private content');
      expect(result[0].content).not.toContain('^no-publishing');
    });

    it('should handle marker at end with horizontal rule', () => {
      const content = `## Public Header
Public content

---

Private content at end
^no-publishing`;

      const result = service.process([createNote(content)]);

      console.log('=== AUDIT: Marker at end with HR ===');
      console.log('INPUT:', JSON.stringify(content));
      console.log('OUTPUT:', JSON.stringify(result[0].content));

      // Expected: Public header kept, HR + private content + marker removed
      expect(result[0].content).toContain('## Public Header');
      expect(result[0].content).toContain('Public content');
      expect(result[0].content).not.toContain('---');
      expect(result[0].content).not.toContain('Private content at end');
      expect(result[0].content).not.toContain('^no-publishing');
    });

    it('should handle marker at end with blank lines before', () => {
      const content = `## Public Header
Public content


## Private Header


Private content
^no-publishing`;

      const result = service.process([createNote(content)]);

      console.log('=== AUDIT: Marker at end with blank lines ===');
      console.log('INPUT:', JSON.stringify(content));
      console.log('OUTPUT:', JSON.stringify(result[0].content));

      // Expected: Public section kept, private section removed
      expect(result[0].content).toContain('## Public Header');
      expect(result[0].content).toContain('Public content');
      expect(result[0].content).not.toContain('Private Header');
      expect(result[0].content).not.toContain('Private content');
      expect(result[0].content).not.toContain('^no-publishing');
    });

    it('should handle entire document marked for no-publishing', () => {
      const content = `## Only Header
Only content
^no-publishing`;

      const result = service.process([createNote(content)]);

      console.log('=== AUDIT: Entire document marked ===');
      console.log('INPUT:', JSON.stringify(content));
      console.log('OUTPUT:', JSON.stringify(result[0].content));

      // Expected: Entire document removed (empty or minimal whitespace)
      expect(result[0].content.trim()).toBe('');
    });
  });

  describe('Edge Cases: Horizontal Rules', () => {
    it('should recognize all HR variants: --- (dashes)', () => {
      const content = `## Header
---
Private
^no-publishing`;

      const result = service.process([createNote(content)]);

      console.log('=== AUDIT: HR with dashes ===');
      console.log('OUTPUT:', JSON.stringify(result[0].content));

      expect(result[0].content).toContain('## Header');
      expect(result[0].content).not.toContain('---');
      expect(result[0].content).not.toContain('Private');
    });

    it('should recognize all HR variants: *** (asterisks)', () => {
      const content = `## Header
***
Private
^no-publishing`;

      const result = service.process([createNote(content)]);

      console.log('=== AUDIT: HR with asterisks ===');
      console.log('OUTPUT:', JSON.stringify(result[0].content));

      expect(result[0].content).toContain('## Header');
      expect(result[0].content).not.toContain('***');
      expect(result[0].content).not.toContain('Private');
    });

    it('should recognize all HR variants: ___ (underscores)', () => {
      const content = `## Header
___
Private
^no-publishing`;

      const result = service.process([createNote(content)]);

      console.log('=== AUDIT: HR with underscores ===');
      console.log('OUTPUT:', JSON.stringify(result[0].content));

      expect(result[0].content).toContain('## Header');
      expect(result[0].content).not.toContain('___');
      expect(result[0].content).not.toContain('Private');
    });

    it('should recognize HR with spaces: - - -', () => {
      const content = `## Header
- - -
Private
^no-publishing`;

      const result = service.process([createNote(content)]);

      console.log('=== AUDIT: HR with spaces ===');
      console.log('OUTPUT:', JSON.stringify(result[0].content));

      expect(result[0].content).toContain('## Header');
      expect(result[0].content).not.toContain('- - -');
      expect(result[0].content).not.toContain('Private');
    });

    it('should prefer HR over header (priority test)', () => {
      const content = `## Public Header
Public content

---

## Private Header (should be kept if HR has priority)
Private content
^no-publishing

## After`;

      const result = service.process([createNote(content)]);

      console.log('=== AUDIT: HR priority over header ===');
      console.log('INPUT:', JSON.stringify(content));
      console.log('OUTPUT:', JSON.stringify(result[0].content));

      // Expected: HR has priority, so "Private Header" text is kept, but content after HR is removed
      expect(result[0].content).toContain('## Public Header');
      expect(result[0].content).toContain('Public content');
      // If HR has priority, everything from HR to marker is removed
      // including the "Private Header" that comes after the HR
      expect(result[0].content).not.toContain('---');
      expect(result[0].content).not.toContain('Private content');
      expect(result[0].content).toContain('## After');
    });
  });

  describe('Edge Cases: Special Scenarios', () => {
    it('should handle marker with inline comments or text on same line', () => {
      const content = `## Header
Private content
^no-publishing some text after

## After`;

      const result = service.process([createNote(content)]);

      console.log('=== AUDIT: Marker with text after ===');
      console.log('OUTPUT:', JSON.stringify(result[0].content));

      // Marker pattern should match with trailing whitespace only
      // "^no-publishing some text" should NOT match
      expect(result[0].content).toContain('## Header');
      expect(result[0].content).toContain('^no-publishing some text after');
    });

    it('should handle case variations: ^NO-PUBLISHING, ^No-Publishing', () => {
      const content = `## Header1
Content1
^NO-PUBLISHING

## Header2
Content2
^No-Publishing

## Header3
Content3`;

      const result = service.process([createNote(content)]);

      console.log('=== AUDIT: Case variations ===');
      console.log('OUTPUT:', JSON.stringify(result[0].content));

      // All case variations should be removed
      expect(result[0].content).not.toContain('Header1');
      expect(result[0].content).not.toContain('Header2');
      expect(result[0].content).toContain('Header3');
    });

    it('should handle marker with unusual indentation', () => {
      const content = `## Header
Content
    ^no-publishing

## After`;

      const result = service.process([createNote(content)]);

      console.log('=== AUDIT: Indented marker ===');
      console.log('OUTPUT:', JSON.stringify(result[0].content));

      // Pattern should match with leading whitespace
      expect(result[0].content).not.toContain('Header');
      expect(result[0].content).toContain('After');
    });

    it('should preserve content structure (lists, code blocks) around removal', () => {
      const content = `## Public Section
- Item 1
- Item 2

\`\`\`javascript
public code
\`\`\`

## Private Section
- Private item
^no-publishing

## After Section
More content`;

      const result = service.process([createNote(content)]);

      console.log('=== AUDIT: Content structure preservation ===');
      console.log('OUTPUT:', JSON.stringify(result[0].content));

      expect(result[0].content).toContain('- Item 1');
      expect(result[0].content).toContain('```javascript');
      expect(result[0].content).not.toContain('Private Section');
      expect(result[0].content).toContain('After Section');
    });

    it('should handle document with only marker (no other content)', () => {
      const content = `^no-publishing`;

      const result = service.process([createNote(content)]);

      console.log('=== AUDIT: Only marker in document ===');
      console.log('OUTPUT:', JSON.stringify(result[0].content));

      // Expected: Empty document
      expect(result[0].content.trim()).toBe('');
    });

    it('should handle marker with CRLF line endings', () => {
      const content = `## Header\r\nContent\r\n^no-publishing\r\n\r\n## After`;

      const result = service.process([createNote(content)]);

      console.log('=== AUDIT: CRLF line endings ===');
      console.log('OUTPUT:', JSON.stringify(result[0].content));

      expect(result[0].content).not.toContain('Header');
      expect(result[0].content).toContain('After');
    });
  });

  // Helper to create a minimal PublishableNote
  function createNote(content: string): PublishableNote {
    return {
      noteId: 'audit-test-note',
      vaultPath: 'audit-test.md',
      relativePath: 'audit-test.md',
      content,
      frontmatter: {
        flat: {},
        nested: {},
        tags: [],
      },
      title: 'Audit Test Note',
      routing: {
        slug: 'audit-test-note',
        path: '',
        routeBase: '',
        fullPath: '/audit-test-note',
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
