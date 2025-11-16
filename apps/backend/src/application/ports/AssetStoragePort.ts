import { StoragePort } from './StoragePort';

export interface AssetStoragePort extends StoragePort {
  save(params: { relativeAssetPath: string; content: Buffer }): Promise<void>;
}
