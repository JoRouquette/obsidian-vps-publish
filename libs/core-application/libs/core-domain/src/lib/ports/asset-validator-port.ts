/**
 * Port for validating asset content security and integrity.
 * Validates assets BEFORE storage to prevent malicious uploads.
 */
export interface AssetValidatorPort {
  /**
   * Validates asset content by checking:
   * - Size constraints (reject if exceeds limit)
   * - MIME type integrity (detect actual MIME from bytes, not client-provided)
   *
   * @param buffer The asset content as Buffer/Uint8Array
   * @param filename The asset filename (for extension fallback)
   * @param clientMimeType Optional MIME type provided by client (untrusted)
   * @param maxSizeBytes Maximum allowed size in bytes
   * @returns Validation result with detected MIME type
   * @throws {AssetValidationError} if validation fails
   */
  validate(
    buffer: Buffer | Uint8Array,
    filename: string,
    clientMimeType?: string,
    maxSizeBytes?: number
  ): Promise<AssetValidationResult>;
}

export interface AssetValidationResult {
  /**
   * True if the asset passed all validation checks
   */
  valid: boolean;

  /**
   * Detected MIME type from actual bytes (more reliable than client-provided)
   * Falls back to guessing from extension if detection fails
   */
  detectedMimeType: string;

  /**
   * Size of the asset in bytes
   */
  sizeBytes: number;

  /**
   * Error message if validation failed
   */
  error?: string;
}
