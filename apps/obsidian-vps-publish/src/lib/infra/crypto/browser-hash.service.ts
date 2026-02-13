/**
 * Browser-compatible hash service for pipeline signature computation
 * Uses SubtleCrypto API available in Electron/Browser environments
 */
export class BrowserHashService {
  /**
   * Compute SHA-256 hash of a string content
   * @param content - String content to hash (UTF-8 encoding)
   * @returns 64-character hexadecimal hash string
   */
  async computeHash(content: string): Promise<string> {
    // Encode string to UTF-8 bytes
    const encoder = new TextEncoder();
    const data = encoder.encode(content);

    // Use SubtleCrypto API (available in modern browsers and Electron)
    const hashBuffer = await crypto.subtle.digest('SHA-256', data);

    // Convert ArrayBuffer to hex string
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    const hashHex = hashArray.map((b) => b.toString(16).padStart(2, '0')).join('');

    return hashHex;
  }
}
