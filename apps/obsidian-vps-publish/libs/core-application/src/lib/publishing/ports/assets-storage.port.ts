export interface AssetStoragePort {
  save(params: { filename: string; content: Uint8Array }[]): Promise<void>;
}
