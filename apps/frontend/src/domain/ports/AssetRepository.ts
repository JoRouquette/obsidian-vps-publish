export interface AssetRepository {
  fetch(path: string): Promise<Blob>;
}
