import fsSync, { promises as fs } from 'node:fs';
import os from 'node:os';
import path from 'node:path';

import { type Manifest, Slug } from '@core-domain';

import { ManifestFileSystem } from '../infra/filesystem/manifest-file-system';

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
        slug: Slug.from('home'),
        publishedAt: new Date('2024-01-01T00:00:00Z'),
      },
      {
        id: 'p2',
        title: 'Guide',
        route: '/guide/start',
        slug: Slug.from('start'),
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

  it('saves and loads manifest with assets', async () => {
    const manifestWithAssets: Manifest = {
      sessionId: 's2',
      createdAt: new Date('2024-02-01T10:00:00Z'),
      lastUpdatedAt: new Date('2024-02-01T12:00:00Z'),
      pages: [
        {
          id: 'page1',
          title: 'Article',
          route: '/article',
          slug: Slug.from('article'),
          publishedAt: new Date('2024-02-01T10:30:00Z'),
        },
      ],
      assets: [
        {
          path: '_assets/image.png',
          hash: 'abc123',
          size: 1024,
          mimeType: 'image/png',
          uploadedAt: new Date('2024-02-01T10:15:00Z'),
        },
        {
          path: '_assets/doc.pdf',
          hash: 'def456',
          size: 2048,
          mimeType: 'application/pdf',
          uploadedAt: new Date('2024-02-01T10:20:00Z'),
        },
      ],
    };

    await storage.save(manifestWithAssets);
    const loaded = await storage.load();

    expect(loaded).not.toBeNull();
    expect(loaded!.assets).toBeDefined();
    expect(loaded!.assets).toHaveLength(2);
    expect(loaded!.assets![0].path).toBe('_assets/image.png');
    expect(loaded!.assets![0].hash).toBe('abc123');
    expect(loaded!.assets![0].size).toBe(1024);
    expect(loaded!.assets![0].mimeType).toBe('image/png');
    expect(loaded!.assets![0].uploadedAt).toBeInstanceOf(Date);
    expect(loaded!.assets![0].uploadedAt.toISOString()).toBe('2024-02-01T10:15:00.000Z');
    expect(loaded!.assets![1].uploadedAt).toBeInstanceOf(Date);
  });
});
