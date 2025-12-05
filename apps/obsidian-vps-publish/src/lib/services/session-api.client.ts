import { type HttpResponseHandler } from '@core-application/vault-parsing/handler/http-response.handler';
import { type PublishableNote, type VpsConfig } from '@core-domain';
import { type ChunkedData } from '@core-domain/entities/chunked-data';
import { type HttpResponse } from '@core-domain/entities/http-response';
import { type LoggerPort } from '@core-domain/ports/logger-port';
import { requestUrl, type RequestUrlResponse } from 'obsidian';

export interface StartSessionResponse {
  sessionId: string;
  maxBytesPerRequest: number;
}

export class SessionApiClient {
  constructor(
    private readonly baseUrl: string,
    private readonly apiKey: VpsConfig['apiKey'],
    private readonly responseHandler: HttpResponseHandler<RequestUrlResponse>,
    private readonly logger: LoggerPort
  ) {
    this.logger = logger.child({ component: 'SessionApiClient' });
    this.logger.debug('SessionApiClient initialized', { baseUrl });
  }

  private buildUrl(path: string): string {
    return `${this.baseUrl.replace(/\/$/, '')}${path}`;
  }

  private async postJson<TBody>(path: string, body: TBody): Promise<HttpResponse> {
    const url = this.buildUrl(path);
    const res = await requestUrl({
      url,
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': this.apiKey,
      },
      body: JSON.stringify(body),
      throw: false,
    });

    return this.responseHandler.handleResponseAsync({
      response: res,
      url,
    });
  }

  async startSession(payload: {
    notesPlanned: number;
    assetsPlanned: number;
    maxBytesPerRequest: number;
    calloutStyles?: { path: string; css: string }[];
  }): Promise<StartSessionResponse> {
    const result = await this.postJson('/api/session/start', {
      notesPlanned: payload.notesPlanned,
      assetsPlanned: payload.assetsPlanned,
      batchConfig: { maxBytesPerRequest: payload.maxBytesPerRequest },
      calloutStyles: payload.calloutStyles ?? [],
    });

    if (result.isError) throw result.error ?? new Error('startSession failed');
    const parsed = JSON.parse(result.text ?? '{}');

    return {
      sessionId: parsed.sessionId,
      maxBytesPerRequest: parseLimit(parsed.maxBytesPerRequest),
    };
  }

  async uploadNotes(sessionId: string, notes: PublishableNote[]): Promise<void> {
    this.logger.debug('Uploading notes', { sessionId, notesCount: notes.length });
    const result = await this.postJson(`/api/session/${sessionId}/notes/upload`, {
      notes,
    });
    if (result.isError) throw result.error ?? new Error('uploadNotes failed');
  }

  async uploadAssets(sessionId: string, assets: unknown[]): Promise<void> {
    const result = await this.postJson(`/api/session/${sessionId}/assets/upload`, {
      assets,
    });
    if (result.isError) throw result.error ?? new Error('uploadAssets failed');
  }

  /**
   * Upload a single chunk (used by ChunkedUploadService)
   */
  async uploadChunk(sessionId: string, chunk: ChunkedData): Promise<void> {
    const result = await this.postJson(`/api/session/${sessionId}/notes/upload`, chunk);
    if (result.isError) {
      // Check if it's a 202 (chunk received, waiting for more)
      if (result.text && result.text.includes('"status":"chunk_received"')) {
        this.logger.debug('Chunk acknowledged by server', {
          sessionId,
          chunkIndex: chunk.metadata.chunkIndex,
        });
        return;
      }
      throw result.error ?? new Error('uploadChunk failed');
    }
  }

  /**
   * Upload asset chunk (used by ChunkedUploadService)
   */
  async uploadAssetChunk(sessionId: string, chunk: ChunkedData): Promise<void> {
    const result = await this.postJson(`/api/session/${sessionId}/assets/upload`, chunk);
    if (result.isError) {
      if (result.text && result.text.includes('"status":"chunk_received"')) {
        this.logger.debug('Asset chunk acknowledged by server', {
          sessionId,
          chunkIndex: chunk.metadata.chunkIndex,
        });
        return;
      }
      throw result.error ?? new Error('uploadAssetChunk failed');
    }
  }

  async finishSession(
    sessionId: string,
    payload: { notesProcessed: number; assetsProcessed: number }
  ): Promise<void> {
    const result = await this.postJson(`/api/session/${sessionId}/finish`, payload);
    if (result.isError) throw result.error ?? new Error('finishSession failed');
  }

  async abortSession(sessionId: string): Promise<void> {
    const result = await this.postJson(`/api/session/${sessionId}/abort`, {});
    if (result.isError) throw result.error ?? new Error('abortSession failed');
  }

  async cleanupVps(targetName: string): Promise<void> {
    const result = await this.postJson('/api/maintenance/cleanup', { targetName });
    if (result.isError) throw result.error ?? new Error('cleanupVps failed');
    this.logger.info('VPS cleanup completed', { targetName });
  }
}

function parseLimit(value: unknown): number {
  if (typeof value === 'number') return value;
  if (typeof value === 'string') {
    const match = value.match(/^(\\d+(?:\\.\\d+)?)\\s*(kb|mb)?$/i);
    if (match) {
      const num = parseFloat(match[1]);
      const unit = match[2]?.toLowerCase();
      if (unit === 'mb') return Math.floor(num * 1024 * 1024);
      if (unit === 'kb') return Math.floor(num * 1024);
      return Math.floor(num);
    }
  }
  return 8 * 1024 * 1024; // fallback 8MB
}
