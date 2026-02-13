import { createHash } from 'node:crypto';

import { type AssetHashPort } from '@core-domain';

/**
 * Service for computing cryptographic hashes of asset content.
 * Used for asset deduplication by comparing content hashes.
 */
export class AssetHashService implements AssetHashPort {
  /**
   * Computes SHA256 hash of buffer content.
   * @param buffer - Asset content as Buffer or Uint8Array
   * @returns Hexadecimal hash string (64 characters)
   */
  computeHash(buffer: Buffer | Uint8Array): Promise<string> {
    return Promise.resolve(createHash('sha256').update(buffer).digest('hex'));
  }
}
