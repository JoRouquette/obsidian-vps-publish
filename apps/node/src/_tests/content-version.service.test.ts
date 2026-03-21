import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';

import { Slug } from '@core-domain';

import { ContentVersionService } from '../infra/content-version/content-version.service';
import { ManifestFileSystem } from '../infra/filesystem/manifest-file-system';

describe('ContentVersionService', () => {
  let tempDir: string;
  let manifestStorage: ManifestFileSystem;

  beforeEach(async () => {
    tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'content-version-'));
    manifestStorage = new ManifestFileSystem(tempDir);
  });

  afterEach(async () => {
    await fs.rm(tempDir, { recursive: true, force: true });
  });

  it('recomputes persisted and cached versions when the manifest revision changes', async () => {
    await manifestStorage.save({
      sessionId: 'session-1',
      createdAt: new Date('2026-03-20T10:00:00.000Z'),
      lastUpdatedAt: new Date('2026-03-20T10:00:00.000Z'),
      contentRevision: 'rev-1',
      pages: [
        {
          id: 'page-1',
          title: 'Page One',
          slug: Slug.from('page-one'),
          route: '/page-one',
          publishedAt: new Date('2026-03-20T10:00:00.000Z'),
        },
      ],
      assets: [],
    });

    const service = new ContentVersionService(tempDir);
    const firstVersion = await service.updateVersion();

    await manifestStorage.save({
      sessionId: 'session-2',
      createdAt: new Date('2026-03-21T10:00:00.000Z'),
      lastUpdatedAt: new Date('2026-03-21T10:00:00.000Z'),
      contentRevision: 'rev-2',
      pages: [
        {
          id: 'page-1',
          title: 'Page One',
          slug: Slug.from('page-one'),
          route: '/page-one',
          publishedAt: new Date('2026-03-21T10:00:00.000Z'),
        },
      ],
      assets: [],
    });

    const refreshedVersion = await service.getVersion();
    const persistedVersion = JSON.parse(
      await fs.readFile(path.join(tempDir, '_content-version.json'), 'utf8')
    ) as { version: string; contentRevision?: string };

    expect(refreshedVersion).not.toBeNull();
    expect(refreshedVersion?.contentRevision).toBe('rev-2');
    expect(refreshedVersion?.version).not.toBe(firstVersion.version);
    expect(persistedVersion.contentRevision).toBe('rev-2');
    expect(persistedVersion.version).toBe(refreshedVersion?.version);
  });
});
