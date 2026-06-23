"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.NoteHashService = void 0;
const node_crypto_1 = require("node:crypto");
/**
 * Service for computing cryptographic hashes of note content
 * Used for inter-publication deduplication
 */
class NoteHashService {
    /**
     * Computes SHA-256 hash of the given content string
     * @param content - The string content to hash (UTF-8 encoding)
     * @returns Promise resolving to hex-encoded hash string
     */
    async computeHash(content) {
        const hash = (0, node_crypto_1.createHash)('sha256');
        hash.update(content, 'utf8');
        return hash.digest('hex');
    }
}
exports.NoteHashService = NoteHashService;
