import { promises as fs } from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';

import { CreateSessionHandler, UploadAssetsHandler, UploadNotesHandler } from '@core-application';
import { NoteHashService } from '@core-application/publishing/services/note-hash.service';
import { DetectAssetsService } from '@core-application/vault-parsing/services/detect-assets.service';
import { DetectLeafletBlocksService } from '@core-application/vault-parsing/services/detect-leaflet-blocks.service';
import type { ImageOptimizerPort, LoggerPort, Manifest, PublishableNote } from '@core-domain';
import { afterEach, beforeEach, describe, expect, it } from '@jest/globals';

import { AssetsFileSystemStorage } from '../infra/filesystem/assets-file-system.storage';
import { FileSystemSessionRepository } from '../infra/filesystem/file-system-session.repository';
import { ManifestFileSystem } from '../infra/filesystem/manifest-file-system';
import { NotesFileSystemStorage } from '../infra/filesystem/notes-file-system.storage';
import { SessionNotesFileStorage } from '../infra/filesystem/session-notes-file.storage';
import { StagingManager } from '../infra/filesystem/staging-manager';
import { CalloutRendererService } from '../infra/markdown/callout-renderer.service';
import { MarkdownItRenderer } from '../infra/markdown/markdown-it.renderer';
import { SessionFinalizerService } from '../infra/sessions/session-finalizer.service';
import { AssetHashService } from '../infra/utils/asset-hash.service';

class NullLogger implements LoggerPort {
  private currentLevel = 4;

  set level(level: number) {
    this.currentLevel = level;
  }

  get level(): number {
    return this.currentLevel;
  }

  child(): LoggerPort {
    return this;
  }
  debug(): void {}
  info(): void {}
  warn(): void {}
  error(): void {}
}

class SequentialIdGenerator {
  private current = 0;

  generateId(): string {
    this.current += 1;
    return `session-${this.current}`;
  }
}

function createSourceNote(): PublishableNote {
  return {
    noteId: 'ektaron-note',
    title: 'Ektaron',
    vaultPath: 'Ektaron/Ektaron.md',
    relativePath: 'Ektaron/Ektaron.md',
    content: [
      '## Carte',
      '',
      '```leaflet',
      'id: Ektaron-map',
      'image: [[Ektaron.png]]',
      'height: 700px',
      'scale: 1365',
      '```',
    ].join('\n'),
    frontmatter: {
      flat: {},
      nested: {},
      tags: [],
    },
    folderConfig: {
      id: 'folder-1',
      vaultFolder: 'Ektaron',
      routeBase: '/worlds',
      vpsId: 'vps-1',
      ignoredCleanupRuleIds: [],
    },
    routing: {
      slug: 'ektaron',
      path: '/worlds',
      fullPath: '/worlds/ektaron',
      routeBase: '/worlds',
    },
    eligibility: {
      isPublishable: true,
    },
    publishedAt: new Date('2026-03-16T10:00:00.000Z'),
    resolvedWikilinks: [],
  };
}

function createParsedNote(logger: LoggerPort): PublishableNote {
  return new DetectAssetsService(logger).process(
    new DetectLeafletBlocksService(logger).process([createSourceNote()])
  )[0];
}

function createOptimizer(webpBytes: Buffer): ImageOptimizerPort {
  return {
    isOptimizable: jest.fn().mockReturnValue(true),
    optimize: jest.fn().mockResolvedValue({
      data: new Uint8Array(webpBytes),
      format: 'webp',
      originalFilename: 'Ektaron.png',
      optimizedFilename: 'Ektaron.webp',
      originalSize: 1024,
      optimizedSize: webpBytes.length,
      width: 100,
      height: 100,
      wasOptimized: true,
    }),
    getConfig: jest.fn().mockReturnValue({
      enabled: true,
      convertToWebp: true,
      quality: 85,
      maxWidth: 4096,
      maxHeight: 4096,
      maxSizeBytes: 10 * 1024 * 1024,
      preserveFormat: false,
    }),
  };
}

function routeToHtmlPath(root: string, route: string): string {
  const segments = route.split('/').filter(Boolean);
  const fileName = `${segments[segments.length - 1]}.html`;
  return path.join(root, ...segments.slice(0, -1), fileName);
}

