import { type Manifest, Slug } from '@core-domain';
import * as path from 'path';

import { ManifestFileSystem } from '../infra/filesystem/manifest-file-system';
import { ConsoleLogger } from '../infra/logging/console-logger';

/**
 * Test d'intégration pour vérifier que les custom indexes sont générés correctement.
 * Bug reproduit : seul l'index principal fonctionne, les custom indexes ne sont pas générés.
 */
describe('Custom indexes integration', () => {
  let manifestPort: ManifestFileSystem;
  let testContentRoot: string;

  beforeEach(() => {
    testContentRoot = path.join(__dirname, '..', '..', 'tmp', 'custom-indexes-test');
    const logger = new ConsoleLogger({ level: 'warn' });
    manifestPort = new ManifestFileSystem(testContentRoot, logger);
  });

  it('should generate main index and custom folder indexes', async () => {
    // Arrange: Create a manifest with pages in multiple folders
    const manifest: Manifest = {
      sessionId: 'test-session',
      createdAt: new Date(),
      lastUpdatedAt: new Date(),
      pages: [
        {
          id: 'root-page-1',
          title: 'Root Page 1',
          route: '/root-page-1',
          slug: Slug.from('root-page-1'),
          publishedAt: new Date(),
        },
        {
          id: 'guide-page-1',
          title: 'Guide Intro',
          route: '/guide/intro',
          slug: Slug.from('intro'),
          publishedAt: new Date(),
        },
        {
          id: 'guide-page-2',
          title: 'Guide Setup',
          route: '/guide/setup',
          slug: Slug.from('setup'),
          publishedAt: new Date(),
        },
        {
          id: 'api-page-1',
          title: 'API Reference',
          route: '/api/reference',
          slug: Slug.from('reference'),
          publishedAt: new Date(),
        },
      ],
    };

    // Custom index HTML content for different folders
    const customIndexesHtml = new Map<string, string>([
      ['/', '<p>Custom root index content</p>'],
      ['/guide', '<p>Custom guide index content</p>'],
      ['/api', '<p>Custom API index content</p>'],
    ]);

    // Act: Rebuild indexes with custom content
    await manifestPort.rebuildIndex(manifest, customIndexesHtml);

    // Assert: Verify that main index and all custom indexes were generated
    const fs = await import('fs/promises');

    // Main index should exist and contain custom content
    const rootIndexPath = path.join(testContentRoot, 'index.html');
    const rootIndexHtml = await fs.readFile(rootIndexPath, 'utf8');
    expect(rootIndexHtml).toContain('Custom root index content');
    expect(rootIndexHtml).toContain('Dossiers');
    expect(rootIndexHtml).toContain('guide');
    expect(rootIndexHtml).toContain('api');

    // Guide index should exist and contain custom content
    const guideIndexPath = path.join(testContentRoot, 'guide', 'index.html');
    const guideIndexHtml = await fs.readFile(guideIndexPath, 'utf8');
    expect(guideIndexHtml).toContain('Custom guide index content');
    expect(guideIndexHtml).toContain('Guide Intro');
    expect(guideIndexHtml).toContain('Guide Setup');

    // API index should exist and contain custom content
    const apiIndexPath = path.join(testContentRoot, 'api', 'index.html');
    const apiIndexHtml = await fs.readFile(apiIndexPath, 'utf8');
    expect(apiIndexHtml).toContain('Custom API index content');
    expect(apiIndexHtml).toContain('API Reference');

    // Cleanup
    await fs.rm(testContentRoot, { recursive: true, force: true });
  });

  it('should handle missing custom index gracefully', async () => {
    // Arrange: Create a manifest with pages, but only provide custom content for root
    const manifest: Manifest = {
      sessionId: 'test-session',
      createdAt: new Date(),
      lastUpdatedAt: new Date(),
      pages: [
        {
          id: 'guide-page-1',
          title: 'Guide Intro',
          route: '/guide/intro',
          slug: Slug.from('intro'),
          publishedAt: new Date(),
        },
      ],
    };

    const customIndexesHtml = new Map<string, string>([
      ['/', '<p>Only root has custom content</p>'],
      // /guide intentionally missing
    ]);

    // Act
    await manifestPort.rebuildIndex(manifest, customIndexesHtml);

    // Assert: Guide index should be generated without custom content
    const fs = await import('fs/promises');
    const guideIndexPath = path.join(testContentRoot, 'guide', 'index.html');
    const guideIndexHtml = await fs.readFile(guideIndexPath, 'utf8');

    expect(guideIndexHtml).not.toContain('custom content');
    expect(guideIndexHtml).toContain('Guide Intro');

    // Cleanup
    await fs.rm(testContentRoot, { recursive: true, force: true });
  });

  it('should support multiple custom indexes per VPS', async () => {
    // Arrange: Create a complex folder structure
    const manifest: Manifest = {
      sessionId: 'test-session',
      createdAt: new Date(),
      lastUpdatedAt: new Date(),
      pages: [
        {
          id: 'campaign-index',
          title: 'Campaign Index',
          route: '/campaign/index',
          slug: Slug.from('index'),
          publishedAt: new Date(),
          isCustomIndex: true,
        },
        {
          id: 'campaign-page',
          title: 'Campaign Overview',
          route: '/campaign/overview',
          slug: Slug.from('overview'),
          publishedAt: new Date(),
        },
        {
          id: 'pnj-index',
          title: 'PNJ Index',
          route: '/campaign/pnj/index',
          slug: Slug.from('index'),
          publishedAt: new Date(),
          isCustomIndex: true,
        },
        {
          id: 'pnj-page',
          title: 'Important NPCs',
          route: '/campaign/pnj/important',
          slug: Slug.from('important'),
          publishedAt: new Date(),
        },
        {
          id: 'world-index',
          title: 'World Index',
          route: '/world/index',
          slug: Slug.from('index'),
          publishedAt: new Date(),
          isCustomIndex: true,
        },
      ],
    };

    const customIndexesHtml = new Map<string, string>([
      ['/campaign', '<h2>Welcome to our campaign</h2><p>Custom campaign intro</p>'],
      ['/campaign/pnj', '<h2>Non-Player Characters</h2><p>Meet the NPCs</p>'],
      ['/world', '<h2>World Lore</h2><p>Explore the world</p>'],
    ]);

    // Act
    await manifestPort.rebuildIndex(manifest, customIndexesHtml);

    // Assert: All three custom indexes should be generated
    const fs = await import('fs/promises');

    const campaignIndexPath = path.join(testContentRoot, 'campaign', 'index.html');
    const campaignIndexHtml = await fs.readFile(campaignIndexPath, 'utf8');
    expect(campaignIndexHtml).toContain('Welcome to our campaign');
    expect(campaignIndexHtml).toContain('Custom campaign intro');
    expect(campaignIndexHtml).toContain('Campaign Overview');

    const pnjIndexPath = path.join(testContentRoot, 'campaign', 'pnj', 'index.html');
    const pnjIndexHtml = await fs.readFile(pnjIndexPath, 'utf8');
    expect(pnjIndexHtml).toContain('Non-Player Characters');
    expect(pnjIndexHtml).toContain('Meet the NPCs');
    expect(pnjIndexHtml).toContain('Important NPCs');

    const worldIndexPath = path.join(testContentRoot, 'world', 'index.html');
    const worldIndexHtml = await fs.readFile(worldIndexPath, 'utf8');
    expect(worldIndexHtml).toContain('World Lore');
    expect(worldIndexHtml).toContain('Explore the world');

    // Cleanup
    await fs.rm(testContentRoot, { recursive: true, force: true });
  });
});
