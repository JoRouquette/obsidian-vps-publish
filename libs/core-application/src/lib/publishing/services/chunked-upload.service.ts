import type { ChunkedData } from '@core-domain/entities/chunked-data';
import type {
  ChunkUploaderPort,
  CompressionPort,
  EncodingPort,
} from '@core-domain/ports/compression-port';
import type { LoggerPort } from '@core-domain/ports/logger-port';

export interface ChunkedUploadOptions {
  maxChunkSize?: number; // in bytes, default 5MB
  compressionLevel?: number; // 0-9, default 6
  retryAttempts?: number; // default 3
}

/**
 * Application service for chunked uploads
 * Pure business logic - no infrastructure dependencies
 */
export class ChunkedUploadService {
  private readonly logger: LoggerPort;
  private readonly maxChunkSize: number;
  private readonly compressionLevel: number;
  private readonly retryAttempts: number;

  constructor(
    private readonly compression: CompressionPort,
    private readonly encoding: EncodingPort,
    logger: LoggerPort,
    options: ChunkedUploadOptions = {}
  ) {
    this.logger = logger.child({ service: 'ChunkedUploadService' });
    this.maxChunkSize = options.maxChunkSize ?? 5 * 1024 * 1024; // 5MB default
    this.compressionLevel = options.compressionLevel ?? 6;
    this.retryAttempts = options.retryAttempts ?? 3;
  }

  /**
   * Compress and chunk data for upload
   */
  async prepareUpload<T>(uploadId: string, data: T): Promise<ChunkedData[]> {
    this.logger.debug('Preparing chunked upload', { uploadId });

    // 1. Serialize to JSON
    const jsonString = JSON.stringify(data);
    const originalSize = new TextEncoder().encode(jsonString).length;

    this.logger.debug('Data serialized', {
      uploadId,
      originalSize,
      originalSizeMB: (originalSize / 1024 / 1024).toFixed(2),
    });

    // 2. Compress with gzip
    const compressed = await this.compression.compress(jsonString, this.compressionLevel);
    const compressedSize = compressed.length;
    const compressionRatio = ((1 - compressedSize / originalSize) * 100).toFixed(2);

    this.logger.debug('Data compressed', {
      uploadId,
      originalSize,
      compressedSize,
      compressionRatio: `${compressionRatio}%`,
      compressedSizeMB: (compressedSize / 1024 / 1024).toFixed(2),
    });

    // 3. Split into chunks
    const chunks: ChunkedData[] = [];
    const totalChunks = Math.ceil(compressedSize / this.maxChunkSize);

    for (let i = 0; i < totalChunks; i++) {
      const start = i * this.maxChunkSize;
      const end = Math.min(start + this.maxChunkSize, compressedSize);
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
      });
    }

    this.logger.debug('Upload prepared', {
      uploadId,
      totalChunks,
      avgChunkSizeMB: (compressedSize / totalChunks / 1024 / 1024).toFixed(2),
    });

    return chunks;
  }

  /**
   * Upload a single chunk with retry logic
   */
  async uploadChunk(chunk: ChunkedData, uploader: ChunkUploaderPort): Promise<void> {
    const { uploadId, chunkIndex, totalChunks } = chunk.metadata;
    let lastError: Error | undefined;

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
      } catch (error) {
        lastError = error instanceof Error ? error : new Error(String(error));

        this.logger.warn('Chunk upload failed', {
          uploadId,
          chunkIndex,
          attempt,
          error: lastError.message,
        });

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

    throw new Error(
      `Failed to upload chunk ${chunkIndex}/${totalChunks} for ${uploadId} after ${this.retryAttempts} attempts: ${lastError?.message}`
    );
  }

  /**
   * Upload all chunks sequentially
   */
  async uploadAll(
    chunks: ChunkedData[],
    uploader: ChunkUploaderPort,
    onProgress?: (current: number, total: number) => void
  ): Promise<void> {
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

  private delay(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}
