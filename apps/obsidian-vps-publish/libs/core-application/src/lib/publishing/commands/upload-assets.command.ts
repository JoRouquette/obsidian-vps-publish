import { type Asset } from '@core-domain';

export interface UploadAssetsCommand {
  sessionId: string;
  assets: Asset[];
  deduplicationEnabled?: boolean;
}

export interface UploadAssetsResult {
  sessionId: string;
  /** Number of new assets uploaded */
  published: number;
  /** Number of duplicate assets skipped (hash collision) */
  skipped?: number;
  /** List of skipped asset paths (for logging/debugging) */
  skippedAssets?: string[];
  /**
   * Mapping of original asset paths to final paths (e.g., image.png → image.webp)
   * Used to update references in rendered HTML when image format changes
   */
  renamedAssets?: Record<string, string>;
  errors?: { assetName: string; message: string }[];
}
