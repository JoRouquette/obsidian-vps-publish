/**
 * Integration Test: Dataview → Markdown Pipeline
 *
 * Tests the complete flow: parse → execute → convert → replace
 */

import type { DataviewExecutor } from '../lib/dataview/dataview-executor';
import { processDataviewBlocks } from '../lib/dataview/process-dataview-blocks.service';

describe('Dataview → Markdown Integration', () => {
  describe('Without Dataview executor (fallback)', () => {
    it('should replace blocks with warning callout when executor not available', async () => {
      const content = `
# My Note

Some content here.

\`\`\`dataview
LIST
where type="Book"
\`\`\`

More content.
`;

      const result = await processDataviewBlocks(content, undefined, 'test.md');

      expect(result.content).toContain('> [!warning] Dataview Plugin Required');
      expect(result.content).not.toContain('```dataview');
      expect(result.processedBlocks).toHaveLength(1);
      expect(result.processedBlocks[0].success).toBe(false);
    });

    it('should handle multiple blocks without executor', async () => {
      const content = `
\`\`\`dataview
LIST
\`\`\`

\`\`\`dataviewjs
dv.list()
\`\`\`
`;

      const result = await processDataviewBlocks(content, undefined, 'test.md');

      expect(result.processedBlocks).toHaveLength(2);
      expect(result.processedBlocks[0].block.kind).toBe('query');
      expect(result.processedBlocks[1].block.kind).toBe('js');
      expect(result.content).not.toContain('```dataview');
      expect(result.content).not.toContain('```dataviewjs');
    });
  });

  describe('With mock Dataview executor', () => {
    let mockExecutor: jest.Mocked<DataviewExecutor>;

    beforeEach(() => {
      mockExecutor = {
        executeBlock: jest.fn(),
      } as unknown as jest.Mocked<DataviewExecutor>;
    });

    it('should convert LIST query results to Markdown list', async () => {
      mockExecutor.executeBlock.mockResolvedValue({
        success: true,
        data: {
          values: [
            { path: 'Books/BookA', display: 'Book A' },
            { path: 'Books/BookB', display: 'Book B' },
          ],
        },
      });

      const content = `
# Books

\`\`\`dataview
LIST
where type="Book"
\`\`\`
`;

      const result = await processDataviewBlocks(content, mockExecutor, 'test.md');

      expect(result.content).toContain('[[Books/BookA|Book A]]');
      expect(result.content).toContain('[[Books/BookB|Book B]]');
      expect(result.content).not.toContain('```dataview');
      expect(result.processedBlocks[0].success).toBe(true);
    });

    it('should convert TABLE query results to Markdown table', async () => {
      mockExecutor.executeBlock.mockResolvedValue({
        success: true,
        data: {
          headers: ['Title', 'Author'],
          values: [
            [{ path: 'Books/BookA', display: 'Book A' }, 'John Doe'],
            [{ path: 'Books/BookB', display: 'Book B' }, 'Jane Smith'],
          ],
        },
      });

      const content = `
\`\`\`dataview
TABLE title, author
where type="Book"
\`\`\`
`;

      const result = await processDataviewBlocks(content, mockExecutor, 'test.md');

      expect(result.content).toContain('| Title | Author |');
      expect(result.content).toContain('| --- | --- |');
      expect(result.content).toContain('[[Books/BookA|Book A]]');
      expect(result.content).toContain('Jane Smith');
      expect(result.content).not.toContain('```dataview');
    });

    it('should convert TASK query results to Markdown checkboxes', async () => {
      mockExecutor.executeBlock.mockResolvedValue({
        success: true,
        data: {
          values: [
            { text: 'Complete report', completed: false },
            { text: 'Review code', completed: true },
          ],
        },
      });

      const content = `
\`\`\`dataview
TASK
where file.name = "TODO"
\`\`\`
`;

      const result = await processDataviewBlocks(content, mockExecutor, 'test.md');

      expect(result.content).toContain('- [ ] Complete report');
      expect(result.content).toContain('- [x] Review code');
      expect(result.content).not.toContain('```dataview');
    });

    it.skip('should convert DataviewJS DOM to Markdown', async () => {
      // SKIPPED: Requires DOM (document.createElement) which is not available in Jest Node environment
      // This functionality is tested end-to-end in Obsidian plugin runtime
      const mockContainer = document.createElement('div');
      mockContainer.innerHTML = `
        <ul>
          <li><span class="wikilink" data-wikilink="Notes/Page1">Page 1</span></li>
          <li><span class="wikilink" data-wikilink="Notes/Page2">Page 2</span></li>
        </ul>
      `;

      mockExecutor.executeBlock.mockResolvedValue({
        success: true,
        container: mockContainer,
      });

      const content = `
\`\`\`dataviewjs
dv.list(dv.pages().file.link)
\`\`\`
`;

      const result = await processDataviewBlocks(content, mockExecutor, 'test.md');

      expect(result.content).toContain('- [[Notes/Page1|Page 1]]');
      expect(result.content).toContain('- [[Notes/Page2|Page 2]]');
      expect(result.content).not.toContain('```dataviewjs');
    });

    it('should handle execution errors gracefully', async () => {
      mockExecutor.executeBlock.mockResolvedValue({
        success: false,
        error: 'Invalid query syntax',
      });

      const content = `
\`\`\`dataview
INVALID QUERY
\`\`\`
`;

      const result = await processDataviewBlocks(content, mockExecutor, 'test.md');

      expect(result.content).toContain('> [!warning] Dataview Query Error');
      expect(result.content).toContain('> Invalid query syntax');
      expect(result.processedBlocks[0].success).toBe(false);
    });

    it('should preserve non-dataview content unchanged', async () => {
      mockExecutor.executeBlock.mockResolvedValue({
        success: true,
        data: {
          values: ['Item 1'],
        },
      });

      const content = `
# Title

Regular paragraph with [[wikilink]] and ![[image.png]].

\`\`\`dataview
LIST
\`\`\`

Another paragraph.

\`\`\`javascript
console.log('not dataview');
\`\`\`
`;

      const result = await processDataviewBlocks(content, mockExecutor, 'test.md');

      expect(result.content).toContain('# Title');
      expect(result.content).toContain('Regular paragraph with [[wikilink]]');
      expect(result.content).toContain('![[image.png]]');
      expect(result.content).toContain('Another paragraph');
      expect(result.content).toContain("console.log('not dataview')");
      expect(result.content).not.toContain('```dataview');
    });

    it('should handle multiple blocks in sequence', async () => {
      mockExecutor.executeBlock
        .mockResolvedValueOnce({
          success: true,
          data: { values: ['List Item'] },
        })
        .mockResolvedValueOnce({
          success: true,
          data: {
            headers: ['Col1'],
            values: [['Value1']],
          },
        });

      const content = `
\`\`\`dataview
LIST
\`\`\`

Some text.

\`\`\`dataview
TABLE col1
\`\`\`
`;

      const result = await processDataviewBlocks(content, mockExecutor, 'test.md');

      expect(result.processedBlocks).toHaveLength(2);
      expect(result.content).toContain('- List Item');
      expect(result.content).toContain('| Col1 |');
      expect(result.content).not.toContain('```dataview');
    });
  });

  describe('Real-world scenarios', () => {
    it('should handle complex note with mixed Dataview blocks', async () => {
      const mockExecutor = {
        executeBlock: jest
          .fn()
          .mockResolvedValueOnce({
            success: true,
            data: {
              values: [
                { path: 'Travel/Paris', display: 'Paris', embed: false },
                { path: 'Travel/Tokyo', display: 'Tokyo', embed: false },
              ],
            },
          })
          .mockResolvedValueOnce({
            success: true,
            data: {
              headers: ['Continent', 'Population'],
              values: [
                [{ path: 'Continents/Europe' }, '750M'],
                [{ path: 'Continents/Asia' }, '4.6B'],
              ],
            },
          }),
      } as unknown as DataviewExecutor;

      const content = `
# Travel Planning

## Visited Cities

\`\`\`dataview
LIST
where type="City" and visited=true
\`\`\`

## Continental Data

\`\`\`dataview
TABLE continent, population
where type="Continent"
\`\`\`

## Notes

Regular content with [[links]] and images ![[map.png]].
`;

      const result = await processDataviewBlocks(content, mockExecutor, 'test.md');

      expect(result.content).toContain('[[Travel/Paris|Paris]]');
      expect(result.content).toContain('[[Travel/Tokyo|Tokyo]]');
      expect(result.content).toContain('| Continent | Population |');
      expect(result.content).toContain('[[Continents/Europe|Europe]]'); // Normalized with basename alias
      expect(result.content).toContain('4.6B');
      expect(result.content).toContain('Regular content with [[links]]');
      expect(result.content).toContain('![[map.png]]');
      expect(result.content).not.toContain('```dataview');
      expect(result.processedBlocks).toHaveLength(2);
    });
  });
});
