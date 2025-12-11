import { ChunkedUploadService } from '@core-application/publishing/services/chunked-upload.service';
import { ProgressStepId } from '@core-domain/entities/progress-step';
import type { PublishableNote } from '@core-domain/entities/publishable-note';
import type { GuidGeneratorPort } from '@core-domain/ports/guid-generator-port';
import type { LoggerPort } from '@core-domain/ports/logger-port';
import type { ProgressPort } from '@core-domain/ports/progress-port';
import type { StepProgressManagerPort } from '@core-domain/ports/step-progress-manager-port';
import type { UploaderPort } from '@core-domain/ports/uploader-port';

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
    private readonly guidGenerator: GuidGeneratorPort,
    logger: LoggerPort,
    private readonly maxBytesPerRequest: number,
    private readonly progress?: ProgressPort | StepProgressManagerPort
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
      this._logger.debug('No notes to upload.');
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
      this.advanceProgress(oversized.length);
    }

    this._logger.debug(
      `Uploading ${notes.length} notes in ${batches.length} batch(es) (maxBytes=${this.maxBytesPerRequest}, skipped=${oversized.length})`
    );

    let batchIndex = 0;
    for (const batch of batches) {
      batchIndex++;

      // Use chunked upload for each batch
      const uploadId = `notes-${this.sessionId}-${this.guidGenerator.generateGuid()}`;

      this._logger.debug('Preparing chunked upload for batch', {
        uploadId,
        batchIndex,
        totalBatches: batches.length,
        batchSize: batch.length,
      });

      const chunks = await this.chunkedUploadService.prepareUpload(uploadId, { notes: batch });

      // Create uploader adapter for this session
      const uploader = new NoteChunkUploaderAdapter(this.sessionClient, this.sessionId);

      await this.chunkedUploadService.uploadAll(chunks, uploader, (current, total) => {
        this._logger.debug('Chunk upload progress', {
          uploadId,
          batchIndex,
          current,
          total,
          percentComplete: ((current / total) * 100).toFixed(2),
        });
      });

      this._logger.debug('Notes batch uploaded', {
        batchIndex,
        totalBatches: batches.length,
        batchSize: batch.length,
      });
      this.advanceProgress(batch.length);
    }

    this._logger.debug('Successfully uploaded notes to session');
    return true;
  }

  /**
   * Retourne le nombre de batchs et d'items oversized
   */
  getBatchInfo(notes: PublishableNote[]): { batchCount: number; oversizedCount: number } {
    if (!Array.isArray(notes) || notes.length === 0) {
      return { batchCount: 0, oversizedCount: 0 };
    }

    const { batches, oversized } = batchByBytes(notes, this.maxBytesPerRequest, (batch) => ({
      notes: batch,
    }));

    return {
      batchCount: batches.length,
      oversizedCount: oversized.length,
    };
  }

  private advanceProgress(step: number): void {
    if (!this.progress) return;

    if ('advanceStep' in this.progress) {
      // C'est un StepProgressManagerPort
      this.progress.advanceStep(ProgressStepId.UPLOAD_NOTES, step);
    } else {
      // C'est un ProgressPort
      this.progress.advance(step);
    }
  }
}
