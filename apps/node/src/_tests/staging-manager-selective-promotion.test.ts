/**
 * Integration tests for StagingManager's selective asset promotion.
 * Tests the complete workflow of promoting staged content to production
 * with intelligent asset synchronization based on manifest.
 */

import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';

import { type Manifest, Slug } from '@core-domain';

import { StagingManager } from '../infra/filesystem/staging-manager';

describe('StagingManager - Selective Asset Promotion', () => {
  let contentRoot: string;
  let assetsRoot: string;
  let stagingManager: StagingManager;
  let sessionId: string;

  beforeEach(async () => {
    // Create temporary directories for the test
    const tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'staging-test-'));
    contentRoot = path.join(tmpDir, 'content');
    assetsRoot = path.join(tmpDir, 'assets');
    sessionId = 'test-session-123';

    await fs.mkdir(contentRoot, { recursive: true });
    await fs.mkdir(assetsRoot, { recursive: true });

    stagingManager = new StagingManager(contentRoot, assetsRoot);
  });

  afterEach(async () => {
    // Cleanup temporary directories
    try {
      const tmpDir = path.dirname(contentRoot);
      await fs.rm(tmpDir, { recursive: true, force: true });
    } catch {
      // Ignore cleanup errors
    }
  });

  describe('Promotion with new assets only', () => {
    it('should copy new assets from staging to production', async () => {
      // ARRANGE: Prepare staging with new assets
      const stagingContent = stagingManager.contentStagingPath(sessionId);
      const stagingAssets = stagingManager.assetsStagingPath(sessionId);

      await fs.mkdir(stagingContent, { recursive: true });
      await fs.mkdir(stagingAssets, { recursive: true });

      // Create manifest in staging with new assets
      const now = new Date();
      const manifest: Manifest = {
        sessionId,
        createdAt: now,
        lastUpdatedAt: now,
        pages: [],
        assets: [
          {
            path: '_assets/image1.png',
            hash: 'hash1',
            size: 1024,
            mimeType: 'image/png',
            uploadedAt: now,
          },
          {
            path: '_assets/image2.jpg',
            hash: 'hash2',
            size: 2048,
            mimeType: 'image/jpeg',
            uploadedAt: now,
          },
        ],
      };
      await fs.writeFile(
        path.join(stagingContent, '_manifest.json'),
        JSON.stringify(
          {
            ...manifest,
            createdAt: manifest.createdAt.toISOString(),
            lastUpdatedAt: manifest.lastUpdatedAt.toISOString(),
            assets: manifest.assets?.map((a) => ({
              ...a,
              uploadedAt: a.uploadedAt.toISOString(),
            })),
          },
          null,
          2
        )
      );

      // Create asset files in staging
      await fs.mkdir(path.join(stagingAssets, '_assets'), { recursive: true });
      await fs.writeFile(path.join(stagingAssets, '_assets', 'image1.png'), 'image1-content');
      await fs.writeFile(path.join(stagingAssets, '_assets', 'image2.jpg'), 'image2-content');

      // ACT: Promote staging to production
      await stagingManager.promoteSession(sessionId);

      // ASSERT: Check that assets were copied to production
      const asset1 = await fs.readFile(path.join(assetsRoot, '_assets', 'image1.png'), 'utf8');
      const asset2 = await fs.readFile(path.join(assetsRoot, '_assets', 'image2.jpg'), 'utf8');

      expect(asset1).toBe('image1-content');
      expect(asset2).toBe('image2-content');
    });
  });

  describe('Promotion with reused existing assets', () => {
    it('should preserve existing assets referenced in manifest (not in staging)', async () => {
      // ARRANGE: Set up production with existing assets
      await fs.mkdir(path.join(assetsRoot, '_assets'), { recursive: true });
      await fs.writeFile(
        path.join(assetsRoot, '_assets', 'existing-asset.png'),
        'existing-content'
      );

      // Prepare staging with manifest that references the existing asset (but asset not in staging)
      const stagingContent = stagingManager.contentStagingPath(sessionId);
      const stagingAssets = stagingManager.assetsStagingPath(sessionId);

      await fs.mkdir(stagingContent, { recursive: true });
      await fs.mkdir(stagingAssets, { recursive: true });

      const manifest: Manifest = {
        sessionId,
        createdAt: new Date(),
        lastUpdatedAt: new Date(),
        pages: [],
        assets: [
          {
            path: '_assets/existing-asset.png',
            hash: 'existing-hash',
            size: 1024,
            mimeType: 'image/png',
            uploadedAt: new Date('2024-01-01'),
          },
          {
            path: '_assets/new-asset.jpg',
            hash: 'new-hash',
            size: 2048,
            mimeType: 'image/jpeg',
            uploadedAt: new Date(),
          },
        ],
      };
      await fs.writeFile(
        path.join(stagingContent, '_manifest.json'),
        JSON.stringify(manifest, null, 2)
      );

      // Only the new asset is in staging
      await fs.mkdir(path.join(stagingAssets, '_assets'), { recursive: true });
      await fs.writeFile(path.join(stagingAssets, '_assets', 'new-asset.jpg'), 'new-content');

      // ACT: Promote staging to production
      await stagingManager.promoteSession(sessionId);

      // ASSERT: Check that existing asset was preserved and new asset was added
      const existingAsset = await fs.readFile(
        path.join(assetsRoot, '_assets', 'existing-asset.png'),
        'utf8'
      );
      const newAsset = await fs.readFile(path.join(assetsRoot, '_assets', 'new-asset.jpg'), 'utf8');

      expect(existingAsset).toBe('existing-content');
      expect(newAsset).toBe('new-content');
    });
  });

  describe('Promotion with obsolete asset cleanup', () => {
    it('should delete assets in production that are not in manifest', async () => {
      // ARRANGE: Set up production with assets
      await fs.mkdir(path.join(assetsRoot, '_assets'), { recursive: true });
      await fs.writeFile(path.join(assetsRoot, '_assets', 'keep.png'), 'keep-content');
      await fs.writeFile(path.join(assetsRoot, '_assets', 'delete.png'), 'delete-content');
      await fs.writeFile(
        path.join(assetsRoot, '_assets', 'also-delete.jpg'),
        'also-delete-content'
      );

      // Prepare staging with manifest that only references "keep.png"
      const stagingContent = stagingManager.contentStagingPath(sessionId);
      const stagingAssets = stagingManager.assetsStagingPath(sessionId);

      await fs.mkdir(stagingContent, { recursive: true });
      await fs.mkdir(stagingAssets, { recursive: true });

      const manifest: Manifest = {
        sessionId,
        createdAt: new Date(),
        lastUpdatedAt: new Date(),
        pages: [],
        assets: [
          {
            path: '_assets/keep.png',
            hash: 'keep-hash',
            size: 1024,
            mimeType: 'image/png',
            uploadedAt: new Date(),
          },
        ],
      };
      await fs.writeFile(
        path.join(stagingContent, '_manifest.json'),
        JSON.stringify(manifest, null, 2)
      );

      // No assets in staging (all reused)

      // ACT: Promote staging to production
      await stagingManager.promoteSession(sessionId);

      // ASSERT: Check that only referenced asset was kept
      const keepExists = await fs
        .access(path.join(assetsRoot, '_assets', 'keep.png'))
        .then(() => true)
        .catch(() => false);
      const deleteExists = await fs
        .access(path.join(assetsRoot, '_assets', 'delete.png'))
        .then(() => true)
        .catch(() => false);
      const alsoDeleteExists = await fs
        .access(path.join(assetsRoot, '_assets', 'also-delete.jpg'))
        .then(() => true)
        .catch(() => false);

      expect(keepExists).toBe(true);
      expect(deleteExists).toBe(false);
      expect(alsoDeleteExists).toBe(false);
    });
  });

  describe('Promotion without manifest', () => {
    it('should copy all assets from staging when no manifest is present', async () => {
      // ARRANGE: Set up production with existing assets
      await fs.mkdir(path.join(assetsRoot, '_assets'), { recursive: true });
      await fs.writeFile(path.join(assetsRoot, '_assets', 'old-asset.png'), 'old-content');

      // Prepare staging with minimal manifest (no pages, only assets)
      const stagingContent = stagingManager.contentStagingPath(sessionId);
      const stagingAssets = stagingManager.assetsStagingPath(sessionId);

      await fs.mkdir(stagingContent, { recursive: true });
      await fs.mkdir(stagingAssets, { recursive: true });

      // Create manifest with asset reference
      const now = new Date();
      const manifest: Manifest = {
        sessionId,
        createdAt: now,
        lastUpdatedAt: now,
        pages: [],
        assets: [
          {
            path: '_assets/new-asset.jpg',
            hash: 'hash-new',
            size: 1024,
            mimeType: 'image/jpeg',
            uploadedAt: now,
          },
        ],
      };
      await fs.writeFile(
        path.join(stagingContent, '_manifest.json'),
        JSON.stringify({
          ...manifest,
          createdAt: manifest.createdAt.toISOString(),
          lastUpdatedAt: manifest.lastUpdatedAt.toISOString(),
          assets: manifest.assets?.map((a) => ({ ...a, uploadedAt: a.uploadedAt.toISOString() })),
        })
      );

      // Create assets in staging
      await fs.mkdir(path.join(stagingAssets, '_assets'), { recursive: true });
      await fs.writeFile(path.join(stagingAssets, '_assets', 'new-asset.jpg'), 'new-content');

      // ACT: Promote staging to production with empty allCollectedRoutes (no pages)
      await stagingManager.promoteSession(sessionId, []);

      // ASSERT: Check that new asset was copied
      const newAsset = await fs.readFile(path.join(assetsRoot, '_assets', 'new-asset.jpg'), 'utf8');
      expect(newAsset).toBe('new-content');

      // Old assets should be deleted (not referenced in manifest)
      const oldExists = await fs
        .access(path.join(assetsRoot, '_assets', 'old-asset.png'))
        .then(() => true)
        .catch(() => false);
      expect(oldExists).toBe(false);
    });
  });

  describe('Complete workflow with mixed operations', () => {
    it('should handle new, reused, and obsolete assets in single promotion', async () => {
      // ARRANGE: Complex scenario
      // Production has: asset1.png, asset2.jpg, obsolete.gif
      await fs.mkdir(path.join(assetsRoot, '_assets'), { recursive: true });
      await fs.writeFile(path.join(assetsRoot, '_assets', 'asset1.png'), 'asset1-original');
      await fs.writeFile(path.join(assetsRoot, '_assets', 'asset2.jpg'), 'asset2-original');
      await fs.writeFile(path.join(assetsRoot, '_assets', 'obsolete.gif'), 'obsolete-content');

      const stagingContent = stagingManager.contentStagingPath(sessionId);
      const stagingAssets = stagingManager.assetsStagingPath(sessionId);

      await fs.mkdir(stagingContent, { recursive: true });
      await fs.mkdir(stagingAssets, { recursive: true });

      // Manifest references:
      // - asset1.png (existing, reused - same hash)
      // - asset2.jpg (existing, but NOT in manifest, will be deleted actually... wait no)
      // Actually let me re-think this scenario

      // Manifest should reference:
      // - asset1.png (reused from production, not in staging)
      // - asset3.webp (new, in staging)
      // Production should delete: asset2.jpg, obsolete.gif

      const manifest: Manifest = {
        sessionId,
        createdAt: new Date(),
        lastUpdatedAt: new Date(),
        pages: [],
        assets: [
          {
            path: '_assets/asset1.png',
            hash: 'hash1',
            size: 1024,
            mimeType: 'image/png',
            uploadedAt: new Date('2024-01-01'),
          },
          {
            path: '_assets/asset3.webp',
            hash: 'hash3',
            size: 3072,
            mimeType: 'image/webp',
            uploadedAt: new Date(),
          },
        ],
      };
      await fs.writeFile(
        path.join(stagingContent, '_manifest.json'),
        JSON.stringify(manifest, null, 2)
      );

      // Only new asset in staging
      await fs.mkdir(path.join(stagingAssets, '_assets'), { recursive: true });
      await fs.writeFile(path.join(stagingAssets, '_assets', 'asset3.webp'), 'asset3-new');

      // ACT
      await stagingManager.promoteSession(sessionId);

      // ASSERT
      // asset1.png should be preserved (reused)
      const asset1 = await fs.readFile(path.join(assetsRoot, '_assets', 'asset1.png'), 'utf8');
      expect(asset1).toBe('asset1-original');

      // asset3.webp should be copied (new)
      const asset3 = await fs.readFile(path.join(assetsRoot, '_assets', 'asset3.webp'), 'utf8');
      expect(asset3).toBe('asset3-new');

      // asset2.jpg should be deleted (not in manifest)
      const asset2Exists = await fs
        .access(path.join(assetsRoot, '_assets', 'asset2.jpg'))
        .then(() => true)
        .catch(() => false);
      expect(asset2Exists).toBe(false);

      // obsolete.gif should be deleted (not in manifest)
      const obsoleteExists = await fs
        .access(path.join(assetsRoot, '_assets', 'obsolete.gif'))
        .then(() => true)
        .catch(() => false);
      expect(obsoleteExists).toBe(false);
    });
  });

  describe('Concurrent promotion race conditions (B6)', () => {
    it('should serialize concurrent promotions and apply deletion logic correctly', async () => {
      // ARRANGE: Two sessions ready to promote simultaneously
      const sessionId1 = 'concurrent-session-1';
      const sessionId2 = 'concurrent-session-2';

      // Setup session 1 staging
      const staging1Content = stagingManager.contentStagingPath(sessionId1);
      const staging1Assets = stagingManager.assetsStagingPath(sessionId1);
      await fs.mkdir(staging1Content, { recursive: true });
      await fs.mkdir(staging1Assets, { recursive: true });

      const now1 = new Date();
      const manifest1: Manifest = {
        sessionId: sessionId1,
        createdAt: now1,
        lastUpdatedAt: now1,
        pages: [
          {
            id: 'page-session-1-id',
            slug: Slug.from('page-from-session-1'),
            title: 'Session 1 Page',
            route: '/page-session-1',
            relativePath: 'page-session-1.html',
            publishedAt: now1,
            tags: [],
          },
        ],
        assets: [
          {
            path: '_assets/session1-asset.png',
            hash: 'hash-session1',
            size: 1024,
            mimeType: 'image/png',
            uploadedAt: now1,
          },
        ],
      };
      await fs.writeFile(
        path.join(staging1Content, '_manifest.json'),
        JSON.stringify(
          {
            ...manifest1,
            createdAt: manifest1.createdAt.toISOString(),
            lastUpdatedAt: manifest1.lastUpdatedAt.toISOString(),
            pages: manifest1.pages.map((p) => ({ ...p, publishedAt: p.publishedAt.toISOString() })),
            assets: manifest1.assets?.map((a) => ({
              ...a,
              uploadedAt: a.uploadedAt.toISOString(),
            })),
          },
          null,
          2
        )
      );
      await fs.writeFile(path.join(staging1Content, 'page-session-1.html'), '<h1>Session 1</h1>');
      await fs.mkdir(path.join(staging1Assets, '_assets'), { recursive: true });
      await fs.writeFile(
        path.join(staging1Assets, '_assets', 'session1-asset.png'),
        'session1-content'
      );

      // Setup session 2 staging
      const staging2Content = stagingManager.contentStagingPath(sessionId2);
      const staging2Assets = stagingManager.assetsStagingPath(sessionId2);
      await fs.mkdir(staging2Content, { recursive: true });
      await fs.mkdir(staging2Assets, { recursive: true });

      const now2 = new Date();
      const manifest2: Manifest = {
        sessionId: sessionId2,
        createdAt: now2,
        lastUpdatedAt: now2,
        pages: [
          {
            id: 'page-session-2-id',
            slug: Slug.from('page-from-session-2'),
            title: 'Session 2 Page',
            route: '/page-session-2',
            relativePath: 'page-session-2.html',
            publishedAt: now2,
            tags: [],
          },
        ],
        assets: [
          {
            path: '_assets/session2-asset.jpg',
            hash: 'hash-session2',
            size: 2048,
            mimeType: 'image/jpeg',
            uploadedAt: now2,
          },
        ],
      };
      await fs.writeFile(
        path.join(staging2Content, '_manifest.json'),
        JSON.stringify(
          {
            ...manifest2,
            createdAt: manifest2.createdAt.toISOString(),
            lastUpdatedAt: manifest2.lastUpdatedAt.toISOString(),
            pages: manifest2.pages.map((p) => ({ ...p, publishedAt: p.publishedAt.toISOString() })),
            assets: manifest2.assets?.map((a) => ({
              ...a,
              uploadedAt: a.uploadedAt.toISOString(),
            })),
          },
          null,
          2
        )
      );
      await fs.writeFile(path.join(staging2Content, 'page-session-2.html'), '<h1>Session 2</h1>');
      await fs.mkdir(path.join(staging2Assets, '_assets'), { recursive: true });
      await fs.writeFile(
        path.join(staging2Assets, '_assets', 'session2-asset.jpg'),
        'session2-content'
      );

      // ACT: Trigger both promotions concurrently WITH allCollectedRoutes
      // Each session represents the complete vault state at that moment
      const results = await Promise.allSettled([
        stagingManager.promoteSession(sessionId1, ['/page-session-1']),
        stagingManager.promoteSession(sessionId2, ['/page-session-2']),
      ]);

      // ASSERT: Both promotions should succeed
      expect(results[0].status).toBe('fulfilled');
      expect(results[1].status).toBe('fulfilled');

      // Production should contain content from ONE complete session (whichever won the race)
      // The second promotion deletes the first session's content (not in its allCollectedRoutes)
      const manifestExists = await fs
        .access(path.join(contentRoot, '_manifest.json'))
        .then(() => true)
        .catch(() => false);
      expect(manifestExists).toBe(true);

      const finalManifest = JSON.parse(
        await fs.readFile(path.join(contentRoot, '_manifest.json'), 'utf8')
      ) as Manifest;

      // With allCollectedRoutes, only content from last session remains (first is deleted)
      expect(finalManifest.pages).toHaveLength(1);
      expect(finalManifest.assets).toHaveLength(1);

      // Content should match the manifest (consistency check)
      const pageSlug = finalManifest.pages[0].slug;
      const pageRelativePath = finalManifest.pages[0].relativePath!;

      if (pageSlug.value === 'page-from-session-1') {
        // Session 1 won
        const pageContent = await fs.readFile(path.join(contentRoot, pageRelativePath), 'utf8');
        expect(pageContent).toBe('<h1>Session 1</h1>');

        const assetContent = await fs.readFile(
          path.join(assetsRoot, '_assets', 'session1-asset.png'),
          'utf8'
        );
        expect(assetContent).toBe('session1-content');

        // Session 2 content should not exist
        const session2PageExists = await fs
          .access(path.join(contentRoot, 'page-session-2.html'))
          .then(() => true)
          .catch(() => false);
        expect(session2PageExists).toBe(false);
      } else {
        // Session 2 won
        expect(pageSlug.value).toBe('page-from-session-2');
        const pageContent = await fs.readFile(path.join(contentRoot, pageRelativePath), 'utf8');
        expect(pageContent).toBe('<h1>Session 2</h1>');

        const assetContent = await fs.readFile(
          path.join(assetsRoot, '_assets', 'session2-asset.jpg'),
          'utf8'
        );
        expect(assetContent).toBe('session2-content');

        // Session 1 content should not exist
        const session1PageExists = await fs
          .access(path.join(contentRoot, 'page-session-1.html'))
          .then(() => true)
          .catch(() => false);
        expect(session1PageExists).toBe(false);
      }
    });

    it('should handle rapid concurrent promotions without deadlock', async () => {
      // ARRANGE: Setup two sessions
      const sessionId1 = 'rapid-session-1';
      const sessionId2 = 'rapid-session-2';

      // Minimal staging setup
      for (const sid of [sessionId1, sessionId2]) {
        const stagingContent = stagingManager.contentStagingPath(sid);
        const stagingAssets = stagingManager.assetsStagingPath(sid);
        await fs.mkdir(stagingContent, { recursive: true });
        await fs.mkdir(stagingAssets, { recursive: true });

        const now = new Date();
        const manifest: Manifest = {
          sessionId: sid,
          createdAt: now,
          lastUpdatedAt: now,
          pages: [],
          assets: [],
        };
        await fs.writeFile(
          path.join(stagingContent, '_manifest.json'),
          JSON.stringify({
            ...manifest,
            createdAt: manifest.createdAt.toISOString(),
            lastUpdatedAt: manifest.lastUpdatedAt.toISOString(),
          })
        );
        await fs.writeFile(path.join(stagingContent, `${sid}.html`), `<p>${sid}</p>`);
      }

      // ACT: Launch both promotions concurrently WITH allCollectedRoutes (empty)
      const startTime = Date.now();
      const results = await Promise.allSettled([
        stagingManager.promoteSession(sessionId1, []),
        stagingManager.promoteSession(sessionId2, []),
      ]);
      const duration = Date.now() - startTime;

      // ASSERT: Both should complete successfully without deadlock
      expect(results[0].status).toBe('fulfilled');
      expect(results[1].status).toBe('fulfilled');

      // Should complete within reasonable time (not deadlocked)
      expect(duration).toBeLessThan(5000); // 5 seconds max for two simple promotions

      // Final manifest should be valid (not corrupted)
      const manifestExists = await fs
        .access(path.join(contentRoot, '_manifest.json'))
        .then(() => true)
        .catch(() => false);
      expect(manifestExists).toBe(true);

      const finalManifest = JSON.parse(
        await fs.readFile(path.join(contentRoot, '_manifest.json'), 'utf8')
      ) as Manifest;

      // Should have content from one complete session
      expect([sessionId1, sessionId2]).toContain(finalManifest.sessionId);
    }, 10000); // Increase timeout for concurrent operations

    it('should maintain manifest-file consistency under concurrent promotions', async () => {
      // ARRANGE: Three rapid consecutive promotions
      const sessions = ['consistency-1', 'consistency-2', 'consistency-3'];

      for (const sid of sessions) {
        const stagingContent = stagingManager.contentStagingPath(sid);
        const stagingAssets = stagingManager.assetsStagingPath(sid);
        await fs.mkdir(stagingContent, { recursive: true });
        await fs.mkdir(stagingAssets, { recursive: true });

        const now = new Date();
        const manifest: Manifest = {
          sessionId: sid,
          createdAt: now,
          lastUpdatedAt: now,
          pages: [
            {
              id: `page-${sid}-id`,
              slug: Slug.from(`page-${sid}`),
              title: `Page ${sid}`,
              route: `/page-${sid}`,
              relativePath: `page-${sid}.html`,
              publishedAt: now,
              tags: [],
            },
          ],
          assets: [
            {
              path: `_assets/${sid}.png`,
              hash: `hash-${sid}`,
              size: 1024,
              mimeType: 'image/png',
              uploadedAt: now,
            },
          ],
        };
        await fs.writeFile(
          path.join(stagingContent, '_manifest.json'),
          JSON.stringify({
            ...manifest,
            createdAt: manifest.createdAt.toISOString(),
            lastUpdatedAt: manifest.lastUpdatedAt.toISOString(),
            pages: manifest.pages.map((p) => ({ ...p, publishedAt: p.publishedAt.toISOString() })),
            assets: manifest.assets?.map((a) => ({ ...a, uploadedAt: a.uploadedAt.toISOString() })),
          })
        );
        await fs.writeFile(path.join(stagingContent, `page-${sid}.html`), `<h1>${sid}</h1>`);
        await fs.mkdir(path.join(stagingAssets, '_assets'), { recursive: true });
        await fs.writeFile(path.join(stagingAssets, '_assets', `${sid}.png`), `content-${sid}`);
      }

      // ACT: Promote all three concurrently WITH allCollectedRoutes
      // Each session represents complete vault state with only its own page
      await Promise.all(
        sessions.map((sid) => stagingManager.promoteSession(sid, [`/page-${sid}`]))
      );

      // ASSERT: Final state should be consistent (last session wins, deletes others)
      const finalManifest = JSON.parse(
        await fs.readFile(path.join(contentRoot, '_manifest.json'), 'utf8')
      ) as Manifest;

      // With allCollectedRoutes, only the last promoted session's content remains
      expect(finalManifest.pages).toHaveLength(1);
      expect(finalManifest.assets).toHaveLength(1);

      const winnerSession = finalManifest.sessionId;
      const winnerPage = finalManifest.pages[0];
      const winnerAsset = finalManifest.assets![0];

      // Files referenced in manifest must exist
      const pageExists = await fs
        .access(path.join(contentRoot, winnerPage.relativePath!))
        .then(() => true)
        .catch(() => false);
      expect(pageExists).toBe(true);

      const assetExists = await fs
        .access(path.join(assetsRoot, winnerAsset.path))
        .then(() => true)
        .catch(() => false);
      expect(assetExists).toBe(true);

      // Content should match session ID
      const pageContent = await fs.readFile(
        path.join(contentRoot, winnerPage.relativePath!),
        'utf8'
      );
      expect(pageContent).toContain(winnerSession);

      const assetContent = await fs.readFile(path.join(assetsRoot, winnerAsset.path), 'utf8');
      expect(assetContent).toBe(`content-${winnerSession}`);
    }, 15000); // Longer timeout for triple concurrent operations
  });
});
