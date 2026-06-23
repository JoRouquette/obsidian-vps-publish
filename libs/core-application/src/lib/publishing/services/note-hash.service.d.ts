import type { NoteHashPort } from '@core-domain';
/**
 * Service for computing cryptographic hashes of note content
 * Used for inter-publication deduplication
 */
export declare class NoteHashService implements NoteHashPort {
    /**
     * Computes SHA-256 hash of the given content string
     * @param content - The string content to hash (UTF-8 encoding)
     * @returns Promise resolving to hex-encoded hash string
     */
    computeHash(content: string): Promise<string>;
}
//# sourceMappingURL=note-hash.service.d.ts.map