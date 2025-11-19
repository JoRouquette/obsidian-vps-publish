import { Asset } from '../../domain/entities/Asset';
import { AssetStoragePort } from '../ports/AssetStoragePort';
import { LoggerPort } from '../ports/LoggerPort';

export class UploadAssetUseCase {
  private readonly _logger;

  constructor(
    private readonly assetStorage: AssetStoragePort,
    logger?: LoggerPort
  ) {
    this._logger = logger?.child({
      useCase: 'UploadAssetUseCase',
    });
    this._logger?.debug('UploadAssetUseCase initialized.');
  }

  async execute(asset: Asset, content: Buffer): Promise<void> {
    await this.assetStorage.save({
      filename: asset.fileName,
      content,
    });
  }
}
