import fs from 'node:fs/promises';
import path from 'node:path';
import { resolveWithinRoot } from './pathUtils';
import { AssetStoragePort } from '../../application/ports/AssetStoragePort';
import { LoggerPort } from '../../application/ports/LoggerPort';

export class FileSystemAssetStorage implements AssetStoragePort {
  constructor(
    private readonly assetsRoot: string,
    private readonly logger?: LoggerPort
  ) {}

  async save(params: { relativeAssetPath: string; content: Buffer }): Promise<void> {
    const { relativeAssetPath, content } = params;

    const normalizedRelative = relativeAssetPath.replace(/^[/\\]+/, '');
    const fullPath = resolveWithinRoot(this.assetsRoot, normalizedRelative);

    const dir = path.dirname(fullPath);

    try {
      await fs.mkdir(dir, { recursive: true });
      await fs.writeFile(fullPath, content);
      this.logger?.info('Asset saved to filesystem', {
        relativeAssetPath,
        fullPath,
        size: content.length,
      });
    } catch (error) {
      this.logger?.error('Failed to save asset to filesystem', {
        relativeAssetPath,
        fullPath,
        error,
      });
      throw error;
    }
  }
}
