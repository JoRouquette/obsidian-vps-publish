/**
 * Port for computing cryptographic hashes of asset content.
 * Used for asset deduplication by comparing content hashes.
 */
export interface AssetHashPort {
  /**
   * Computes SHA256 hash of buffer content.
   * @param buffer - Asset content as Buffer or Uint8Array
   * @returns Promise resolving to hexadecimal hash string (64 characters)
   */
  computeHash(buffer: Buffer | Uint8Array): Promise<string>;
}
