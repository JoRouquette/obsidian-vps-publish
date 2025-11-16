import fs from 'node:fs/promises';
import path from 'node:path';
import { resolveWithinRoot } from './pathUtils';
import { AssetStoragePort } from '../../application/ports/AssetStoragePort';

export class FileSystemAssetStorage implements AssetStoragePort {
  constructor(private readonly assetsRoot: string) {}

  async save(params: { relativeAssetPath: string; content: Buffer }): Promise<void> {
    const { relativeAssetPath, content } = params;

    const normalizedRelative = relativeAssetPath.replace(/^[/\\]+/, '');
    const fullPath = resolveWithinRoot(this.assetsRoot, normalizedRelative);

    const dir = path.dirname(fullPath);
    await fs.mkdir(dir, { recursive: true });
    await fs.writeFile(fullPath, content);
  }
}
