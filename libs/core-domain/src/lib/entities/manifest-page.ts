import type { Slug } from '../value-objects/slug.value-object';
import type { LeafletBlock } from './leaflet-block';

export interface ManifestPage {
  id: string;
  title: string;
  slug: Slug;
  route: string;
  description?: string;
  publishedAt: Date;

  /**
   * Optional display name for the folder/route this page belongs to
   * Used in navigation breadcrumbs and folder indexes
   * Falls back to humanized route segment if not set
   */
  folderDisplayName?: string;

  vaultPath?: string;
  relativePath?: string;
  tags?: string[];
  leafletBlocks?: LeafletBlock[];

  /**
   * Indicates if this page is a custom index file
   * Custom indexes should not appear in vault explorer
   */
  isCustomIndex?: boolean;
}
