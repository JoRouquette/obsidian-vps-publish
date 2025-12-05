import { type PublishableNote } from '@core-domain';

import { type MarkdownRendererPort } from '../../ports/markdown-renderer.port';

describe('MarkdownRendererPort', () => {
  let renderer: MarkdownRendererPort;
  const baseNote = (content: string): PublishableNote =>
    ({
      noteId: 'n',
      title: 'Note',
      vaultPath: 'Vault/Note.md',
      relativePath: 'Note.md',
      content,
      frontmatter: { flat: {}, nested: {}, tags: [] },
      folderConfig: { id: 'f', vaultFolder: 'Vault', routeBase: '/blog', vpsId: 'vps' },
      routing: { slug: 'note', path: '', routeBase: '/blog', fullPath: '/blog/note' },
      publishedAt: new Date(),
      eligibility: { isPublishable: true },
    }) as PublishableNote;

  beforeEach(() => {
    renderer = {
      render: jest.fn(async (note: PublishableNote) => `<p>${note.content}</p>`),
    };
  });

  it('should implement render method', async () => {
    expect(typeof renderer.render).toBe('function');
  });

  it('should return a Promise from render', async () => {
    const result = renderer.render(baseNote('test'));
    expect(result).toBeInstanceOf(Promise);
    await expect(result).resolves.toBe('<p>test</p>');
  });

  it('should render markdown to HTML', async () => {
    const markdown = '# Title';
    (renderer.render as jest.Mock).mockResolvedValue('<h1>Title</h1>');
    const html = await renderer.render(baseNote(markdown));
    expect(html).toBe('<h1>Title</h1>');
    expect(renderer.render).toHaveBeenCalledWith(expect.objectContaining({ content: markdown }));
  });

  it('should handle empty markdown', async () => {
    (renderer.render as jest.Mock).mockResolvedValue('');
    const html = await renderer.render(baseNote(''));
    expect(html).toBe('');
  });

  it('should handle markdown with special characters', async () => {
    const markdown = '**bold** _italic_';
    (renderer.render as jest.Mock).mockResolvedValue('<strong>bold</strong> <em>italic</em>');
    const html = await renderer.render(baseNote(markdown));
    expect(html).toBe('<strong>bold</strong> <em>italic</em>');
  });

  it('should reject on error', async () => {
    (renderer.render as jest.Mock).mockRejectedValue(new Error('Render failed'));
    await expect(renderer.render(baseNote('bad input'))).rejects.toThrow('Render failed');
  });
});
