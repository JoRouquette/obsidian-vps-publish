import type { PublishableNote } from '../entities/publishable-note';
import type { AssetRef } from '../entities/asset-ref';
import { ResolvedAssetFile } from '../entities/resolved-asset-file';

export interface AssetsVaultPort {
  resolveAssetsFromNotes(
    notes: PublishableNote[],
    assetsFolder: string,
    enableVaultFallback: boolean
  ): Promise<ResolvedAssetFile[]>;
}
