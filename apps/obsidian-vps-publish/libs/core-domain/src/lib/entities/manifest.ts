import type { ManifestPage } from './manifest-page';
import type { PipelineSignature } from './pipeline-signature';

/**
 * Supported site locales for PWA and HTML lang attribute.
 * Sent from the plugin settings and stored in the manifest.
 */
export type SiteLocale = 'en' | 'fr';

/**
 * Represents an asset entry in the manifest with hash for deduplication
 */
export interface ManifestAsset {
  /** Relative path of the asset (e.g., "_assets/image.png") */
  path: string;
  /** SHA256 hash of the asset content */
  hash: string;
  /** Size in bytes */
  size: number;
  /** Detected MIME type */
  mimeType: string;
  /** Upload timestamp */
  uploadedAt: Date;
}

export interface Manifest {
  sessionId: string;
  createdAt: Date;
  lastUpdatedAt: Date;
  pages: ManifestPage[];

  /**
   * Site locale for HTML lang attribute and PWA manifest.
   * Sent from the plugin settings (en, fr, or resolved from system).
   * Defaults to 'fr' if not specified.
   */
  locale?: SiteLocale;

  /**
   * Optional mapping of route paths to their display names
   * Used to preserve display names for folders even when no pages exist directly in them
   * Example: { "/tresors": "Trésors", "/pantheon": "Panthéon" }
   */
  folderDisplayNames?: Record<string, string>;

  /**
   * Mapping of old routes to new routes for 301 redirects
   * Used to handle slug changes and prevent broken links
   * Example: { "/old-route": "/new-route", "/legacy-page": "/current-page" }
   */
  canonicalMap?: Record<string, string>;

  /**
   * Optional array of uploaded assets with hash for deduplication
   * Enables skipping re-upload of identical files
   */
  assets?: ManifestAsset[];

  /**
   * Signature of the rendering pipeline configuration
   * Used to detect when pipeline settings change (version, renderSettingsHash)
   * When signature changes, all notes must be re-rendered
   */
  pipelineSignature?: PipelineSignature;

  /**
   * Unique identifier of the publication that produced this manifest.
   * Generated once per finalization job (`crypto.randomUUID()`).
   * Embedded in both manifest and search-index so consumers can verify
   * they are reading a coherent state.
   */
  contentRevision?: string;
}

export const defaultManifest: Manifest = {
  sessionId: '',
  createdAt: new Date(0),
  lastUpdatedAt: new Date(0),
  pages: [],
};
