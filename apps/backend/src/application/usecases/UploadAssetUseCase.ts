import { StoragePort } from '../ports/StoragePort';

export interface UploadAssetCommand {
  noteId: string;
  noteRoute: string;
  relativeAssetPath: string;
  fileName: string;
  content: Buffer;
}

export class UploadAssetUseCase {
  constructor(private readonly assetStorage: StoragePort) {}

  async execute(command: UploadAssetCommand): Promise<void> {
    await this.assetStorage.save({
      route: command.relativeAssetPath,
      content: command.content,
    });
  }
}
