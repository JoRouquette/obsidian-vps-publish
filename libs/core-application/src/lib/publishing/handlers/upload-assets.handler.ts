import { type CommandHandler } from '../../common/command-handler';
import { type LoggerPort } from '../../ports/logger.port';
import {
  type UploadAssetsCommand,
  type UploadAssetsResult,
} from '../commands/upload-assets.command';
import { type AssetStoragePort } from '../ports/assets-storage.port';

type AssetStorageFactory = (sessionId: string) => AssetStoragePort;

export class UploadAssetsHandler
  implements CommandHandler<UploadAssetsCommand, UploadAssetsResult>
{
  private readonly _logger;

  constructor(
    private readonly assetStorage: AssetStoragePort | AssetStorageFactory,
    logger?: LoggerPort
  ) {
    this._logger = logger?.child({
      handler: 'UploadAssetHandler',
    });
    this._logger?.debug('UploadAssetHandler initialized.');
  }

  async handle(command: UploadAssetsCommand): Promise<UploadAssetsResult> {
    const storage = this.resolveAssetStorage(command.sessionId);
    const errors: { assetName: string; message: string }[] = [];
    let published = 0;

    const assets = Array.isArray(command.assets) ? command.assets : [];

    for (const asset of assets) {
      try {
        const filename = asset.relativePath || asset.fileName;
        const content = this.decodeBase64(asset.contentBase64);
        await storage.save([{ filename, content }]);
        published++;
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Unknown error';
        errors.push({ assetName: asset.fileName, message });
        this._logger?.error('Asset upload failed', { asset: asset.fileName, message });
      }
    }

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
