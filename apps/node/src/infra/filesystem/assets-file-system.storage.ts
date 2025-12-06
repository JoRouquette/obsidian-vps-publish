import fs from 'node:fs/promises';
import path from 'node:path';

import { type AssetStoragePort, type LoggerPort } from '@core-application';

import { resolveWithinRoot } from '../utils/path-utils.util';

export class AssetsFileSystemStorage implements AssetStoragePort {
  constructor(
    private readonly assetsRoot: string,
    private readonly logger?: LoggerPort
  ) {}

  async save(params: { filename: string; content: Uint8Array }[]): Promise<void> {
    const savePromises = params.map(({ filename, content }) =>
      this.saveSingleAsset(filename, content)
    );
    await Promise.all(savePromises);
  }

  private async saveSingleAsset(relativeAssetPath: string, content: Uint8Array): Promise<void> {
    const normalizedRelative = relativeAssetPath.replace(/^[/\\]+/, '');
    const fullPath = resolveWithinRoot(this.assetsRoot, normalizedRelative);

    const dir = path.dirname(fullPath);

    try {
      await fs.mkdir(dir, { recursive: true });
      await fs.writeFile(fullPath, content);
      this.logger?.debug('Asset saved to filesystem', {
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
