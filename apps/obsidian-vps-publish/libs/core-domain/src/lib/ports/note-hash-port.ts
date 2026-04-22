/**
 * Port for computing cryptographic hashes of note content
 * Used for inter-publication deduplication
 */
export interface NoteHashPort {
  /**
   * Computes SHA-256 hash of the given content string
   * @param content - The string content to hash (UTF-8 encoding)
   * @returns Promise resolving to hex-encoded hash string
   */
  computeHash(content: string): Promise<string>;
}
