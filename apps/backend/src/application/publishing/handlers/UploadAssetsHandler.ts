import { AssetStoragePort } from '../ports/AssetsStoragePort';
import { LoggerPort } from '../../ports/LoggerPort';
import { UploadAssetsCommand, UploadAssetsResult } from '../commands/UploadAssetsCommand';
import { CommandHandler } from '../../common/CommandHandler';

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
