import fsSync from 'node:fs';
import { promises as fs } from 'node:fs';
import os from 'node:os';
import path from 'node:path';

import { ManifestFileSystem } from '../infra/filesystem/ManifestFileSystem';
import { Manifest } from '@core-domain';

describe('ManifestFileSystem', () => {
  let tmpDir: string;
  let storage: ManifestFileSystem;

  const manifest: Manifest = {
    sessionId: 's1',
    createdAt: new Date('2024-01-01T00:00:00Z'),
    lastUpdatedAt: new Date('2024-01-02T00:00:00Z'),
    pages: [
      {
        id: 'p1',
        title: 'Home',
        route: '/home',
        slug: 'home',
        publishedAt: new Date('2024-01-01T00:00:00Z'),
      },
      {
        id: 'p2',
        title: 'Guide',
        route: '/guide/start',
        slug: 'start',
        publishedAt: new Date('2024-01-01T00:00:00Z'),
      },
    ],
  };

  beforeEach(() => {
    tmpDir = fsSync.mkdtempSync(path.join(os.tmpdir(), 'manifest-'));
    storage = new ManifestFileSystem(tmpDir);
  });

  afterEach(() => {
    fsSync.rmSync(tmpDir, { recursive: true, force: true });
  });

  it('returns null when manifest is missing', async () => {
    const loaded = await storage.load();
    expect(loaded).toBeNull();
  });

  it('saves and loads manifest with dates', async () => {
    await storage.save(manifest);
    const loaded = await storage.load();
    expect(loaded?.sessionId).toBe('s1');
    expect(loaded?.pages[0].publishedAt).toBeInstanceOf(Date);
  });

  it('rebuilds indexes and writes html files', async () => {
    await storage.save(manifest);
    await storage.rebuildIndex(manifest);

    expect(fsSync.existsSync(path.join(tmpDir, 'index.html'))).toBe(true);
    expect(fsSync.existsSync(path.join(tmpDir, 'guide', 'index.html'))).toBe(true);
  });

  it('throws when save fails', async () => {
    const spy = jest.spyOn(fs as any, 'writeFile').mockRejectedValueOnce(new Error('disk full'));
    await expect(storage.save(manifest)).rejects.toThrow('disk full');
    spy.mockRestore();
  });

  it('propagates unexpected errors on load', async () => {
    const spy = jest.spyOn(fs as any, 'readFile').mockRejectedValueOnce(new Error('read fail'));
    await expect(storage.load()).rejects.toThrow('read fail');
    spy.mockRestore();
  });
});
