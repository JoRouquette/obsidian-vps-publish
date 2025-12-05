import type { ChunkedData } from '@core-domain/entities/chunked-data';
import type { ChunkUploaderPort } from '@core-domain/ports/compression-port';

import type { SessionApiClient } from '../services/session-api.client';

/**
 * Adapter for uploading note chunks via SessionApiClient
 * Infrastructure layer - implements ChunkUploaderPort
 */
export class NoteChunkUploaderAdapter implements ChunkUploaderPort {
  constructor(
    private readonly sessionClient: SessionApiClient,
    private readonly sessionId: string
  ) {}

  async uploadChunk(chunk: ChunkedData): Promise<void> {
    await this.sessionClient.uploadChunk(this.sessionId, chunk);
  }
}

/**
 * Adapter for uploading asset chunks via SessionApiClient
 * Infrastructure layer - implements ChunkUploaderPort
 */
export class AssetChunkUploaderAdapter implements ChunkUploaderPort {
  constructor(
    private readonly sessionClient: SessionApiClient,
    private readonly sessionId: string
  ) {}

  async uploadChunk(chunk: ChunkedData): Promise<void> {
    await this.sessionClient.uploadAssetChunk(this.sessionId, chunk);
  }
}
