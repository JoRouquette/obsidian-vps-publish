import { AssetsIndexPort } from '../../application/ports/AssetsIndexPort';
import { LoggerPort } from '../../application/ports/LoggerPort';

export class AssetsFileSystem implements AssetsIndexPort {
  constructor(
    private readonly assetsRoot: string,
    private readonly logger?: LoggerPort
  ) {
    this.logger = logger?.child({ module: 'AssetsFileSystem' });
  }

  save(params: unknown, logger?: LoggerPort): Promise<void> {
    throw new Error('Method not implemented.');
  }

  rebuildIndex(params: unknown, logger?: LoggerPort): Promise<void> {
    throw new Error('Method not implemented.');
  }
}
