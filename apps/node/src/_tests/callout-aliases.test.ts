/**
 * Test suite for Obsidian callout aliases support
 * Reference: Obsidian Help > Callouts > Supported types and aliases
 */

import { type PublishableNote } from '@core-domain';

import { MarkdownItRenderer } from '../infra/markdown/markdown-it.renderer';

describe('Callout Aliases - Obsidian Spec Compliance', () => {
  const baseNote = (): PublishableNote => ({
    noteId: 'note-1',
    title: 'Test Note',
    vaultPath: 'vault/test.md',
    relativePath: 'test.md',
    content: '',
    frontmatter: { flat: {}, nested: {}, tags: [] },
    folderConfig: {
      id: 'folder',
      vaultFolder: 'test',
      routeBase: '/test',
      vpsId: 'vps',
      ignoredCleanupRuleIds: [],
    },
    routing: { slug: 'test', path: '', routeBase: '/test', fullPath: '/test/test' },
    publishedAt: new Date('2024-01-01T00:00:00Z'),
    eligibility: { isPublishable: true },
  });

  describe('abstract type aliases', () => {
    it('[!tldr] should render as data-callout="abstract"', async () => {
      const renderer = new MarkdownItRenderer();
      const note = baseNote();
      note.content = '> [!tldr] Summary\n> This is a summary.';

      const html = await renderer.render(note);

      expect(html).toContain('data-callout="abstract"');
      expect(html).toContain('Summary');
      expect(html).not.toContain('[!tldr]');
    });

    it('[!summary] should render as data-callout="abstract"', async () => {
      const renderer = new MarkdownItRenderer();
      const note = baseNote();
      note.content = '> [!summary] Summary\n> Quick overview.';

      const html = await renderer.render(note);

      expect(html).toContain('data-callout="abstract"');
      expect(html).toContain('Summary');
    });

    it('[!TLDR] (uppercase) should render as data-callout="abstract"', async () => {
      const renderer = new MarkdownItRenderer();
      const note = baseNote();
      note.content = '> [!TLDR] Upper Case\n> Case insensitive.';

      const html = await renderer.render(note);

      expect(html).toContain('data-callout="abstract"');
    });
  });

  describe('tip type aliases', () => {
    it('[!hint] should render as data-callout="tip"', async () => {
      const renderer = new MarkdownItRenderer();
      const note = baseNote();
      note.content = '> [!hint] Pro Tip\n> Here is a hint.';

      const html = await renderer.render(note);

      expect(html).toContain('data-callout="tip"');
      expect(html).toContain('Pro Tip');
      expect(html).not.toContain('[!hint]');
    });

    it('[!important] should render as data-callout="tip"', async () => {
      const renderer = new MarkdownItRenderer();
      const note = baseNote();
      note.content = '> [!important] Critical Info\n> Pay attention.';

      const html = await renderer.render(note);

      expect(html).toContain('data-callout="tip"');
      expect(html).toContain('Critical Info');
    });
  });

  describe('success type aliases', () => {
    it('[!check] should render as data-callout="success"', async () => {
      const renderer = new MarkdownItRenderer();
      const note = baseNote();
      note.content = '> [!check] Verified\n> All good!';

      const html = await renderer.render(note);

      expect(html).toContain('data-callout="success"');
      expect(html).toContain('Verified');
    });

    it('[!done] should render as data-callout="success"', async () => {
      const renderer = new MarkdownItRenderer();
      const note = baseNote();
      note.content = '> [!done] Completed\n> Task finished.';

      const html = await renderer.render(note);

      expect(html).toContain('data-callout="success"');
    });
  });

  describe('question type aliases', () => {
    it('[!help] should render as data-callout="question"', async () => {
      const renderer = new MarkdownItRenderer();
      const note = baseNote();
      note.content = '> [!help] Need Help?\n> Contact support.';

      const html = await renderer.render(note);

      expect(html).toContain('data-callout="question"');
      expect(html).toContain('Need Help?');
    });

    it('[!faq] should render as data-callout="question"', async () => {
      const renderer = new MarkdownItRenderer();
      const note = baseNote();
      note.content = '> [!faq] Common Question\n> Frequently asked.';

      const html = await renderer.render(note);

      expect(html).toContain('data-callout="question"');
    });
  });

  describe('warning type aliases', () => {
    it('[!caution] should render as data-callout="warning"', async () => {
      const renderer = new MarkdownItRenderer();
      const note = baseNote();
      note.content = '> [!caution] Be Careful\n> Watch out!';

      const html = await renderer.render(note);

      expect(html).toContain('data-callout="warning"');
    });

    it('[!attention] should render as data-callout="warning"', async () => {
      const renderer = new MarkdownItRenderer();
      const note = baseNote();
      note.content = '> [!attention] Pay Attention\n> Important notice.';

      const html = await renderer.render(note);

      expect(html).toContain('data-callout="warning"');
    });
  });

  describe('failure type aliases', () => {
    it('[!fail] should render as data-callout="failure"', async () => {
      const renderer = new MarkdownItRenderer();
      const note = baseNote();
      note.content = '> [!fail] Failed\n> Something went wrong.';

      const html = await renderer.render(note);

      expect(html).toContain('data-callout="failure"');
    });

    it('[!missing] should render as data-callout="failure"', async () => {
      const renderer = new MarkdownItRenderer();
      const note = baseNote();
      note.content = '> [!missing] Not Found\n> Resource missing.';

      const html = await renderer.render(note);

      expect(html).toContain('data-callout="failure"');
    });
  });

  describe('danger type aliases', () => {
    it('[!error] should render as data-callout="danger"', async () => {
      const renderer = new MarkdownItRenderer();
      const note = baseNote();
      note.content = '> [!error] Critical Error\n> System failure.';

      const html = await renderer.render(note);

      expect(html).toContain('data-callout="danger"');
      expect(html).toContain('Critical Error');
    });
  });

  describe('quote type aliases', () => {
    it('[!cite] should render as data-callout="quote"', async () => {
      const renderer = new MarkdownItRenderer();
      const note = baseNote();
      note.content = '> [!cite] Citation\n> Famous quote here.';

      const html = await renderer.render(note);

      expect(html).toContain('data-callout="quote"');
    });
  });

  describe('custom callouts (non-standard types)', () => {
    it('[!my-custom] should preserve custom type in data-callout', async () => {
      const renderer = new MarkdownItRenderer();
      const note = baseNote();
      note.content = '> [!my-custom] Custom Title\n> Custom content.';

      const html = await renderer.render(note);

      // Custom types should be preserved as-is (sanitized)
      expect(html).toContain('data-callout="my-custom"');
      expect(html).toContain('Custom Title');
      expect(html).toContain('Custom content');
    });

    it('[!MyCustomType] should be normalized to lowercase in data-callout', async () => {
      const renderer = new MarkdownItRenderer();
      const note = baseNote();
      note.content = '> [!MyCustomType] Title\n> Body.';

      const html = await renderer.render(note);

      expect(html).toContain('data-callout="mycustomtype"');
    });
  });

  describe('folding behavior with aliases', () => {
    it('[!faq]- should render foldable question callout closed by default', async () => {
      const renderer = new MarkdownItRenderer();
      const note = baseNote();
      note.content = '> [!faq]- Collapsible FAQ\n> Hidden content.';

      const html = await renderer.render(note);

      expect(html).toContain('data-callout="question"');
      expect(html).toContain('data-callout-fold="closed"');
      expect(html).toContain('<details class="callout"');
      expect(html).toContain('Collapsible FAQ');
    });

    it('[!error]+ should render foldable danger callout open by default', async () => {
      const renderer = new MarkdownItRenderer();
      const note = baseNote();
      note.content = '> [!error]+ Expandable Error\n> Error details.';

      const html = await renderer.render(note);

      expect(html).toContain('data-callout="danger"');
      expect(html).toContain('data-callout-fold="open"');
      expect(html).toContain('<details class="callout"');
      expect(html).toContain(' open');
    });
  });

  describe('icon rendering for aliases', () => {
    it('[!tldr] should use abstract icon (description)', async () => {
      const renderer = new MarkdownItRenderer();
      const note = baseNote();
      note.content = '> [!tldr] Summary\n> Content.';

      const html = await renderer.render(note);

      // Abstract uses 'description' icon
      expect(html).toContain('data-callout="abstract"');
      expect(html).toContain('data-icon="description"');
      expect(html).toContain('material-symbols-outlined');
    });

    it('[!error] should use danger icon (report)', async () => {
      const renderer = new MarkdownItRenderer();
      const note = baseNote();
      note.content = '> [!error] Error\n> Content.';

      const html = await renderer.render(note);

      // Danger uses 'report' icon
      expect(html).toContain('data-callout="danger"');
      expect(html).toContain('data-icon="report"');
    });
  });
});
