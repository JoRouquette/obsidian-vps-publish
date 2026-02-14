import { type Asset } from '@core-domain';

export interface UploadAssetsCommand {
  sessionId: string;
  assets: Asset[];
}

export interface UploadAssetsResult {
  sessionId: string;
  /** Number of new assets uploaded */
  published: number;
  /** Number of duplicate assets skipped (hash collision) */
  skipped?: number;
  /** List of skipped asset paths (for logging/debugging) */
  skippedAssets?: string[];
  errors?: { assetName: string; message: string }[];
}
