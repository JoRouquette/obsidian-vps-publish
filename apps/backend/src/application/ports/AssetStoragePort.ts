import { StoragePort } from './StoragePort';

export interface AssetStoragePort extends StoragePort {
  save(params: { filename: string; content: Buffer }): Promise<void>;
}
