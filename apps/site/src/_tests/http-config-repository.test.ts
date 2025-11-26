import { of } from 'rxjs';
import { HttpConfigRepository } from '../infrastructure/http/http-config.repository';

describe('HttpConfigRepository', () => {
  it('caches config load', async () => {
    const payload = { siteName: 'Site', author: 'Me', repoUrl: '', reportIssuesUrl: '' };
    const get = jest.fn().mockReturnValue(of(payload));
    const repo = new HttpConfigRepository({ get } as any);

    const c1 = await repo.load();
    const c2 = await repo.load();

    expect(get).toHaveBeenCalledTimes(1);
    expect(c1.siteName).toBe('Site');
    expect(c2.author).toBe('Me');
  });
});
