import { IndexPort } from '../ports/IndexPort';
import { LoggerPort } from '../ports/LoggerPort';
import { StoragePort } from '../ports/StoragePort';

export interface UploadAssetCommand {
  noteId: string;
  noteRoute: string;
  relativeAssetPath: string;
  fileName: string;
  content: Buffer;
}

export class UploadAssetUseCase {
  private readonly _logger;

  constructor(
    private readonly assetStorage: StoragePort,
    private readonly assetIndex: IndexPort,
    logger?: LoggerPort
  ) {
    this._logger = logger?.child({
      useCase: 'UploadAssetUseCase',
    });
    this._logger?.debug('UploadAssetUseCase initialized.');
  }

  async execute(command: UploadAssetCommand): Promise<void> {
    await this.assetStorage.save({
      relativeAssetPath: command.relativeAssetPath,
      content: command.content,
    });
  }
}
