import { type AssetValidatorPort, type LoggerPort } from '@core-domain';

import { type CommandHandler } from '../../common/command-handler';
import {
  type UploadAssetsCommand,
  type UploadAssetsResult,
} from '../commands/upload-assets.command';
import { type AssetStoragePort } from '../ports/assets-storage.port';

type AssetStorageFactory = (sessionId: string) => AssetStoragePort;

export class UploadAssetsHandler implements CommandHandler<
  UploadAssetsCommand,
  UploadAssetsResult
> {
  private readonly _logger;

  constructor(
    private readonly assetStorage: AssetStoragePort | AssetStorageFactory,
    private readonly assetValidator?: AssetValidatorPort,
    private readonly maxAssetSizeBytes?: number,
    logger?: LoggerPort
  ) {
    this._logger = logger?.child({
      handler: 'UploadAssetHandler',
    });
    this._logger?.debug('UploadAssetHandler initialized.', {
      hasValidator: !!assetValidator,
      maxAssetSizeBytes,
    });
  }

  async handle(command: UploadAssetsCommand): Promise<UploadAssetsResult> {
    const storage = this.resolveAssetStorage(command.sessionId);
    const errors: { assetName: string; message: string }[] = [];

    const assets = Array.isArray(command.assets) ? command.assets : [];

    this._logger?.debug(
      `Starting parallel processing of ${assets.length} assets (max 10 concurrent)`
    );

    // Process assets in parallel with controlled concurrency
    const CONCURRENCY = 10;
    const results: PromiseSettledResult<string>[] = [];

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

          await storage.save([{ filename, content }]);
          return filename;
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
      }
    });

    const published = results.filter((r) => r.status === 'fulfilled').length;

    return {
      sessionId: command.sessionId,
      published,
      errors: errors.length ? errors : undefined,
    };
  }

  private resolveAssetStorage(sessionId: string): AssetStoragePort {
    if (typeof this.assetStorage === 'function') {
      return (this.assetStorage as AssetStorageFactory)(sessionId);
    }
    return this.assetStorage;
  }

  private decodeBase64(data: string): Buffer {
    return Buffer.from(data, 'base64');
  }
}
