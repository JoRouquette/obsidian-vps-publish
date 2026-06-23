"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ChunkAssemblerService = void 0;
/**
 * Application service for assembling and decompressing chunks
 * Pure business logic - no infrastructure dependencies
 */
class ChunkAssemblerService {
    constructor(compression, encoding, logger, options = {}) {
        this.compression = compression;
        this.encoding = encoding;
        this.logger = logger;
        this.chunkStores = new Map();
        this.cleanupIntervalMs = options.cleanupIntervalMs ?? 60000; // 1 minute
        this.chunkExpirationMs = options.chunkExpirationMs ?? 600000; // 10 minutes
        this.startCleanup();
    }
    /**
     * Check if request contains chunk data
     */
    isChunkedData(data) {
        return (data !== null &&
            typeof data === 'object' &&
            'metadata' in data &&
            'data' in data &&
            typeof data.metadata === 'object' &&
            'uploadId' in data.metadata &&
            'chunkIndex' in data.metadata &&
            'totalChunks' in data.metadata);
    }
    /**
     * Store a chunk
     */
    storeChunk(chunk) {
        const { uploadId, chunkIndex } = chunk.metadata;
        if (!this.chunkStores.has(uploadId)) {
            this.chunkStores.set(uploadId, {
                chunks: new Map(),
                metadata: chunk.metadata,
                receivedAt: Date.now(),
            });
        }
        const store = this.chunkStores.get(uploadId);
        // Decode base64 chunk
        const chunkBuffer = this.encoding.fromBase64(chunk.data);
        store.chunks.set(chunkIndex, chunkBuffer);
        this.logger?.debug('Chunk stored', {
            uploadId,
            chunkIndex,
            chunkSize: chunkBuffer.length,
            totalStored: store.chunks.size,
        });
    }
    /**
     * Check if all chunks received
     */
    allChunksReceived(uploadId) {
        const store = this.chunkStores.get(uploadId);
        if (!store)
            return false;
        return store.chunks.size === store.metadata.totalChunks;
    }
    /**
     * Get received chunk count
     */
    getReceivedCount(uploadId) {
        return this.chunkStores.get(uploadId)?.chunks.size ?? 0;
    }
    /**
     * Assemble and decompress all chunks
     */
    async assembleAndDecompress(uploadId) {
        const store = this.chunkStores.get(uploadId);
        if (!store) {
            throw new Error(`Upload ${uploadId} not found`);
        }
        const { totalChunks, compressedSize, originalSize } = store.metadata;
        // Assemble chunks in order
        const buffers = [];
        for (let i = 0; i < totalChunks; i++) {
            const chunk = store.chunks.get(i);
            if (!chunk) {
                throw new Error(`Missing chunk ${i} for upload ${uploadId}`);
            }
            buffers.push(chunk);
        }
        const compressed = this.concatenateBuffers(buffers);
        this.logger?.debug('Chunks assembled', {
            uploadId,
            totalChunks,
            assembledSize: compressed.length,
            expectedSize: compressedSize,
        });
        if (compressed.length !== compressedSize) {
            this.logger?.warn('Assembled size mismatch', {
                uploadId,
                assembled: compressed.length,
                expected: compressedSize,
            });
        }
        // Decompress
        try {
            const decompressed = await this.compression.decompress(compressed);
            this.logger?.debug('Data decompressed', {
                uploadId,
                compressedSize: compressed.length,
                decompressedSize: decompressed.length,
                expectedSize: originalSize,
            });
            // Parse JSON
            const data = JSON.parse(decompressed);
            return data;
        }
        catch (error) {
            this.logger?.error('Decompression failed', {
                uploadId,
                error,
                compressedSize: compressed.length,
            });
            throw new Error(`Failed to decompress upload ${uploadId}: ${error}`);
        }
    }
    /**
     * Delete chunk store after successful assembly
     */
    deleteChunkStore(uploadId) {
        this.chunkStores.delete(uploadId);
    }
    /**
     * Start cleanup interval
     */
    startCleanup() {
        this.cleanupInterval = setInterval(() => {
            this.cleanupExpiredChunks();
        }, this.cleanupIntervalMs);
        // Don't prevent process from exiting
        if (this.cleanupInterval.unref) {
            this.cleanupInterval.unref();
        }
    }
    /**
     * Cleanup expired chunks
     */
    cleanupExpiredChunks() {
        const now = Date.now();
        let cleaned = 0;
        for (const [uploadId, store] of this.chunkStores.entries()) {
            if (now - store.receivedAt > this.chunkExpirationMs) {
                this.chunkStores.delete(uploadId);
                cleaned++;
                this.logger?.debug('Expired chunk store cleaned', {
                    uploadId,
                    age: now - store.receivedAt,
                });
            }
        }
        if (cleaned > 0) {
            this.logger?.debug('Cleanup completed', { cleaned, remaining: this.chunkStores.size });
        }
    }
    /**
     * Concatenate multiple Uint8Arrays
     */
    concatenateBuffers(buffers) {
        const totalLength = buffers.reduce((acc, buf) => acc + buf.length, 0);
        const result = new Uint8Array(totalLength);
        let offset = 0;
        for (const buffer of buffers) {
            result.set(buffer, offset);
            offset += buffer.length;
        }
        return result;
    }
    /**
     * Stop cleanup interval (for graceful shutdown)
     */
    shutdown() {
        if (this.cleanupInterval) {
            clearInterval(this.cleanupInterval);
            this.cleanupInterval = undefined;
        }
        this.chunkStores.clear();
        this.logger?.debug('ChunkAssemblerService shutdown complete');
    }
}
exports.ChunkAssemblerService = ChunkAssemblerService;
