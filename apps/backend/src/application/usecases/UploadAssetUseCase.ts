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
  constructor(
    private readonly assetStorage: StoragePort,
    private readonly logger?: LoggerPort
  ) {}

  async execute(command: UploadAssetCommand): Promise<void> {
    await this.assetStorage.save(
      {
        route: command.relativeAssetPath,
        content: command.content,
      },
      this.logger?.child({
        useCase: 'UploadAssetUseCase',
        noteId: command.noteId,
        noteRoute: command.noteRoute,
        assetPath: command.relativeAssetPath,
      })
    );
  }
}
