import type { ChunkedData } from '@core-domain/entities/chunked-data';
import type { ChunkUploaderPort, CompressionPort, EncodingPort } from '@core-domain/ports/compression-port';
import type { LoggerPort } from '@core-domain/ports/logger-port';
export interface ChunkedUploadOptions {
    maxChunkSize?: number;
    maxRequestBytes?: number;
    compressionLevel?: number;
    retryAttempts?: number;
}
/**
 * Application service for chunked uploads
 * Pure business logic - no infrastructure dependencies
 */
export declare class ChunkedUploadService {
    private readonly compression;
    private readonly encoding;
    private readonly logger;
    private readonly maxChunkSize;
    private readonly maxRequestBytes?;
    private readonly compressionLevel;
    private readonly retryAttempts;
    constructor(compression: CompressionPort, encoding: EncodingPort, logger: LoggerPort, options?: ChunkedUploadOptions);
    /**
     * Compress and chunk data for upload
     */
    prepareUpload<T>(uploadId: string, data: T): Promise<ChunkedData[]>;
    /**
     * Upload a single chunk with retry logic
     */
    uploadChunk(chunk: ChunkedData, uploader: ChunkUploaderPort): Promise<void>;
    /**
     * Upload all chunks sequentially
     */
    uploadAll(chunks: ChunkedData[], uploader: ChunkUploaderPort, onProgress?: (current: number, total: number) => void): Promise<void>;
    private delay;
    private computeSafeChunkSize;
    private estimateSerializedChunkSize;
    private estimateBase64Size;
    private isRetryableError;
}
//# sourceMappingURL=chunked-upload.service.d.ts.map