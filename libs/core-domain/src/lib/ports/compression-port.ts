import type { ChunkedData } from '../entities/chunked-data';

/**
 * Port for compression services
 * Implementations handle data compression/decompression
 */
export interface CompressionPort {
  /**
   * Compress data using gzip
   * @param data - String data to compress
   * @param level - Compression level (0-9)
   * @returns Compressed data as Uint8Array
   */
  compress(data: string, level: number): Promise<Uint8Array>;

  /**
   * Decompress gzip data
   * @param data - Compressed data
   * @returns Decompressed string
   */
  decompress(data: Uint8Array): Promise<string>;
}

/**
 * Port for encoding services
 */
export interface EncodingPort {
  /**
   * Convert Uint8Array to base64 string
   */
  toBase64(buffer: Uint8Array): string;

  /**
   * Convert base64 string to Buffer/Uint8Array
   */
  fromBase64(base64: string): Uint8Array;
}

/**
 * Port for chunk upload operations
 */
export interface ChunkUploaderPort {
  /**
   * Upload a single chunk
   * @param chunk - Chunk data to upload
   */
  uploadChunk(chunk: ChunkedData): Promise<void>;
}
