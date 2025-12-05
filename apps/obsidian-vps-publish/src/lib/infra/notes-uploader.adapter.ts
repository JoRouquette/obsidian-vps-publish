import type { PublishableNote } from '@core-domain/entities/publishable-note';
import type { LoggerPort } from '@core-domain/ports/logger-port';
import type { ProgressPort } from '@core-domain/ports/progress-port';
import type { UploaderPort } from '@core-domain/ports/uploader-port';

import { type SessionApiClient } from '../services/session-api.client';
import { batchByBytes } from '../utils/batch-by-bytes.util';

export class NotesUploaderAdapter implements UploaderPort {
  private readonly _logger: LoggerPort;

  constructor(
    private readonly sessionClient: SessionApiClient,
    private readonly sessionId: string,
    logger: LoggerPort,
    private readonly maxBytesPerRequest: number,
    private readonly progress?: ProgressPort
  ) {
    this._logger = logger.child({ component: 'NotesUploaderAdapter' });
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
      await this.sessionClient.uploadNotes(this.sessionId, batch);
      this._logger.debug('Notes batch uploaded', { batchSize: batch.length });
      this.progress?.advance(batch.length);
    }

    this._logger.info('Successfully uploaded notes to session');
    return true;
  }
}
