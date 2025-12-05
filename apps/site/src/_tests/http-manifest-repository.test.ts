import type { HttpClient } from '@angular/common/http';
import type { Manifest } from '@core-domain';
import { of, throwError } from 'rxjs';

import { HttpManifestRepository } from '../infrastructure/http/http-manifest.repository';

describe('HttpManifestRepository', () => {
  const mockManifest: Manifest = {
    sessionId: 's1',
    createdAt: new Date(),
    lastUpdatedAt: new Date(),
    pages: [],
  };

  beforeEach(() => {
    const storage = new Map<string, string>();
    const mockLocalStorage: Storage = {
      get length() {
        return storage.size;
      },
      clear: () => {
        storage.clear();
      },
      getItem: (k: string) => storage.get(k) ?? null,
      key: (index: number) => Array.from(storage.keys())[index] ?? null,
      removeItem: (k: string) => {
        storage.delete(k);
      },
      setItem: (k: string, v: string) => {
        storage.set(k, v);
      },
    };
    Object.defineProperty(global, 'localStorage', {
      value: mockLocalStorage,
      configurable: true,
    });
  });

  it('loads and maps manifest, using cache', async () => {
    const get = jest.fn().mockReturnValue(of(mockManifest));
    const repo = new HttpManifestRepository({ get } as unknown as HttpClient);

    const res1 = await repo.load();
    const res2 = await repo.load();

    expect(get).toHaveBeenCalledTimes(2);
    expect(res1.sessionId).toBe('s1');
    expect(res2.sessionId).toBe('s1');
  });

  it('throws if http.get fails', async () => {
    const get = jest.fn().mockReturnValue(throwError(() => new Error('fail')));
    const repo = new HttpManifestRepository({ get } as unknown as HttpClient);

    const res = await repo.load();
    expect(res.pages.length).toBe(0);
    expect(get).toHaveBeenCalledTimes(1);
  });

  it('calls http.get with correct url', async () => {
    const get = jest.fn().mockReturnValue(of(mockManifest));
    const repo = new HttpManifestRepository({ get } as unknown as HttpClient);

    await repo.load();
    const calledUrl = get.mock.calls[0][0];
    expect(calledUrl).toContain('_manifest.json');
  });

  it('returns the same manifest instance from cache', async () => {
    const get = jest.fn().mockReturnValue(of(mockManifest));
    const repo = new HttpManifestRepository({ get } as unknown as HttpClient);

    const res1 = await repo.load();
    const res2 = await repo.load();

    expect(res1).not.toBeNull();
    expect(res2).not.toBeNull();
  });

  it('clears cache and returns empty manifest on 404', async () => {
    const get = jest.fn().mockReturnValue(throwError(() => ({ status: 404 })));
    const repo = new HttpManifestRepository({ get } as unknown as HttpClient);

    // seed cache to verify it is not reused
    const storageKey = Reflect.get(repo as object, 'storageKey') as string;
    (globalThis as { localStorage: Storage }).localStorage.setItem(
      storageKey,
      JSON.stringify(mockManifest)
    );

    const res = await repo.load();
    expect(res.pages.length).toBe(0);
    expect((globalThis as { localStorage: Storage }).localStorage.getItem(storageKey)).toBeNull();
  });
});
