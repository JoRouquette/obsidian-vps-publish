import { MarkdownItRenderer } from '../infra/markdown/markdown-it.renderer';

describe('MarkdownItRenderer', () => {
  it('renders markdown to HTML', async () => {
    const renderer = new MarkdownItRenderer();
    const html = await renderer.render('# Title');
    expect(html).toContain('<h1>Title</h1>');
  });
});
