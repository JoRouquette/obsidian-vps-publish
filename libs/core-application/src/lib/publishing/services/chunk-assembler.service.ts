import type { ChunkedData } from '@core-domain/entities/chunked-data';
import type { CompressionPort, EncodingPort } from '@core-domain/ports/compression-port';
import type { LoggerPort } from '@core-domain/ports/logger-port';

interface ChunkStore {
  chunks: Map<number, Uint8Array>;
  metadata: ChunkedData['metadata'];
  receivedAt: number;
}

export interface ChunkAssemblerOptions {
  cleanupIntervalMs?: number;
  chunkExpirationMs?: number;
}

/**
 * Application service for assembling and decompressing chunks
 * Pure business logic - no infrastructure dependencies
 */
export class ChunkAssemblerService {
  private readonly chunkStores = new Map<string, ChunkStore>();
  private readonly cleanupIntervalMs: number;
  private readonly chunkExpirationMs: number;
  private cleanupInterval?: NodeJS.Timeout;

  constructor(
    private readonly compression: CompressionPort,
    private readonly encoding: EncodingPort,
    private readonly logger?: LoggerPort,
    options: ChunkAssemblerOptions = {}
  ) {
    this.cleanupIntervalMs = options.cleanupIntervalMs ?? 60000; // 1 minute
    this.chunkExpirationMs = options.chunkExpirationMs ?? 600000; // 10 minutes
    this.startCleanup();
  }

  /**
   * Check if request contains chunk data
   */
  isChunkedData(data: unknown): data is ChunkedData {
    return (
      data !== null &&
      typeof data === 'object' &&
      'metadata' in data &&
      'data' in data &&
      typeof (data as ChunkedData).metadata === 'object' &&
      'uploadId' in (data as ChunkedData).metadata &&
      'chunkIndex' in (data as ChunkedData).metadata &&
      'totalChunks' in (data as ChunkedData).metadata
    );
  }

  /**
   * Store a chunk
   */
  storeChunk(chunk: ChunkedData): void {
    const { uploadId, chunkIndex } = chunk.metadata;

    if (!this.chunkStores.has(uploadId)) {
      this.chunkStores.set(uploadId, {
        chunks: new Map(),
        metadata: chunk.metadata,
        receivedAt: Date.now(),
      });
    }

    const store = this.chunkStores.get(uploadId)!;

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
  allChunksReceived(uploadId: string): boolean {
    const store = this.chunkStores.get(uploadId);
    if (!store) return false;

    return store.chunks.size === store.metadata.totalChunks;
  }

  /**
   * Get received chunk count
   */
  getReceivedCount(uploadId: string): number {
    return this.chunkStores.get(uploadId)?.chunks.size ?? 0;
  }

  /**
   * Assemble and decompress all chunks
   */
  async assembleAndDecompress(uploadId: string): Promise<unknown> {
    const store = this.chunkStores.get(uploadId);
    if (!store) {
      throw new Error(`Upload ${uploadId} not found`);
    }

    const { totalChunks, compressedSize, originalSize } = store.metadata;

    // Assemble chunks in order
    const buffers: Uint8Array[] = [];
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
    } catch (error) {
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
  deleteChunkStore(uploadId: string): void {
    this.chunkStores.delete(uploadId);
  }

  /**
   * Start cleanup interval
   */
  private startCleanup(): void {
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
  private cleanupExpiredChunks(): void {
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
  private concatenateBuffers(buffers: Uint8Array[]): Uint8Array {
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
  shutdown(): void {
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
      this.cleanupInterval = undefined;
    }
    this.chunkStores.clear();
    this.logger?.debug('ChunkAssemblerService shutdown complete');
  }
}
