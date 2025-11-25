// ports/assets-vault-port.ts
import type { PublishableNote } from '../PublishableNote';
import type { AssetRef } from '../AssetRef';
import { ResolvedAssetFile } from '../ResolvedAssetFile';

export interface AssetsVaultPort {
  resolveAssetForNote(
    note: PublishableNote,
    asset: AssetRef,
    assetsFolder: string,
    enableVaultFallback: boolean
  ): Promise<ResolvedAssetFile | null>;
}
