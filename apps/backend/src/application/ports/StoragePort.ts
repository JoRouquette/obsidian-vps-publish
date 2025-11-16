export interface StoragePort {
  /**
   * Persiste une page HTML pour une route donnée.
   * L'adapter décidera comment traduire la route en chemin de fichier.
   */
  save(params: unknown): Promise<void>;
}
