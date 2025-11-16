import { StoragePort } from './StoragePort';

export interface ContentStoragePort extends StoragePort {
  /**
   * Persiste une page HTML pour une route donnée.
   * L'adapter décidera comment traduire la route en chemin de fichier.
   */
  save(params: { route: string; html: string; slug?: string }): Promise<void>;
}
