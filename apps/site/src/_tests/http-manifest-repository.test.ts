import { of, throwError } from 'rxjs';
import { HttpManifestRepository } from '../infrastructure/http/http-manifest.repository';
import { Manifest } from '@core-domain';

describe('HttpManifestRepository', () => {
  const mockManifest: Manifest = { sessionId: 's1' } as Manifest;

  it('loads and maps manifest, using cache', async () => {
    const get = jest.fn().mockReturnValue(of(mockManifest));
    const repo = new HttpManifestRepository({ get } as any);

    const res1 = await repo.load();
    const res2 = await repo.load();

    expect(get).toHaveBeenCalledTimes(1);
    expect(res1.sessionId).toBe('s1');
    expect(res2.sessionId).toBe('s1');
  });

  it('throws if http.get fails', async () => {
    const get = jest.fn().mockReturnValue(throwError(() => new Error('fail')));
    const repo = new HttpManifestRepository({ get } as any);

    await expect(repo.load()).rejects.toThrow('fail');
    expect(get).toHaveBeenCalledTimes(1);
  });

  it('calls http.get with correct url', async () => {
    const get = jest.fn().mockReturnValue(of(mockManifest));
    const repo = new HttpManifestRepository({ get } as any);

    await repo.load();
    const calledUrl = get.mock.calls[0][0];
    expect(calledUrl).toContain('_manifest.json');
  });

  it('returns the same manifest instance from cache', async () => {
    const get = jest.fn().mockReturnValue(of(mockManifest));
    const repo = new HttpManifestRepository({ get } as any);

    const res1 = await repo.load();
    const res2 = await repo.load();

    expect(res1).toBe(res2);
  });
});
