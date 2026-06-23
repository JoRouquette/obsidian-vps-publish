"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ChunkedUploadService = void 0;
/**
 * Application service for chunked uploads
 * Pure business logic - no infrastructure dependencies
 */
class ChunkedUploadService {
    constructor(compression, encoding, logger, options = {}) {
        this.compression = compression;
        this.encoding = encoding;
        this.logger = logger.child({ service: 'ChunkedUploadService' });
        this.maxChunkSize = options.maxChunkSize ?? 5 * 1024 * 1024; // 5MB default
        this.maxRequestBytes = options.maxRequestBytes;
        this.compressionLevel = options.compressionLevel ?? 6;
        this.retryAttempts = options.retryAttempts ?? 3;
    }
    /**
     * Compress and chunk data for upload
     */
    async prepareUpload(uploadId, data) {
        this.logger.debug('Preparing chunked upload', { uploadId });
        const prepareStart = performance.now();
        // 1. Serialize to JSON
        const serializeStart = performance.now();
        const jsonString = JSON.stringify(data);
        const originalSize = new TextEncoder().encode(jsonString).length;
        const serializeDurationMs = performance.now() - serializeStart;
        this.logger.debug('Data serialized', {
            uploadId,
            originalSize,
            originalSizeMB: (originalSize / 1024 / 1024).toFixed(2),
            serialize_duration_ms: serializeDurationMs,
        });
        // 2. Compress with gzip
        const compressStart = performance.now();
        const compressed = await this.compression.compress(jsonString, this.compressionLevel);
        const compressedSize = compressed.length;
        const compressionRatio = ((1 - compressedSize / originalSize) * 100).toFixed(2);
        const compressDurationMs = performance.now() - compressStart;
        this.logger.debug('Data compressed', {
            uploadId,
            originalSize,
            compressedSize,
            compressionRatio: `${compressionRatio}%`,
            compressedSizeMB: (compressedSize / 1024 / 1024).toFixed(2),
            compress_duration_ms: compressDurationMs,
        });
        // 3. Split into chunks.
        // maxChunkSize is a binary payload limit, but the actual HTTP request transports
        // base64 JSON. We must keep the serialized request body under maxRequestBytes.
        const safeChunkSize = this.computeSafeChunkSize(uploadId, originalSize, compressedSize);
        const chunks = [];
        const totalChunks = Math.ceil(compressedSize / safeChunkSize);
        const chunkEncodeStart = performance.now();
        for (let i = 0; i < totalChunks; i++) {
            const start = i * safeChunkSize;
            const end = Math.min(start + safeChunkSize, compressedSize);
            const chunk = compressed.slice(start, end);
            // Convert to base64 for JSON transport
            const base64Chunk = this.encoding.toBase64(chunk);
            chunks.push({
                metadata: {
                    uploadId,
                    chunkIndex: i,
                    totalChunks,
                    originalSize,
                    compressedSize,
                },
                data: base64Chunk,
            });
            this.logger.debug('Chunk prepared', {
                uploadId,
                chunkIndex: i,
                chunkSize: chunk.length,
                base64Size: base64Chunk.length,
                requestBodySize: this.estimateSerializedChunkSize(uploadId, chunk.length, totalChunks, originalSize, compressedSize),
            });
        }
        this.logger.debug('Upload prepared', {
            uploadId,
            totalChunks,
            safeChunkSize,
            avgChunkSizeMB: (compressedSize / totalChunks / 1024 / 1024).toFixed(2),
            chunk_prepare_duration_ms: performance.now() - prepareStart,
            chunk_encode_duration_ms: performance.now() - chunkEncodeStart,
        });
        return chunks;
    }
    /**
     * Upload a single chunk with retry logic
     */
    async uploadChunk(chunk, uploader) {
        const { uploadId, chunkIndex, totalChunks } = chunk.metadata;
        let lastError;
        for (let attempt = 1; attempt <= this.retryAttempts; attempt++) {
            try {
                this.logger.debug('Uploading chunk', {
                    uploadId,
                    chunkIndex,
                    totalChunks,
                    attempt,
                });
                await uploader.uploadChunk(chunk);
                this.logger.debug('Chunk uploaded successfully', {
                    uploadId,
                    chunkIndex,
                    attempt,
                });
                return;
            }
            catch (error) {
                lastError = error instanceof Error ? error : new Error(String(error));
                this.logger.warn('Chunk upload failed', {
                    uploadId,
                    chunkIndex,
                    attempt,
                    error: lastError.message,
                });
                if (!this.isRetryableError(lastError)) {
                    break;
                }
                if (attempt < this.retryAttempts) {
                    // Exponential backoff
                    const delayMs = Math.min(1000 * Math.pow(2, attempt - 1), 10000);
                    this.logger.debug('Retrying chunk upload', {
                        uploadId,
                        chunkIndex,
                        delayMs,
                    });
                    await this.delay(delayMs);
                }
            }
        }
        this.logger.error('Chunk upload failed after all retries', {
            uploadId,
            chunkIndex,
            attempts: this.retryAttempts,
            error: lastError?.message,
        });
        throw new Error(`Failed to upload chunk ${chunkIndex}/${totalChunks} for ${uploadId} after ${this.retryAttempts} attempts: ${lastError?.message}`);
    }
    /**
     * Upload all chunks sequentially
     */
    async uploadAll(chunks, uploader, onProgress) {
        const uploadId = chunks[0]?.metadata.uploadId;
        const totalChunks = chunks.length;
        this.logger.debug('Starting chunked upload', { uploadId, totalChunks });
        for (let i = 0; i < chunks.length; i++) {
            await this.uploadChunk(chunks[i], uploader);
            if (onProgress) {
                onProgress(i + 1, totalChunks);
            }
            this.logger.debug('Upload progress', {
                uploadId,
                completed: i + 1,
                total: totalChunks,
                percentComplete: (((i + 1) / totalChunks) * 100).toFixed(2),
            });
        }
        this.logger.debug('Chunked upload completed', { uploadId, totalChunks });
    }
    delay(ms) {
        return new Promise((resolve) => setTimeout(resolve, ms));
    }
    computeSafeChunkSize(uploadId, originalSize, compressedSize) {
        const upperBound = Math.max(1, Math.min(this.maxChunkSize, compressedSize || 1));
        if (!this.maxRequestBytes || this.maxRequestBytes <= 0) {
            return upperBound;
        }
        let low = 1;
        let high = upperBound;
        let best = 0;
        while (low <= high) {
            const mid = Math.floor((low + high) / 2);
            const totalChunks = Math.ceil(compressedSize / mid);
            const estimatedRequestSize = this.estimateSerializedChunkSize(uploadId, mid, totalChunks, originalSize, compressedSize);
            if (estimatedRequestSize <= this.maxRequestBytes) {
                best = mid;
                low = mid + 1;
            }
            else {
                high = mid - 1;
            }
        }
        if (best <= 0) {
            throw new Error(`Unable to fit chunk metadata within maxRequestBytes=${this.maxRequestBytes} for ${uploadId}`);
        }
        if (best < upperBound) {
            this.logger.debug('Adjusted chunk size to fit request body limit', {
                uploadId,
                requestedChunkSize: upperBound,
                safeChunkSize: best,
                maxRequestBytes: this.maxRequestBytes,
            });
        }
        return best;
    }
    estimateSerializedChunkSize(uploadId, chunkSize, totalChunks, originalSize, compressedSize) {
        const chunk = {
            metadata: {
                uploadId,
                chunkIndex: Math.max(0, totalChunks - 1),
                totalChunks,
                originalSize,
                compressedSize,
            },
            data: 'A'.repeat(this.estimateBase64Size(chunkSize)),
        };
        return new TextEncoder().encode(JSON.stringify(chunk)).length;
    }
    estimateBase64Size(byteLength) {
        return Math.ceil(byteLength / 3) * 4;
    }
    isRetryableError(error) {
        const message = error.message.toLowerCase();
        return !(message.includes('413') ||
            message.includes('payload too large') ||
            message.includes('400') ||
            message.includes('401') ||
            message.includes('403') ||
            message.includes('404'));
    }
}
exports.ChunkedUploadService = ChunkedUploadService;
