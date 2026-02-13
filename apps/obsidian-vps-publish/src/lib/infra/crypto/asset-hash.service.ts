import type { AssetHashPort } from '@core-domain';

/**
 * Browser-based implementation of AssetHashPort using SubtleCrypto API.
 * Computes SHA-256 hash of asset content for deduplication.
 */
export class AssetHashService implements AssetHashPort {
  /**
   * Compute SHA-256 hash of buffer content.
   * @param buffer - Asset content as Buffer or Uint8Array
   * @returns 64-character hexadecimal hash string
   */
  async computeHash(buffer: Buffer | Uint8Array): Promise<string> {
    // Convert Buffer to Uint8Array if needed
    const uint8Array = buffer instanceof Buffer ? new Uint8Array(buffer) : buffer;

    // SubtleCrypto needs ArrayBuffer, so extract it from Uint8Array
    const arrayBuffer =
      uint8Array.buffer.byteLength === uint8Array.byteLength
        ? uint8Array.buffer
        : uint8Array.buffer.slice(
            uint8Array.byteOffset,
            uint8Array.byteOffset + uint8Array.byteLength
          );

    // Use SubtleCrypto API (available in modern browsers and Electron)
    const hashBuffer = await crypto.subtle.digest('SHA-256', arrayBuffer);

    // Convert ArrayBuffer to hex string
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    const hashHex = hashArray.map((b) => b.toString(16).padStart(2, '0')).join('');

    return hashHex;
  }
}
