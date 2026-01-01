import type { Slug } from '../value-objects/slug.value-object';
import type { LeafletBlock } from './leaflet-block';

export interface ManifestPage {
  id: string;
  title: string;
  slug: Slug;
  route: string;
  description?: string;
  publishedAt: Date;

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
