import type { ChunkedData } from '@core-domain/entities/chunked-data';
import type { CompressionPort, EncodingPort } from '@core-domain/ports/compression-port';
import type { LoggerPort } from '@core-domain/ports/logger-port';
export interface ChunkAssemblerOptions {
    cleanupIntervalMs?: number;
    chunkExpirationMs?: number;
}
/**
 * Application service for assembling and decompressing chunks
 * Pure business logic - no infrastructure dependencies
 */
export declare class ChunkAssemblerService {
    private readonly compression;
    private readonly encoding;
    private readonly logger?;
    private readonly chunkStores;
    private readonly cleanupIntervalMs;
    private readonly chunkExpirationMs;
    private cleanupInterval?;
    constructor(compression: CompressionPort, encoding: EncodingPort, logger?: LoggerPort | undefined, options?: ChunkAssemblerOptions);
    /**
     * Check if request contains chunk data
     */
    isChunkedData(data: unknown): data is ChunkedData;
    /**
     * Store a chunk
     */
    storeChunk(chunk: ChunkedData): void;
    /**
     * Check if all chunks received
     */
    allChunksReceived(uploadId: string): boolean;
    /**
     * Get received chunk count
     */
    getReceivedCount(uploadId: string): number;
    /**
     * Assemble and decompress all chunks
     */
    assembleAndDecompress(uploadId: string): Promise<unknown>;
    /**
     * Delete chunk store after successful assembly
     */
    deleteChunkStore(uploadId: string): void;
    /**
     * Start cleanup interval
     */
    private startCleanup;
    /**
     * Cleanup expired chunks
     */
    private cleanupExpiredChunks;
    /**
     * Concatenate multiple Uint8Arrays
     */
    private concatenateBuffers;
    /**
     * Stop cleanup interval (for graceful shutdown)
     */
    shutdown(): void;
}
//# sourceMappingURL=chunk-assembler.service.d.ts.map