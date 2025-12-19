/**
 * Dataview Block Parser Tests
 *
 * Tests the state machine parser with various edge cases.
 */

import { parseDataviewBlocks } from '../lib/dataview/dataview-block.parser';

describe('Dataview Block Parser', () => {
  describe('Basic Detection', () => {
    it('should detect simple dataview query block', () => {
      const content = `\`\`\`dataview
LIST
FROM #test
\`\`\``;

      const blocks = parseDataviewBlocks(content);

      expect(blocks).toHaveLength(1);
      expect(blocks[0].kind).toBe('query');
      expect(blocks[0].langRaw).toBe('dataview');
      expect(blocks[0].contentRaw).toBe('LIST\nFROM #test');
      if (blocks[0].kind === 'query') {
        expect(blocks[0].queryType).toBe('list');
      }
    });

    it('should detect simple dataviewjs block', () => {
      const content = `\`\`\`dataviewjs
dv.list(dv.pages("#test"));
\`\`\``;

      const blocks = parseDataviewBlocks(content);

      expect(blocks).toHaveLength(1);
      expect(blocks[0].kind).toBe('js');
      expect(blocks[0].langRaw).toBe('dataviewjs');
      expect(blocks[0].contentRaw).toBe('dv.list(dv.pages("#test"));');
    });

    it('should NOT confuse dataviewjs with dataview', () => {
      const content = `\`\`\`dataviewjs
dv.list(dv.pages("#test"));
\`\`\``;

      const blocks = parseDataviewBlocks(content);

      expect(blocks).toHaveLength(1);
      expect(blocks[0].kind).toBe('js'); // NOT 'query'
      expect(blocks[0].langRaw).toBe('dataviewjs');
    });
  });

  describe('Case Insensitivity', () => {
    it('should detect DATAVIEW (uppercase)', () => {
      const content = `\`\`\`DATAVIEW
LIST
\`\`\``;

      const blocks = parseDataviewBlocks(content);

      expect(blocks).toHaveLength(1);
      expect(blocks[0].kind).toBe('query');
      expect(blocks[0].langRaw).toBe('DATAVIEW');
    });

    it('should detect DataView (mixed case)', () => {
      const content = `\`\`\`DataView
LIST
\`\`\``;

      const blocks = parseDataviewBlocks(content);

      expect(blocks).toHaveLength(1);
      expect(blocks[0].kind).toBe('query');
      expect(blocks[0].langRaw).toBe('DataView');
    });

    it('should detect DataViewJS (mixed case)', () => {
      const content = `\`\`\`DataViewJS
dv.list();
\`\`\``;

      const blocks = parseDataviewBlocks(content);

      expect(blocks).toHaveLength(1);
      expect(blocks[0].kind).toBe('js');
      expect(blocks[0].langRaw).toBe('DataViewJS');
    });
  });

  describe('Query Type Detection', () => {
    it('should detect LIST query', () => {
      const content = `\`\`\`dataview
LIST
FROM #test
\`\`\``;

      const blocks = parseDataviewBlocks(content);
      expect(blocks[0].kind).toBe('query');
      if (blocks[0].kind === 'query') {
        expect(blocks[0].queryType).toBe('list');
      }
    });

    it('should detect TABLE query', () => {
      const content = `\`\`\`dataview
TABLE name, value
FROM #test
\`\`\``;

      const blocks = parseDataviewBlocks(content);
      expect(blocks[0].kind).toBe('query');
      if (blocks[0].kind === 'query') {
        expect(blocks[0].queryType).toBe('table');
      }
    });

    it('should detect TASK query', () => {
      const content = `\`\`\`dataview
TASK
FROM #project
\`\`\``;

      const blocks = parseDataviewBlocks(content);
      expect(blocks[0].kind).toBe('query');
      if (blocks[0].kind === 'query') {
        expect(blocks[0].queryType).toBe('task');
      }
    });

    it('should detect CALENDAR query', () => {
      const content = `\`\`\`dataview
CALENDAR date
FROM #events
\`\`\``;

      const blocks = parseDataviewBlocks(content);
      expect(blocks[0].kind).toBe('query');
      if (blocks[0].kind === 'query') {
        expect(blocks[0].queryType).toBe('calendar');
      }
    });

    it('should handle unknown query type', () => {
      const content = `\`\`\`dataview
UNKNOWN_COMMAND
\`\`\``;

      const blocks = parseDataviewBlocks(content);
      expect(blocks[0].kind).toBe('query');
      if (blocks[0].kind === 'query') {
        expect(blocks[0].queryType).toBe('unknown');
      }
    });

    it('should skip empty lines and comments when detecting query type', () => {
      const content = `\`\`\`dataview

// This is a comment
LIST
FROM #test
\`\`\``;

      const blocks = parseDataviewBlocks(content);
      expect(blocks[0].kind).toBe('query');
      if (blocks[0].kind === 'query') {
        expect(blocks[0].queryType).toBe('list');
      }
    });
  });

  describe('Multiple Blocks', () => {
    it('should detect multiple dataview blocks', () => {
      const content = `# Title

\`\`\`dataview
LIST
FROM #test
\`\`\`

Some text

\`\`\`dataview
TABLE name
FROM #other
\`\`\``;

      const blocks = parseDataviewBlocks(content);

      expect(blocks).toHaveLength(2);
      if (blocks[0].kind === 'query' && blocks[1].kind === 'query') {
        expect(blocks[0].queryType).toBe('list');
        expect(blocks[1].queryType).toBe('table');
      }
    });

    it('should detect mixed dataview and dataviewjs blocks', () => {
      const content = `\`\`\`dataview
LIST
\`\`\`

\`\`\`dataviewjs
dv.list();
\`\`\`

\`\`\`dataview
TABLE name
\`\`\``;

      const blocks = parseDataviewBlocks(content);

      expect(blocks).toHaveLength(3);
      expect(blocks[0].kind).toBe('query');
      expect(blocks[1].kind).toBe('js');
      expect(blocks[2].kind).toBe('query');
    });
  });

  describe('Edge Cases', () => {
    it('should handle empty content', () => {
      const blocks = parseDataviewBlocks('');
      expect(blocks).toHaveLength(0);
    });

    it('should handle no dataview blocks', () => {
      const content = `# Normal markdown

\`\`\`javascript
console.log('not dataview');
\`\`\``;

      const blocks = parseDataviewBlocks(content);
      expect(blocks).toHaveLength(0);
    });

    it('should handle empty dataview block', () => {
      const content = `\`\`\`dataview
\`\`\``;

      const blocks = parseDataviewBlocks(content);

      expect(blocks).toHaveLength(1);
      expect(blocks[0].contentRaw).toBe('');
      if (blocks[0].kind === 'query') {
        expect(blocks[0].queryType).toBe('unknown');
      }
    });

    it('should handle block with only whitespace', () => {
      const content = `\`\`\`dataview
   
   
\`\`\``;

      const blocks = parseDataviewBlocks(content);

      expect(blocks).toHaveLength(1);
      expect(blocks[0].contentRaw).toContain('   ');
      if (blocks[0].kind === 'query') {
        expect(blocks[0].queryType).toBe('unknown');
      }
    });

    it('should preserve exact content including leading/trailing whitespace', () => {
      const content = `\`\`\`dataview
  LIST  
 FROM #test 
\`\`\``;

      const blocks = parseDataviewBlocks(content);

      expect(blocks[0].contentRaw).toBe('  LIST  \n FROM #test ');
    });
  });

  describe('Line and Index Tracking', () => {
    it('should track line numbers correctly (1-based)', () => {
      const content = `Line 1
\`\`\`dataview
LIST
\`\`\`
Line 5`;

      const blocks = parseDataviewBlocks(content);

      expect(blocks[0].startLine).toBe(2); // ``` dataview is line 2
      expect(blocks[0].endLine).toBe(4); // closing ``` is line 4
    });

    it('should track character indices correctly (0-based)', () => {
      const content = `\`\`\`dataview
LIST
\`\`\``;

      const blocks = parseDataviewBlocks(content);

      expect(blocks[0].startIndex).toBe(0);
      expect(blocks[0].endIndex).toBe(content.length);
    });

    it('should track indices for multiple blocks', () => {
      const content = `ABC
\`\`\`dataview
LIST
\`\`\`
XYZ
\`\`\`dataviewjs
dv.list();
\`\`\``;

      const blocks = parseDataviewBlocks(content);

      expect(blocks).toHaveLength(2);

      // First block
      expect(blocks[0].startIndex).toBe(4); // After "ABC\n"
      expect(blocks[0].endIndex).toBe(24); // Before "\nXYZ" (corrected: should include closing fence)

      // Second block
      expect(blocks[1].startIndex).toBe(29); // After "XYZ\n" + newline after fence
      expect(blocks[1].endIndex).toBe(content.length);
    });
  });

  describe('Regression: Fence Variations', () => {
    it('should handle fence with trailing spaces', () => {
      const content = `\`\`\`dataview   
LIST
\`\`\`   `;

      const blocks = parseDataviewBlocks(content);

      expect(blocks).toHaveLength(1);
      expect(blocks[0].kind).toBe('query');
    });

    it('should NOT match incomplete opening fence', () => {
      const content = `\`\`dataview
LIST
\`\`\``;

      const blocks = parseDataviewBlocks(content);
      expect(blocks).toHaveLength(0);
    });

    it('should NOT match incomplete closing fence', () => {
      const content = `\`\`\`dataview
LIST
\`\``;

      const blocks = parseDataviewBlocks(content);
      expect(blocks).toHaveLength(0); // Block not closed
    });
  });
});
