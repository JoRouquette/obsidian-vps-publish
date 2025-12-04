import { of, throwError } from 'rxjs';
import { HttpManifestRepository } from '../infrastructure/http/http-manifest.repository';
import { Manifest } from '@core-domain';

describe('HttpManifestRepository', () => {
  const mockManifest: Manifest = {
    sessionId: 's1',
    createdAt: new Date(),
    lastUpdatedAt: new Date(),
    pages: [],
  };

  beforeEach(() => {
    const storage = new Map<string, string>();
    Object.defineProperty(global, 'localStorage', {
      value: {
        getItem: (k: string) => storage.get(k) ?? null,
        setItem: (k: string, v: string) => storage.set(k, v),
        removeItem: (k: string) => storage.delete(k),
        clear: () => storage.clear(),
      },
      configurable: true,
    });
  });

  it('loads and maps manifest, using cache', async () => {
    const get = jest.fn().mockReturnValue(of(mockManifest));
    const repo = new HttpManifestRepository({ get } as any);

    const res1 = await repo.load();
    const res2 = await repo.load();

    expect(get).toHaveBeenCalledTimes(2);
    expect(res1.sessionId).toBe('s1');
    expect(res2.sessionId).toBe('s1');
  });

  it('throws if http.get fails', async () => {
    const get = jest.fn().mockReturnValue(throwError(() => new Error('fail')));
    const repo = new HttpManifestRepository({ get } as any);

    const res = await repo.load();
    expect(res.pages.length).toBe(0);
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

    expect(res1).not.toBeNull();
    expect(res2).not.toBeNull();
  });

  it('clears cache and returns empty manifest on 404', async () => {
    const get = jest.fn().mockReturnValue(throwError(() => ({ status: 404 })));
    const repo = new HttpManifestRepository({ get } as any);

    // seed cache to verify it is not reused
    (global as any).localStorage.setItem(repo['storageKey' as any], JSON.stringify(mockManifest));

    const res = await repo.load();
    expect(res.pages.length).toBe(0);
    expect((global as any).localStorage.getItem(repo['storageKey' as any])).toBeNull();
  });
});
