export class AssetScanError extends Error {
  constructor(
    message: string,
    public readonly fileName?: string,
    public readonly threat?: string
  ) {
    super(message);
    this.name = 'AssetScanError';
  }
}
