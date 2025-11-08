export interface SiteIndexEntry {
  route: string;
  title: string;
  description?: string;
  publishedAt: Date;
  updatedAt: Date;
}

export interface SiteIndexPort {
  /**
   * Met à jour le sommaire global avec les entrées fournies.
   * L'implémentation est responsable de la fusion (upsert) et de la génération du HTML.
   */
  upsertEntries(entries: SiteIndexEntry[]): Promise<void>;
}
