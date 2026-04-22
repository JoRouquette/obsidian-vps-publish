/**
 * Statistics returned by session promotion (manifest merge + deduplication)
 */
export interface PromotionStats {
  /** New or modified notes from staging */
  notesPublished: number;

  /** Unchanged notes kept from production (deduplicated) */
  notesDeduplicated: number;

  /** Notes deleted (present in production, absent from vault) */
  notesDeleted: number;

  /** New or modified assets from staging */
  assetsPublished: number;

  /** Unchanged assets kept from production (deduplicated) */
  assetsDeduplicated: number;
}
