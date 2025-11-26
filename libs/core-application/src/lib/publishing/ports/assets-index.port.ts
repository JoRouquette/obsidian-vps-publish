export interface AssetIndexEntry {
  id: string;
  filename: string;
  route: string;
  classes: string[];
}

export interface AssetsIndex {
  assets: AssetIndexEntry[];
}

export interface AssetsIndexPort {
  save(index: AssetsIndex): Promise<void>;
  rebuildIndex(index: AssetsIndex): Promise<void>;
}
