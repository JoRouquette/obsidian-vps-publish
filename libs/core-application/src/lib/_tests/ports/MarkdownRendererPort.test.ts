import { MarkdownRendererPort } from '../../ports/MarkdownRendererPort';

describe('MarkdownRendererPort', () => {
  let renderer: MarkdownRendererPort;

  beforeEach(() => {
    renderer = {
      render: jest.fn(async (markdown: string) => `<p>${markdown}</p>`),
    };
  });

  it('should implement render method', async () => {
    expect(typeof renderer.render).toBe('function');
  });

  it('should return a Promise from render', async () => {
    const result = renderer.render('test');
    expect(result).toBeInstanceOf(Promise);
    await expect(result).resolves.toBe('<p>test</p>');
  });

  it('should render markdown to HTML', async () => {
    const markdown = '# Title';
    (renderer.render as jest.Mock).mockResolvedValue('<h1>Title</h1>');
    const html = await renderer.render(markdown);
    expect(html).toBe('<h1>Title</h1>');
    expect(renderer.render).toHaveBeenCalledWith(markdown);
  });

  it('should handle empty markdown', async () => {
    (renderer.render as jest.Mock).mockResolvedValue('');
    const html = await renderer.render('');
    expect(html).toBe('');
  });

  it('should handle markdown with special characters', async () => {
    const markdown = '**bold** _italic_';
    (renderer.render as jest.Mock).mockResolvedValue('<strong>bold</strong> <em>italic</em>');
    const html = await renderer.render(markdown);
    expect(html).toBe('<strong>bold</strong> <em>italic</em>');
  });

  it('should reject on error', async () => {
    (renderer.render as jest.Mock).mockRejectedValue(new Error('Render failed'));
    await expect(renderer.render('bad input')).rejects.toThrow('Render failed');
  });
});