describe('Leaflet asset republication integration', () => {
  let tempDir: string;
  let contentRoot: string;
  let assetsRoot: string;
  let sessionsRoot: string;
  let logger: LoggerPort;
  let stagingManager: StagingManager;
  let sessionRepository: FileSystemSessionRepository;
  let productionManifestStorage: ManifestFileSystem;
  let createSessionHandler: CreateSessionHandler;
  let uploadNotesHandler: UploadNotesHandler;
  let uploadAssetsHandler: UploadAssetsHandler;
  let sessionFinalizer: SessionFinalizerService;
  let assetHasher: AssetHashService;
  let pngBytes: Buffer;
  let webpBytes: Buffer;

  beforeEach(async () => {
    tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'leaflet-assets-'));
    contentRoot = path.join(tempDir, 'content');
    assetsRoot = path.join(tempDir, 'assets');
    sessionsRoot = path.join(tempDir, 'sessions');

    await fs.mkdir(contentRoot, { recursive: true });
    await fs.mkdir(assetsRoot, { recursive: true });
    await fs.mkdir(sessionsRoot, { recursive: true });

    logger = new NullLogger();
    pngBytes = Buffer.from('raw-png-bytes');
    webpBytes = Buffer.from('optimized-webp-bytes');

    stagingManager = new StagingManager(contentRoot, assetsRoot, logger);
    sessionRepository = new FileSystemSessionRepository(sessionsRoot);
    productionManifestStorage = new ManifestFileSystem(contentRoot, logger);
    assetHasher = new AssetHashService();

    const sessionNotesStorage = new SessionNotesFileStorage(contentRoot, logger);
    const markdownRenderer = new MarkdownItRenderer(new CalloutRendererService(), logger);

    createSessionHandler = new CreateSessionHandler(
      new SequentialIdGenerator(),
      sessionRepository,
      productionManifestStorage,
      logger
    );

    uploadNotesHandler = new UploadNotesHandler(
      markdownRenderer,
      (sessionId) =>
        new NotesFileSystemStorage(stagingManager.contentStagingPath(sessionId), logger),
      (sessionId) => new ManifestFileSystem(stagingManager.contentStagingPath(sessionId), logger),
      logger,
      sessionNotesStorage,
      undefined,
      new NoteHashService()
    );

    uploadAssetsHandler = new UploadAssetsHandler(
      (sessionId) =>
        new AssetsFileSystemStorage(stagingManager.assetsStagingPath(sessionId), logger),
      (sessionId) => new ManifestFileSystem(stagingManager.contentStagingPath(sessionId), logger),
      assetHasher,
      undefined,
      undefined,
      createOptimizer(webpBytes),
      logger
    );

    sessionFinalizer = new SessionFinalizerService(
      sessionNotesStorage,
      stagingManager,
      markdownRenderer,
      (sessionId) =>
        new NotesFileSystemStorage(stagingManager.contentStagingPath(sessionId), logger),
      (sessionId) => new ManifestFileSystem(stagingManager.contentStagingPath(sessionId), logger),
      sessionRepository,
      logger
    );
  });

  afterEach(async () => {
    await fs.rm(tempDir, { recursive: true, force: true });
  });

  it('publishes a Leaflet image overlay coherently across two publications', async () => {
    const route = '/worlds/ektaron';
    const finalAssetPath = path.join(assetsRoot, 'Ektaron.webp');

    const publishOnce = async () => {
      const parsedNote = createParsedNote(logger);
      const createResult = await createSessionHandler.handle({
        notesPlanned: 1,
        assetsPlanned: 1,
        batchConfig: {
          maxBytesPerRequest: 1024 * 1024,
        },
      });

      const sessionId = createResult.sessionId;
      const stagingManifestStorage = new ManifestFileSystem(
        stagingManager.contentStagingPath(sessionId),
        logger
      );

      await uploadNotesHandler.handle({
        sessionId,
        notes: [parsedNote],
      });

      const preAssetsManifest = await stagingManifestStorage.load();

      const uploadResult = await uploadAssetsHandler.handle({
        sessionId,
        assets: [
          {
            relativePath: 'Ektaron.png',
            vaultPath: '_assets/Ektaron.png',
            fileName: 'Ektaron.png',
            mimeType: 'image/png',
            contentBase64: pngBytes.toString('base64'),
          },
        ],
      });

      const session = await sessionRepository.findById(sessionId);
      if (session && uploadResult.renamedAssets) {
        await sessionRepository.save({
          ...session,
          assetPathMappings: {
            ...(session.assetPathMappings ?? {}),
            ...uploadResult.renamedAssets,
          },
        });
      }

      const postAssetsManifest = await stagingManifestStorage.load();
      await sessionFinalizer.rebuildFromStored(sessionId);
      const postFinalizerManifest = await stagingManifestStorage.load();
      const stagingRoute = postFinalizerManifest!.pages[0].route;
      const stagingHtml = await fs.readFile(
        routeToHtmlPath(stagingManager.contentStagingPath(sessionId), stagingRoute),
        'utf8'
      );

      await stagingManager.promoteSession(
        sessionId,
        [route],
        undefined,
        undefined,
        `${sessionId}-rev`
      );

      const finalManifest = await productionManifestStorage.load();
      const finalHtml = await fs.readFile(
        routeToHtmlPath(contentRoot, finalManifest!.pages[0].route),
        'utf8'
      );

      return {
        parsedNote,
        createResult,
        uploadResult,
        preAssetsManifest,
        postAssetsManifest,
        postFinalizerManifest,
        stagingHtml,
        finalManifest,
        finalHtml,
      };
    };

    const firstPublication = await publishOnce();
    const secondPublication = await publishOnce();

    expect(firstPublication.parsedNote.leafletBlocks?.[0].imageOverlays?.[0].path).toBe(
      'Ektaron.png'
    );
    expect(firstPublication.parsedNote.assets?.[0].target).toBe('Ektaron.png');
    expect(firstPublication.createResult.existingAssetHashes).toBeUndefined();
    expect(
      firstPublication.preAssetsManifest?.pages[0].leafletBlocks?.[0].imageOverlays?.[0].path
    ).toBe('Ektaron.png');
    expect(firstPublication.uploadResult.published).toBe(1);
    expect(firstPublication.uploadResult.skipped).toBeUndefined();
    expect(firstPublication.uploadResult.renamedAssets).toEqual({
      'Ektaron.png': 'Ektaron.webp',
    });
    expect(firstPublication.postAssetsManifest?.assets?.[0].path).toBe('Ektaron.webp');
    expect(firstPublication.postFinalizerManifest?.assets).toBeUndefined();
    expect(
      firstPublication.postFinalizerManifest?.pages[0].leafletBlocks?.[0].imageOverlays?.[0].path
    ).toBe('Ektaron.webp');
    expect(firstPublication.finalManifest?.assets).toBeUndefined();

    expect(secondPublication.parsedNote.leafletBlocks?.[0].imageOverlays?.[0].path).toBe(
      'Ektaron.png'
    );
    expect(secondPublication.createResult.existingAssetHashes).toBeUndefined();
    expect(
      secondPublication.preAssetsManifest?.pages[0].leafletBlocks?.[0].imageOverlays?.[0].path
    ).toBe('Ektaron.png');
    expect(secondPublication.uploadResult.published).toBe(1);
    expect(secondPublication.uploadResult.skipped).toBeUndefined();
    expect(secondPublication.uploadResult.renamedAssets).toEqual({
      'Ektaron.png': 'Ektaron.webp',
    });
    expect(secondPublication.postAssetsManifest?.assets?.[0].path).toBe('Ektaron.webp');
    expect(secondPublication.postFinalizerManifest?.assets).toBeUndefined();
    expect(
      secondPublication.postFinalizerManifest?.pages[0].leafletBlocks?.[0].imageOverlays?.[0].path
    ).toBe('Ektaron.webp');

    expect(secondPublication.stagingHtml).toContain('data-leaflet-map-id="Ektaron-map"');
    expect(secondPublication.stagingHtml).not.toContain('data-leaflet-block=');
    expect(secondPublication.finalHtml).toContain('data-leaflet-map-id="Ektaron-map"');
    expect(secondPublication.finalHtml).not.toContain('data-leaflet-block=');

    expect(secondPublication.finalManifest?.assets).toBeUndefined();
    expect(
      secondPublication.finalManifest?.pages[0].leafletBlocks?.[0].imageOverlays?.[0].path
    ).toBe('Ektaron.webp');

    await expect(fs.access(finalAssetPath)).resolves.toBeUndefined();

    const frontendUrl = `/assets/${encodeURI(
      secondPublication.finalManifest!.pages[0].leafletBlocks![0].imageOverlays![0].path
    )}`;
    expect(frontendUrl).toBe('/assets/Ektaron.webp');
  });
});
