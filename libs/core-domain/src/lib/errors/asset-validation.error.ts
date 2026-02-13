export class AssetValidationError extends Error {
  constructor(
    message: string,
    public readonly fileName?: string,
    public readonly reason?: 'SIZE_EXCEEDED' | 'MIME_MISMATCH' | 'INVALID_CONTENT' | 'UNKNOWN'
  ) {
    super(message);
    this.name = 'AssetValidationError';
  }
}
