import { FolderConfig } from '../FolderConfig';

export interface VaultPort<T> {
  collectFromFolder(folder: FolderConfig): Promise<T>;
}
