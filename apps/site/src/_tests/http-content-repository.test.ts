import { of } from 'rxjs';
import { HttpContentRepository } from '../infrastructure/http/http-content.repository';

describe('HttpContentRepository', () => {
  it('fetches text content with normalized path', async () => {
    const get = jest.fn().mockReturnValue(of('<p>ok</p>'));
    const repo = new HttpContentRepository({ get } as any);

    const res = await repo.fetch('docs/page.html');

    expect(get).toHaveBeenCalledWith('/content/docs/page.html', { responseType: 'text' });
    expect(res).toBe('<p>ok</p>');
  });
});
