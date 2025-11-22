export interface AssetStoragePort {
  save(params: { filename: string; content: Buffer }[]): Promise<void>;
}
