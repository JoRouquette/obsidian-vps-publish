import { AssetStoragePort } from '../ports/assets-storage.port';
import { LoggerPort } from '../../ports/logger.port';
import { UploadAssetsCommand, UploadAssetsResult } from '../commands/upload-assets.command';
import { CommandHandler } from '../../common/command-handler';

export class UploadAssetsHandler
  implements CommandHandler<UploadAssetsCommand, UploadAssetsResult>
{
  private readonly _logger;

  constructor(
    private readonly assetStorage: AssetStoragePort,
    logger?: LoggerPort
  ) {
    this._logger = logger?.child({
      handler: 'UploadAssetHandler',
    });
    this._logger?.debug('UploadAssetHandler initialized.');
  }

  async handle(command: UploadAssetsCommand): Promise<UploadAssetsResult> {
    return {
      sessionId: command.sessionId,
      published: 0,
    };
  }
}
