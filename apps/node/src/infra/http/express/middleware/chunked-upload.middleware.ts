import { ChunkAssemblerService } from '@core-application/publishing/services/chunk-assembler.service';
import { type LoggerPort } from '@core-domain';
import type { ChunkedData } from '@core-domain/entities/chunked-data';
import { type NextFunction, type Request, type Response } from 'express';

import { NodeCompressionAdapter } from '../../../compression/node-compression.adapter';
import { NodeEncodingAdapter } from '../../../compression/node-encoding.adapter';

/**
 * Express middleware to handle chunked compressed uploads
 * Delegates to ChunkAssemblerService from core-application
 * Infrastructure layer - adapts Express to business logic
 */
export class ChunkedUploadMiddleware {
  private readonly assembler: ChunkAssemblerService;

  constructor(private readonly logger?: LoggerPort) {
    // Initialize dependencies (infrastructure adapters)
    const compression = new NodeCompressionAdapter();
    const encoding = new NodeEncodingAdapter();

    // Initialize chunk assembler service from core-application
    this.assembler = new ChunkAssemblerService(compression, encoding, logger, {
      cleanupIntervalMs: 60000, // 1 minute
      chunkExpirationMs: 600000, // 10 minutes
    });
  }

  /**
   * Express middleware to handle chunked requests
   */
  handle = () => {
    return (req: Request, res: Response, next: NextFunction) => {
      // Check if this is a chunked upload request
      if (!this.assembler.isChunkedData(req.body)) {
        return next();
      }

      const chunk = req.body as ChunkedData;
      const { uploadId, chunkIndex, totalChunks } = chunk.metadata;

      this.logger?.debug('Received chunk', {
        uploadId,
        chunkIndex,
        totalChunks,
      });

      // Store the chunk
      this.assembler.storeChunk(chunk);

      // Check if all chunks received
      if (!this.assembler.allChunksReceived(uploadId)) {
        this.logger?.debug('Waiting for more chunks', {
          uploadId,
          received: this.assembler.getReceivedCount(uploadId),
          total: totalChunks,
        });

        return res.status(202).json({
          status: 'chunk_received',
          uploadId,
          chunkIndex,
          totalChunks,
          received: this.assembler.getReceivedCount(uploadId),
        });
      }

      // All chunks received - assemble and decompress
      this.logger?.info('All chunks received, assembling', { uploadId });

      this.assembler
        .assembleAndDecompress(uploadId)
        .then((decompressedData) => {
          // Replace request body with decompressed data
          req.body = decompressedData;

          // Clean up chunk store
          this.assembler.deleteChunkStore(uploadId);

          this.logger?.info('Upload reassembled successfully', { uploadId });

          // Continue to next middleware with reconstructed data
          next();
        })
        .catch((error) => {
          this.logger?.error('Error assembling/decompressing', { error });
          res.status(500).json({
            status: 'error',
            message: error instanceof Error ? error.message : 'Unknown error',
          });
        });
    };
  };

  /**
   * Stop cleanup interval (for graceful shutdown)
   */
  shutdown(): void {
    this.assembler.shutdown();
    this.logger?.info('ChunkedUploadMiddleware shutdown complete');
  }
}
