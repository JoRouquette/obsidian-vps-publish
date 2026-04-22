import type { AssetAlignment } from './asset-alignment';

export interface AssetDisplayOptions {
  alignment?: AssetAlignment;
  width?: number; // px
  classes: string[]; // classes ITS ou CSS arbitraires
  rawModifiers: string[]; // tous les segments après le chemin, bruts
}
