import { ChunkedUploadService } from '@core-application/publishing/services/chunked-upload.service';
import type { PublishableNote } from '@core-domain/entities/publishable-note';
import type { LoggerPort } from '@core-domain/ports/logger-port';
import type { ProgressPort } from '@core-domain/ports/progress-port';
import type { UploaderPort } from '@core-domain/ports/uploader-port';
import { nanoid } from 'nanoid';

import { type SessionApiClient } from '../services/session-api.client';
import { batchByBytes } from '../utils/batch-by-bytes.util';
import { BrowserEncodingAdapter } from './browser-encoding.adapter';
import { NoteChunkUploaderAdapter } from './chunk-uploader.adapter';
import { ObsidianCompressionAdapter } from './obsidian-compression.adapter';

export class NotesUploaderAdapter implements UploaderPort {
  private readonly _logger: LoggerPort;
  private readonly chunkedUploadService: ChunkedUploadService;

  constructor(
    private readonly sessionClient: SessionApiClient,
    private readonly sessionId: string,
    logger: LoggerPort,
    private readonly maxBytesPerRequest: number,
    private readonly progress?: ProgressPort
  ) {
    this._logger = logger.child({ component: 'NotesUploaderAdapter' });

    // Initialize dependencies (infrastructure adapters)
    const compression = new ObsidianCompressionAdapter();
    const encoding = new BrowserEncodingAdapter();

    // Initialize chunked upload service from core-application
    this.chunkedUploadService = new ChunkedUploadService(compression, encoding, this._logger, {
      maxChunkSize: Math.min(maxBytesPerRequest / 2, 5 * 1024 * 1024), // Half of max or 5MB
      compressionLevel: 6,
      retryAttempts: 3,
    });
  }

  async upload(notes: PublishableNote[]): Promise<boolean> {
    if (!Array.isArray(notes) || notes.length === 0) {
      this._logger.info('No notes to upload.');
      return false;
    }

    const { batches, oversized } = batchByBytes(notes, this.maxBytesPerRequest, (batch) => ({
      notes: batch,
    }));

    if (oversized.length > 0) {
      this._logger.warn('Some notes exceed maxBytesPerRequest and will be skipped', {
        oversizedCount: oversized.length,
        maxBytesPerRequest: this.maxBytesPerRequest,
        skippedNotes: oversized.map((n) => ({
          slug: n.routing.slug,
          fullPath: n.routing.fullPath,
        })),
      });
      // Advance progress for skipped notes
      this.progress?.advance(oversized.length);
    }

    this._logger.info(
      `Uploading ${notes.length} notes in ${batches.length} batch(es) (maxBytes=${this.maxBytesPerRequest}, skipped=${oversized.length})`
    );
    this._logger.debug('Notes upload batches details', {
      batches: batches.map((batch) => ({
        noteCount: batch.length,
      })),
    });
    this._logger.debug('Notes upload batches details', { batches });

    for (const batch of batches) {
      // Use chunked upload for each batch
      const uploadId = `notes-${this.sessionId}-${nanoid(10)}`;

      this._logger.debug('Preparing chunked upload for batch', {
        uploadId,
        batchSize: batch.length,
      });

      const chunks = await this.chunkedUploadService.prepareUpload(uploadId, { notes: batch });

      // Create uploader adapter for this session
      const uploader = new NoteChunkUploaderAdapter(this.sessionClient, this.sessionId);

      await this.chunkedUploadService.uploadAll(chunks, uploader, (current, total) => {
        this._logger.debug('Chunk upload progress', {
          uploadId,
          current,
          total,
          percentComplete: ((current / total) * 100).toFixed(2),
        });
      });

      this._logger.debug('Notes batch uploaded', { batchSize: batch.length });
      this.progress?.advance(batch.length);
    }

    this._logger.info('Successfully uploaded notes to session');
    return true;
  }
}
