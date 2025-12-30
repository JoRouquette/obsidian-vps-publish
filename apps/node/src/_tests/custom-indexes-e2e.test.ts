import {
  type CustomIndexConfig,
  type LoggerPort,
  LogLevel,
  type Manifest,
  Slug,
} from '@core-domain';
import { promises as fs } from 'fs';
import * as path from 'path';

import { ManifestFileSystem } from '../infra/filesystem/manifest-file-system';
import { ConsoleLogger } from '../infra/logging/console-logger';

/**
 * Test d'intégration end-to-end pour reproduire le flux complet custom indexes.
 * Ce test simule :
 * 1. Plugin configure custom indexes avec routeBase
 * 2. API reçoit customIndexConfigs
 * 3. API publie les notes custom index
 * 4. API extrait HTML et rebuild indexes
 *
 * Bug potential : vérifier que folderPath normalisation works correctly
 */
describe('Custom indexes e2e flow', () => {
  let testContentRoot: string;
  let logger: LoggerPort;

  beforeEach(() => {
    testContentRoot = path.join(__dirname, '..', '..', 'tmp', 'custom-indexes-e2e');
    logger = new ConsoleLogger({ level: 'debug' });
  });

  afterEach(async () => {
    await fs.rm(testContentRoot, { recursive: true, force: true }).catch(() => {});
  });

  it('should handle custom indexes with various folderPath formats', async () => {
    // Simulate plugin sending customIndexConfigs with routeBase format
    const customIndexConfigs: CustomIndexConfig[] = [
      {
        id: 'root-index',
        folderPath: '', // Root index
        indexFilePath: '_index.md',
        isRootIndex: true,
      },
      {
        id: 'guide-index',
        folderPath: '/guide', // Leading slash (from plugin routeBase)
        indexFilePath: 'guide/_index.md',
      },
      {
        id: 'api-index',
        folderPath: 'api', // No leading slash variant
        indexFilePath: 'api/_index.md',
      },
      {
        id: 'deep-index',
        folderPath: '/guide/advanced', // Nested folder
        indexFilePath: 'guide/advanced/_index.md',
      },
    ];

    // Simulate manifest with published pages
    const manifest: Manifest = {
      sessionId: 'test-session',
      createdAt: new Date(),
      lastUpdatedAt: new Date(),
      pages: [
        // Regular pages
        {
          id: 'page-1',
          title: 'Getting Started',
          route: '/guide/getting-started',
          slug: Slug.from('getting-started'),
          publishedAt: new Date(),
        },
        {
          id: 'page-2',
          title: 'API Reference',
          route: '/api/reference',
          slug: Slug.from('reference'),
          publishedAt: new Date(),
        },
        {
          id: 'page-3',
          title: 'Advanced Topics',
          route: '/guide/advanced/topics',
          slug: Slug.from('topics'),
          publishedAt: new Date(),
        },
      ],
    };

    // Simulate custom HTML content extracted from custom index files
    const customIndexesHtml = new Map<string, string>();
    for (const config of customIndexConfigs) {
      // Normalize folderPath to match what rebuildIndex expects
      const key = config.folderPath || '/';
      const normalizedKey = key.startsWith('/') ? key : `/${key}`;

      customIndexesHtml.set(
        normalizedKey,
        `<p>Custom ${config.folderPath || 'root'} index content from ${config.indexFilePath}</p>`
      );
    }

    // Log pour debugging
    logger.debug('Custom indexes map keys', {
      keys: Array.from(customIndexesHtml.keys()),
    });

    const manifestPort = new ManifestFileSystem(testContentRoot, logger);
    await manifestPort.rebuildIndex(manifest, customIndexesHtml);

    // Verify that all indexes were generated with custom content
    const rootIndexPath = path.join(testContentRoot, 'index.html');
    const rootIndexHtml = await fs.readFile(rootIndexPath, 'utf8');

    logger.debug('Root index HTML', {
      contains: rootIndexHtml.includes('Custom') ? 'YES' : 'NO',
      preview: rootIndexHtml.substring(0, 500),
    });

    expect(rootIndexHtml).toContain('Custom');
    expect(rootIndexHtml).toContain('_index.md');

    // Guide index
    const guideIndexPath = path.join(testContentRoot, 'guide', 'index.html');
    const guideIndexHtml = await fs.readFile(guideIndexPath, 'utf8');

    logger.debug('Guide index HTML', {
      contains: guideIndexHtml.includes('Custom /guide') ? 'YES' : 'NO',
      preview: guideIndexHtml.substring(0, 500),
    });

    expect(guideIndexHtml).toContain('Custom /guide');
    expect(guideIndexHtml).toContain('Getting Started');

    // API index
    const apiIndexPath = path.join(testContentRoot, 'api', 'index.html');
    const apiIndexHtml = await fs.readFile(apiIndexPath, 'utf8');

    logger.debug('API index HTML', {
      contains: apiIndexHtml.includes('Custom') ? 'YES' : 'NO',
      preview: apiIndexHtml.substring(0, 500),
    });

    expect(apiIndexHtml).toContain('Custom');
    expect(apiIndexHtml).toContain('API Reference');

    // Deep nested index
    const deepIndexPath = path.join(testContentRoot, 'guide', 'advanced', 'index.html');
    const deepIndexHtml = await fs.readFile(deepIndexPath, 'utf8');

    logger.debug('Deep index HTML', {
      contains: deepIndexHtml.includes('Custom /guide/advanced') ? 'YES' : 'NO',
      preview: deepIndexHtml.substring(0, 500),
    });

    expect(deepIndexHtml).toContain('Custom /guide/advanced');
    expect(deepIndexHtml).toContain('Advanced Topics');
  });

  it('should handle missing custom index gracefully for some folders', async () => {
    const manifest: Manifest = {
      sessionId: 'test-session',
      createdAt: new Date(),
      lastUpdatedAt: new Date(),
      pages: [
        {
          id: 'page-1',
          title: 'Guide Page',
          route: '/guide/page',
          slug: Slug.from('page'),
          publishedAt: new Date(),
        },
        {
          id: 'page-2',
          title: 'API Page',
          route: '/api/page',
          slug: Slug.from('page'),
          publishedAt: new Date(),
        },
      ],
    };

    // Only provide custom content for guide, not for api
    const customIndexesHtml = new Map<string, string>([
      ['/guide', '<p>Custom guide content</p>'],
      // /api intentionally missing
    ]);

    const manifestPort = new ManifestFileSystem(testContentRoot, logger);
    await manifestPort.rebuildIndex(manifest, customIndexesHtml);

    // Guide should have custom content
    const guideIndexPath = path.join(testContentRoot, 'guide', 'index.html');
    const guideIndexHtml = await fs.readFile(guideIndexPath, 'utf8');
    expect(guideIndexHtml).toContain('Custom guide content');

    // API should have auto-generated index without custom content
    const apiIndexPath = path.join(testContentRoot, 'api', 'index.html');
    const apiIndexHtml = await fs.readFile(apiIndexPath, 'utf8');
    expect(apiIndexHtml).not.toContain('Custom');
    expect(apiIndexHtml).toContain('API Page');
  });

  it('should prioritize exact folder match over partial matches', async () => {
    const manifest: Manifest = {
      sessionId: 'test-session',
      createdAt: new Date(),
      lastUpdatedAt: new Date(),
      pages: [
        {
          id: 'page-1',
          title: 'Guide Page',
          route: '/guide/page',
          slug: Slug.from('page'),
          publishedAt: new Date(),
        },
        {
          id: 'page-2',
          title: 'Guide Advanced Page',
          route: '/guide/advanced/page',
          slug: Slug.from('page'),
          publishedAt: new Date(),
        },
      ],
    };

    const customIndexesHtml = new Map<string, string>([
      ['/guide', '<p>General guide index</p>'],
      ['/guide/advanced', '<p>Advanced guide index</p>'],
    ]);

    const manifestPort = new ManifestFileSystem(testContentRoot, logger);
    await manifestPort.rebuildIndex(manifest, customIndexesHtml);

    // /guide index should have general guide index
    const guideIndexPath = path.join(testContentRoot, 'guide', 'index.html');
    const guideIndexHtml = await fs.readFile(guideIndexPath, 'utf8');
    expect(guideIndexHtml).toContain('General guide index');
    expect(guideIndexHtml).not.toContain('Advanced guide index');

    // /guide/advanced index should have advanced guide index
    const advancedIndexPath = path.join(testContentRoot, 'guide', 'advanced', 'index.html');
    const advancedIndexHtml = await fs.readFile(advancedIndexPath, 'utf8');
    expect(advancedIndexHtml).toContain('Advanced guide index');
    expect(advancedIndexHtml).not.toContain('General guide index');
  });
});
