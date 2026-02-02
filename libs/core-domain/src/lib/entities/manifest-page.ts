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

  // SEO-specific fields
  /**
   * Date when the page was last modified
   * Used for sitemap.xml lastmod and JSON-LD dateModified
   */
  lastModifiedAt?: Date;

  /**
   * URL (relative or absolute) to the page's cover image
   * Used for Open Graph og:image and JSON-LD image
   */
  coverImage?: string;

  /**
   * Canonical slug for redirect management
   * When a page's slug changes, the old route should redirect to this canonical route
   */
  canonicalSlug?: string;

  /**
   * Exclude this page from sitemap and search engine indexing
   * Used for draft pages or pages marked as private
   */
  noIndex?: boolean;
}
