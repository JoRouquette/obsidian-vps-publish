import type { PublishableNote } from '@core-domain/entities/publishable-note';
import type { UploaderPort } from '@core-domain/ports/uploader-port';
import type { LoggerPort } from '@core-domain/ports/logger-port';
import type { ProgressPort } from '@core-domain/ports/progress-port';
import { batchByBytes } from '../utils/batch-by-bytes.util';
import { SessionApiClient } from '../services/session-api.client';

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

    const batches = batchByBytes(notes, this.maxBytesPerRequest, (batch) => ({
      notes: batch,
    }));

    this._logger.info(
      `Uploading ${notes.length} notes in ${batches.length} batch(es) (maxBytes=${this.maxBytesPerRequest})`
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
