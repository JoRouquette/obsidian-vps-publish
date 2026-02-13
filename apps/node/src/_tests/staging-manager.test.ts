import { describe, it, expect, beforeEach, afterEach, jest } from '@jest/globals';
import { promises as fs } from 'fs';
import * as path from 'path';
import * as os from 'os';
import { StagingManager } from '../infra/filesystem/staging-manager';
import type {
  Manifest,
  ManifestPage,
  ManifestAsset,
} from '../../../../libs/core-domain/src/lib/entities';

describe('StagingManager - Manifest Merge (PHASE 6)', () => {
  let stagingManager: StagingManager;
  let tempDir: string;
  let contentRoot: string;
  let assetsRoot: string;
  let mockLogger: any;

  beforeEach(async () => {
    // Create temp directory for test isolation
    tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'staging-manager-test-'));
    contentRoot = path.join(tempDir, 'content');
    assetsRoot = path.join(tempDir, 'assets');

    await fs.mkdir(contentRoot, { recursive: true });
    await fs.mkdir(assetsRoot, { recursive: true });

    mockLogger = {
      debug: jest.fn(),
      info: jest.fn(),
      warn: jest.fn(),
      error: jest.fn(),
    };

    stagingManager = new StagingManager(contentRoot, assetsRoot, mockLogger);
  });

  afterEach(async () => {
    // Cleanup temp directory
    await fs.rm(tempDir, { recursive: true, force: true });
  });

  /**
   * Helper: Write manifest to production content root
   */
  async function writeProductionManifest(manifest: Manifest): Promise<void> {
    const manifestPath = path.join(contentRoot, '_manifest.json');
    const serialized = {
      ...manifest,
      createdAt: manifest.createdAt.toISOString(),
      lastUpdatedAt: manifest.lastUpdatedAt.toISOString(),
      pages: manifest.pages.map((p: ManifestPage) => ({
        ...p,
        publishedAt: p.publishedAt.toISOString(),
      })),
      assets: manifest.assets?.map((a: ManifestAsset) => ({
        ...a,
        uploadedAt: a.uploadedAt.toISOString(),
      })),
    };
    await fs.writeFile(manifestPath, JSON.stringify(serialized, null, 2), 'utf8');
  }

  /**
   * Helper: Write manifest to staging area
   */
  async function writeStagingManifest(sessionId: string, manifest: Manifest): Promise<void> {
    const stagingPath = path.join(contentRoot, '.staging', sessionId);
    await fs.mkdir(stagingPath, { recursive: true });

    const manifestPath = path.join(stagingPath, '_manifest.json');
    const serialized = {
      ...manifest,
      createdAt: manifest.createdAt.toISOString(),
      lastUpdatedAt: manifest.lastUpdatedAt.toISOString(),
      pages: manifest.pages.map((p: ManifestPage) => ({
        ...p,
        publishedAt: p.publishedAt.toISOString(),
      })),
      assets: manifest.assets?.map((a: ManifestAsset) => ({
        ...a,
        uploadedAt: a.uploadedAt.toISOString(),
      })),
    };
    await fs.writeFile(manifestPath, JSON.stringify(serialized, null, 2), 'utf8');
  }

  /**
   * Helper: Create HTML file for a page route
   */
  async function createHtmlForRoute(route: string, content: string): Promise<string> {
    const htmlPath = path.join(contentRoot, ...route.split('/').filter(Boolean), 'index.html');
    await fs.mkdir(path.dirname(htmlPath), { recursive: true });
    await fs.writeFile(htmlPath, content, 'utf8');
    return htmlPath;
  }

  /**
   * Helper: Check if HTML file exists for route
   */
  async function htmlExistsForRoute(route: string): Promise<boolean> {
    const htmlPath = path.join(contentRoot, ...route.split('/').filter(Boolean), 'index.html');
    try {
      await fs.access(htmlPath);
      return true;
    } catch {
      return false;
    }
  }

  it('merges staging + production pages, preserves unchanged notes', async () => {
    // Arrange: Production manifest with 3 pages
    const productionManifest: Manifest = {
      sessionId: 'prod-session',
      createdAt: new Date('2024-01-01T00:00:00Z'),
      lastUpdatedAt: new Date('2024-01-01T00:00:00Z'),
      pages: [
        {
          title: 'Unchanged Note',
          route: '/dir/unchanged',
          relativePath: 'dir/unchanged/index.html',
          publishedAt: new Date('2024-01-01T00:00:00Z'),
          sourceHash: 'hash-unchanged',
          sourceSize: 100,
        } as ManifestPage,
        {
          title: 'Updated Note',
          route: '/dir/updated',
          relativePath: 'dir/updated/index.html',
          publishedAt: new Date('2024-01-01T00:00:00Z'),
          sourceHash: 'hash-old',
          sourceSize: 100,
        } as ManifestPage,
        {
          title: 'Deleted Note',
          route: '/dir/deleted',
          relativePath: 'dir/deleted/index.html',
          publishedAt: new Date('2024-01-01T00:00:00Z'),
        } as ManifestPage,
      ],
      pipelineSignature: {
        version: '1.0.0',
        renderSettingsHash: 'old-settings-hash',
      },
    };

    await writeProductionManifest(productionManifest);

    // Arrange: Staging manifest with 2 pages (1 updated, 1 new)
    const sessionId = 'test-session-123';
    const stagingManifest: Manifest = {
      sessionId,
      createdAt: new Date('2024-01-02T00:00:00Z'),
      lastUpdatedAt: new Date('2024-01-02T00:00:00Z'),
      pages: [
        {
          title: 'Updated Note',
          route: '/dir/updated',
          relativePath: 'dir/updated/index.html',
          publishedAt: new Date('2024-01-02T00:00:00Z'),
          sourceHash: 'hash-new',
          sourceSize: 150,
        } as ManifestPage,
        {
          title: 'New Note',
          route: '/dir/new',
          relativePath: 'dir/new/index.html',
          publishedAt: new Date('2024-01-02T00:00:00Z'),
          sourceHash: 'hash-new-note',
          sourceSize: 200,
        } as ManifestPage,
      ],
      pipelineSignature: {
        version: '1.1.0',
        renderSettingsHash: 'new-settings-hash',
      },
    };

    await writeStagingManifest(sessionId, stagingManifest);

    // PHASE 6.1: Specify allCollectedRoutes (vault contains unchanged, updated, new - NOT deleted)
    const allCollectedRoutes = ['/dir/unchanged', '/dir/updated', '/dir/new'];

    // Act: Promote session with allCollectedRoutes
    await stagingManager.promoteSession(sessionId, allCollectedRoutes);

    // Assert: Load final manifest from production
    const finalManifestPath = path.join(contentRoot, '_manifest.json');
    const finalManifestRaw = await fs.readFile(finalManifestPath, 'utf8');
    const finalManifest = JSON.parse(finalManifestRaw) as Manifest;

    // Should have 3 pages: 2 from staging + 1 unchanged from production (deleted excluded by allCollectedRoutes)
    expect(finalManifest.pages).toHaveLength(3);

    // Find pages by route
    const findPage = (route: string) =>
      finalManifest.pages.find((p: ManifestPage) => p.route === route);
    const unchangedPage = findPage('/dir/unchanged');
    const updatedPage = findPage('/dir/updated');
    const newPage = findPage('/dir/new');
    const deletedPage = findPage('/dir/deleted');

    // Unchanged page should be preserved from production
    expect(unchangedPage).toBeDefined();
    expect(unchangedPage?.sourceHash).toBe('hash-unchanged');

    // Updated page should have NEW hash from staging
    expect(updatedPage).toBeDefined();
    expect(updatedPage?.sourceHash).toBe('hash-new');
    expect(updatedPage?.sourceSize).toBe(150);

    // New page should be present
    expect(newPage).toBeDefined();
    expect(newPage?.title).toBe('New Note');

    // Deleted page should NOT be in final manifest (excluded by allCollectedRoutes)
    expect(deletedPage).toBeUndefined();

    // PipelineSignature should be updated from staging
    expect(finalManifest.pipelineSignature?.version).toBe('1.1.0');
    expect(finalManifest.pipelineSignature?.renderSettingsHash).toBe('new-settings-hash');
  });

  it('deletes HTML files for removed pages', async () => {
    // Arrange: Production manifest with 2 pages
    const productionManifest: Manifest = {
      sessionId: 'prod-session',
      createdAt: new Date('2024-01-01T00:00:00Z'),
      lastUpdatedAt: new Date('2024-01-01T00:00:00Z'),
      pages: [
        {
          title: 'Kept Note',
          route: '/dir/kept',
          relativePath: 'dir/kept/index.html',
          publishedAt: new Date('2024-01-01T00:00:00Z'),
        } as ManifestPage,
        {
          title: 'Deleted Note',
          route: '/dir/deleted',
          relativePath: 'dir/deleted/index.html',
          publishedAt: new Date('2024-01-01T00:00:00Z'),
        } as ManifestPage,
      ],
    };

    await writeProductionManifest(productionManifest);

    // Create HTML files for both pages
    await createHtmlForRoute('/dir/kept', '<html>Kept content</html>');
    const deletedHtmlPath = await createHtmlForRoute(
      '/dir/deleted',
      '<html>Deleted content</html>'
    );

    // Arrange: Staging manifest with only 1 page (kept)
    const sessionId = 'test-session-456';
    const stagingManifest: Manifest = {
      sessionId,
      createdAt: new Date('2024-01-02T00:00:00Z'),
      lastUpdatedAt: new Date('2024-01-02T00:00:00Z'),
      pages: [
        {
          title: 'Kept Note',
          route: '/dir/kept',
          relativePath: 'dir/kept/index.html',
          publishedAt: new Date('2024-01-02T00:00:00Z'),
        } as ManifestPage,
      ],
    };

    await writeStagingManifest(sessionId, stagingManifest);

    // PHASE 6.1: Specify allCollectedRoutes (only kept, deleted not in vault)
    const allCollectedRoutes = ['/dir/kept'];

    // Act: Promote session with allCollectedRoutes
    await stagingManager.promoteSession(sessionId, allCollectedRoutes);

    // Assert: Deleted page's HTML should be removed
    const deletedHtmlExists = await htmlExistsForRoute('/dir/deleted');
    expect(deletedHtmlExists).toBe(false);

    // Kept page's HTML should still exist
    const keptHtmlExists = await htmlExistsForRoute('/dir/kept');
    expect(keptHtmlExists).toBe(true);
  });

  it('handles first publish (no production manifest)', async () => {
    // Arrange: No production manifest exists (first publish)
    // Staging manifest with 2 pages
    const sessionId = 'test-session-first';
    const stagingManifest: Manifest = {
      sessionId,
      createdAt: new Date('2024-01-01T00:00:00Z'),
      lastUpdatedAt: new Date('2024-01-01T00:00:00Z'),
      pages: [
        {
          title: 'First Note',
          route: '/dir/first',
          relativePath: 'dir/first/index.html',
          publishedAt: new Date('2024-01-01T00:00:00Z'),
          sourceHash: 'hash-first',
          sourceSize: 100,
        } as ManifestPage,
        {
          title: 'Second Note',
          route: '/dir/second',
          relativePath: 'dir/second/index.html',
          publishedAt: new Date('2024-01-01T00:00:00Z'),
          sourceHash: 'hash-second',
          sourceSize: 200,
        } as ManifestPage,
      ],
      pipelineSignature: {
        version: '1.0.0',
        renderSettingsHash: 'initial-settings-hash',
      },
    };

    await writeStagingManifest(sessionId, stagingManifest);

    // PHASE 6.1: First publish, all routes are new
    const allCollectedRoutes = ['/dir/first', '/dir/second'];

    // Act: Promote session (first publish)
    await stagingManager.promoteSession(sessionId, allCollectedRoutes);

    // Assert: Final manifest should contain all staging pages
    const finalManifestPath = path.join(contentRoot, '_manifest.json');
    const finalManifestRaw = await fs.readFile(finalManifestPath, 'utf8');
    const finalManifest = JSON.parse(finalManifestRaw) as Manifest;

    expect(finalManifest.pages).toHaveLength(2);
    expect(finalManifest.pages[0].title).toBe('First Note');
    expect(finalManifest.pages[1].title).toBe('Second Note');
    expect(finalManifest.pipelineSignature?.version).toBe('1.0.0');
  });

  it('updates pipelineSignature from staging manifest', async () => {
    // Arrange: Production manifest with old pipeline signature
    const productionManifest: Manifest = {
      sessionId: 'prod-session',
      createdAt: new Date('2024-01-01T00:00:00Z'),
      lastUpdatedAt: new Date('2024-01-01T00:00:00Z'),
      pages: [
        {
          title: 'Note',
          route: '/note',
          relativePath: 'note/index.html',
          publishedAt: new Date('2024-01-01T00:00:00Z'),
        } as ManifestPage,
      ],
      pipelineSignature: {
        version: '1.0.0',
        renderSettingsHash: 'old-hash',
        gitCommit: 'abc123',
      },
    };

    await writeProductionManifest(productionManifest);

    // Arrange: Staging manifest with NEW pipeline signature
    const sessionId = 'test-session-789';
    const stagingManifest: Manifest = {
      sessionId,
      createdAt: new Date('2024-01-02T00:00:00Z'),
      lastUpdatedAt: new Date('2024-01-02T00:00:00Z'),
      pages: [
        {
          title: 'Note',
          route: '/note',
          relativePath: 'note/index.html',
          publishedAt: new Date('2024-01-02T00:00:00Z'),
        } as ManifestPage,
      ],
      pipelineSignature: {
        version: '1.1.0',
        renderSettingsHash: 'new-hash',
        gitCommit: 'def456',
      },
    };

    await writeStagingManifest(sessionId, stagingManifest);

    // PHASE 6.1: allCollectedRoutes contains only /note (same as staging)
    const allCollectedRoutes = ['/note'];

    // Act: Promote session with pipeline signature update
    await stagingManager.promoteSession(sessionId, allCollectedRoutes);

    // Assert: Final manifest should have staging's pipelineSignature
    const finalManifestPath = path.join(contentRoot, '_manifest.json');
    const finalManifestRaw = await fs.readFile(finalManifestPath, 'utf8');
    const finalManifest = JSON.parse(finalManifestRaw) as Manifest;

    expect(finalManifest.pipelineSignature?.version).toBe('1.1.0');
    expect(finalManifest.pipelineSignature?.renderSettingsHash).toBe('new-hash');
    expect(finalManifest.pipelineSignature?.gitCommit).toBe('def456');
  });

  it('preserves production pages with unchanged routes', async () => {
    // Arrange: Production manifest with 5 pages
    const productionManifest: Manifest = {
      sessionId: 'prod-session',
      createdAt: new Date('2024-01-01T00:00:00Z'),
      lastUpdatedAt: new Date('2024-01-01T00:00:00Z'),
      pages: [
        {
          title: 'Note 1',
          route: '/note1',
          relativePath: 'note1/index.html',
          publishedAt: new Date(),
        } as ManifestPage,
        {
          title: 'Note 2',
          route: '/note2',
          relativePath: 'note2/index.html',
          publishedAt: new Date(),
        } as ManifestPage,
        {
          title: 'Note 3',
          route: '/note3',
          relativePath: 'note3/index.html',
          publishedAt: new Date(),
          sourceHash: 'hash3',
        } as ManifestPage,
        {
          title: 'Note 4',
          route: '/note4',
          relativePath: 'note4/index.html',
          publishedAt: new Date(),
        } as ManifestPage,
        {
          title: 'Note 5',
          route: '/note5',
          relativePath: 'note5/index.html',
          publishedAt: new Date(),
        } as ManifestPage,
      ],
    };

    await writeProductionManifest(productionManifest);

    // Arrange: Staging manifest with only 1 page (note3 updated)
    const sessionId = 'test-session-preserve';
    const stagingManifest: Manifest = {
      sessionId,
      createdAt: new Date('2024-01-02T00:00:00Z'),
      lastUpdatedAt: new Date('2024-01-02T00:00:00Z'),
      pages: [
        {
          title: 'Note 3',
          route: '/note3',
          relativePath: 'note3/index.html',
          publishedAt: new Date('2024-01-02T00:00:00Z'),
          sourceHash: 'hash3-new',
          sourceSize: 200,
        } as ManifestPage,
      ],
    };

    await writeStagingManifest(sessionId, stagingManifest);

    // PHASE 6.1: All 5 notes still in vault (only note3 changed)
    const allCollectedRoutes = ['/note1', '/note2', '/note3', '/note4', '/note5'];

    // Act: Promote session (only note3 updated)
    await stagingManager.promoteSession(sessionId, allCollectedRoutes);

    // Assert: Final manifest should have 5 pages (1 updated + 4 unchanged)
    const finalManifestPath = path.join(contentRoot, '_manifest.json');
    const finalManifestRaw = await fs.readFile(finalManifestPath, 'utf8');
    const finalManifest = JSON.parse(finalManifestRaw) as Manifest;

    expect(finalManifest.pages).toHaveLength(5);

    // Check that note3 is updated
    const note3 = finalManifest.pages.find((p: ManifestPage) => p.route === '/note3');
    expect(note3?.sourceHash).toBe('hash3-new');

    // Check that other notes are preserved
    const note1 = finalManifest.pages.find((p: ManifestPage) => p.route === '/note1');
    const note2 = finalManifest.pages.find((p: ManifestPage) => p.route === '/note2');
    const note4 = finalManifest.pages.find((p: ManifestPage) => p.route === '/note4');
    const note5 = finalManifest.pages.find((p: ManifestPage) => p.route === '/note5');

    expect(note1).toBeDefined();
    expect(note2).toBeDefined();
    expect(note4).toBeDefined();
    expect(note5).toBeDefined();
  });
});
