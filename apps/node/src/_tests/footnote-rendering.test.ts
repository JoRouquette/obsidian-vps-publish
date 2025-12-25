import MarkdownIt from 'markdown-it';
import footnote from 'markdown-it-footnote';

describe('Footnote Navigation', () => {
  let md: MarkdownIt;

  beforeEach(() => {
    md = new MarkdownIt({
      html: true,
      breaks: false,
      linkify: true,
    });
    md.use(footnote);

    // Apply same customization as MarkdownItRenderer
    md.renderer.rules.footnote_ref = (tokens, idx) => {
      const id = Number(tokens[idx].meta.id + 1);
      const refId = `fnref-${id}`;
      const label = tokens[idx].meta.label ?? id;
      return `<sup class="footnote-ref"><a href="#fn-${id}" id="${refId}">${label}</a></sup>`;
    };

    md.renderer.rules.footnote_block_open = () => {
      return '<section class="footnotes" role="doc-endnotes">\n<hr>\n<ol class="footnotes-list">\n';
    };

    md.renderer.rules.footnote_block_close = () => {
      return '</ol>\n</section>\n';
    };

    md.renderer.rules.footnote_open = (tokens, idx) => {
      const id = Number(tokens[idx].meta.id + 1);
      return `<li id="fn-${id}" class="footnote-item">`;
    };

    md.renderer.rules.footnote_anchor = (tokens, idx) => {
      const id = Number(tokens[idx].meta.id + 1);
      const refId = `fnref-${id}`;
      return ` <a href="#${refId}" class="footnote-backref" aria-label="Back to reference ${id}">↩</a>`;
    };
  });

  it('should generate correct bidirectional footnote links', () => {
    const markdown = 'This is text with a footnote[^1].\n\n[^1]: This is the footnote content.';
    const html = md.render(markdown);

    console.log('Generated HTML:', html);

    // Check reference link (in text) points to footnote
    expect(html).toContain('href="#fn-1"');
    expect(html).toContain('id="fnref-1"');

    // Check back-reference (in footnote) points back to reference
    expect(html).toContain('href="#fnref-1"');
    expect(html).toContain('id="fn-1"');

    // Check the backref link is present
    expect(html).toContain('class="footnote-backref"');
    expect(html).toContain('↩');
  });

  it('should handle multiple footnotes correctly', () => {
    const markdown =
      'First footnote[^1] and second[^2].\n\n[^1]: First content.\n[^2]: Second content.';
    const html = md.render(markdown);

    // First footnote
    expect(html).toContain('href="#fn-1"');
    expect(html).toContain('id="fnref-1"');
    expect(html).toContain('id="fn-1"');
    expect(html).toMatch(/id="fn-1"[\s\S]*?href="#fnref-1"/);

    // Second footnote
    expect(html).toContain('href="#fn-2"');
    expect(html).toContain('id="fnref-2"');
    expect(html).toContain('id="fn-2"');
    expect(html).toMatch(/id="fn-2"[\s\S]*?href="#fnref-2"/);
  });
});
