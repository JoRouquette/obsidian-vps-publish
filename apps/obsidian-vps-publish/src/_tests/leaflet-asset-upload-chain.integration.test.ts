import { DetectAssetsService } from '@core-application/vault-parsing/services/detect-assets.service';
import { DetectLeafletBlocksService } from '@core-application/vault-parsing/services/detect-leaflet-blocks.service';
import type { LoggerPort, PublishableNote } from '@core-domain';

import { AssetsUploaderAdapter } from '../lib/infra/assets-uploader.adapter';
import { AssetHashService } from '../lib/infra/crypto/asset-hash.service';
import { ObsidianAssetsVaultAdapter } from '../lib/infra/obsidian-assets-vault.adapter';

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

describe('Leaflet asset upload chain (plugin side)', () => {
  it('keeps Ektaron.png through parser/resolution and does not client-dedup against an optimized production hash', async () => {
    const logger = new NullLogger();
    const pngBytes = Buffer.from('raw-png-bytes');
    const webpBytes = Buffer.from('optimized-webp-bytes');

    const parsedNote = new DetectAssetsService(logger).process(
      new DetectLeafletBlocksService(logger).process([createSourceNote()])
    )[0];

    expect(parsedNote.leafletBlocks?.[0].imageOverlays?.[0].path).toBe('Ektaron.png');
    expect(parsedNote.assets?.[0].target).toBe('Ektaron.png');

    const app = {
      vault: {
        getFiles: jest.fn().mockReturnValue([
          {
            path: '_assets/Ektaron.png',
            name: 'Ektaron.png',
          },
        ]),
        readBinary: jest.fn().mockResolvedValue(pngBytes),
      },
    } as any;

    const vaultAdapter = new ObsidianAssetsVaultAdapter(app, logger);
    const resolvedAssets = await vaultAdapter.resolveAssetsFromNotes([parsedNote], '_assets', true);

    expect(resolvedAssets).toHaveLength(1);
    expect(resolvedAssets[0].vaultPath).toBe('_assets/Ektaron.png');
    expect(resolvedAssets[0].fileName).toBe('Ektaron.png');
    expect(resolvedAssets[0].relativeAssetPath).toBe('Ektaron.png');

    const sessionClient = {
      uploadAssetChunk: jest.fn().mockResolvedValue(undefined),
    } as any;

    const uploader = new AssetsUploaderAdapter(
      sessionClient,
      'session-2',
      {
        generateGuid: jest.fn().mockReturnValue('guid-1'),
      },
      new AssetHashService(),
      logger,
      1024,
      undefined,
      1,
      [await new AssetHashService().computeHash(webpBytes)]
    );

    const apiAsset = await (uploader as any).buildApiAsset(resolvedAssets[0]);
    expect(apiAsset.relativePath).toBe('Ektaron.png');

    await uploader.upload(resolvedAssets);

    expect(sessionClient.uploadAssetChunk).toHaveBeenCalled();
  });
});
