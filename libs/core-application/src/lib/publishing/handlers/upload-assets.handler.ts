import {
  type AssetHashPort,
  type AssetValidatorPort,
  type LoggerPort,
  type ManifestAsset,
} from '@core-domain';

import { type CommandHandler } from '../../common/command-handler';
import {
  type UploadAssetsCommand,
  type UploadAssetsResult,
} from '../commands/upload-assets.command';
import { type AssetStoragePort } from '../ports/assets-storage.port';
import { type ManifestPort } from '../ports/manifest-storage.port';

type AssetStorageFactory = (sessionId: string) => AssetStoragePort;
type ManifestStorageFactory = (sessionId: string) => ManifestPort;

export class UploadAssetsHandler implements CommandHandler<
  UploadAssetsCommand,
  UploadAssetsResult
> {
  private readonly _logger;

  constructor(
    private readonly assetStorage: AssetStoragePort | AssetStorageFactory,
    private readonly manifestStorage?: ManifestPort | ManifestStorageFactory,
    private readonly assetHasher?: AssetHashPort,
    private readonly assetValidator?: AssetValidatorPort,
    private readonly maxAssetSizeBytes?: number,
    logger?: LoggerPort
  ) {
    this._logger = logger?.child({
      handler: 'UploadAssetHandler',
    });
    this._logger?.debug('UploadAssetHandler initialized.', {
      hasValidator: !!assetValidator,
      hasManifest: !!manifestStorage,
      hasHasher: !!assetHasher,
      maxAssetSizeBytes,
    });
  }

  async handle(command: UploadAssetsCommand): Promise<UploadAssetsResult> {
    const storage = this.resolveAssetStorage(command.sessionId);
    const manifest = this.manifestStorage ? this.resolveManifestStorage(command.sessionId) : null;

    const errors: { assetName: string; message: string }[] = [];
    const skippedAssets: string[] = [];
    const allStagedAssets: ManifestAsset[] = [];

    const assets = Array.isArray(command.assets) ? command.assets : [];

    // Load existing manifest if available (from production)
    const existingManifest = manifest ? await manifest.load() : null;
    const existingAssetsByHash = new Map<string, ManifestAsset>();

    if (existingManifest?.assets) {
      for (const asset of existingManifest.assets) {
        existingAssetsByHash.set(asset.hash, asset);
      }
    }

    this._logger?.debug(
      `Starting parallel processing of ${assets.length} assets (max 10 concurrent)`,
      {
        existingAssetsCount: existingAssetsByHash.size,
      }
    );

    // Process assets in parallel with controlled concurrency
    const CONCURRENCY = 10;
    const results: PromiseSettledResult<{ filename: string; skipped: boolean }>[] = [];

    for (let i = 0; i < assets.length; i += CONCURRENCY) {
      const batch = assets.slice(i, Math.min(i + CONCURRENCY, assets.length));
      const batchResults = await Promise.allSettled(
        batch.map(async (asset) => {
          const filename = asset.relativePath || asset.fileName;
          const content = this.decodeBase64(asset.contentBase64);

          // Validate asset (size + real MIME detection) if validator is configured
          if (this.assetValidator) {
            const validationResult = await this.assetValidator.validate(
              content,
              filename,
              asset.mimeType,
              this.maxAssetSizeBytes
            );

            // Replace client MIME with detected MIME for security
            asset.mimeType = validationResult.detectedMimeType;

            this._logger?.debug('Asset validated', {
              filename,
              sizeBytes: validationResult.sizeBytes,
              detectedMimeType: validationResult.detectedMimeType,
            });
          }

          // Compute hash for deduplication (if hasher is available)
          const hash = this.assetHasher ? await this.assetHasher.computeHash(content) : undefined;

          // Check if asset with this hash already exists
          if (hash) {
            const existingAsset = existingAssetsByHash.get(hash);
            if (existingAsset) {
              this._logger?.info('Asset already exists (duplicate hash), skipping upload', {
                filename,
                hash,
                existingPath: existingAsset.path,
              });
              // Add existing asset to staged manifest (preserve reference)
              allStagedAssets.push(existingAsset);
              return { filename, skipped: true };
            }
          }

          // New asset - save to storage
          await storage.save([{ filename, content }]);

          // Track new asset for manifest update (if hash is available)
          if (hash) {
            const manifestAsset: ManifestAsset = {
              path: filename,
              hash,
              size: content.length,
              mimeType: asset.mimeType,
              uploadedAt: new Date(),
            };
            allStagedAssets.push(manifestAsset);

            this._logger?.debug('New asset uploaded', {
              filename,
              hash,
              size: content.length,
              mimeType: asset.mimeType,
            });
          }

          return { filename, skipped: false };
        })
      );
      results.push(...batchResults);
    }

    // Aggregate results
    results.forEach((result, idx) => {
      if (result.status === 'rejected') {
        const asset = assets[idx];
        const message = result.reason instanceof Error ? result.reason.message : 'Unknown error';
        errors.push({ assetName: asset.fileName, message });
        this._logger?.error('Asset upload failed', { asset: asset.fileName, message });
      } else if (result.value.skipped) {
        skippedAssets.push(result.value.filename);
      }
    });

    const published = results.filter((r) => r.status === 'fulfilled' && !r.value.skipped).length;
    const skipped = skippedAssets.length;

    // Update manifest with all staged assets (existing + new)
    // This ensures the staging manifest contains all referenced assets
    if (manifest && allStagedAssets.length > 0 && existingManifest) {
      await manifest.save({
        ...existingManifest,
        assets: allStagedAssets,
        lastUpdatedAt: new Date(),
      });

      this._logger?.info('Manifest updated with all staged assets', {
        stagedAssetsCount: allStagedAssets.length,
        newCount: published,
        skippedCount: skipped,
      });
    }

    return {
      sessionId: command.sessionId,
      published,
      skipped: skipped > 0 ? skipped : undefined,
      skippedAssets: skippedAssets.length > 0 ? skippedAssets : undefined,
      errors: errors.length ? errors : undefined,
    };
  }

  private resolveAssetStorage(sessionId: string): AssetStoragePort {
    if (typeof this.assetStorage === 'function') {
      return (this.assetStorage as AssetStorageFactory)(sessionId);
    }
    return this.assetStorage;
  }

  private resolveManifestStorage(sessionId: string): ManifestPort {
    if (!this.manifestStorage) {
      throw new Error('ManifestStorage not configured');
    }
    if (typeof this.manifestStorage === 'function') {
      return (this.manifestStorage as ManifestStorageFactory)(sessionId);
    }
    return this.manifestStorage;
  }

  private decodeBase64(data: string): Buffer {
    return Buffer.from(data, 'base64');
  }
}
