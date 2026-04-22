import type { PublishableNote } from '../entities/publishable-note';
import type { ResolvedAssetFile } from '../entities/resolved-asset-file';

export interface AssetsVaultPort {
  resolveAssetsFromNotes(
    notes: PublishableNote[],
    assetsFolder: string,
    enableVaultFallback: boolean
  ): Promise<ResolvedAssetFile[]>;
}
