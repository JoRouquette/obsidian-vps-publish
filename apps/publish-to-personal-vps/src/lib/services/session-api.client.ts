import { requestUrl, RequestUrlResponse } from 'obsidian';
import { HttpResponseHandler } from '@core-application/vault-parsing/handler/http-response.handler';
import { HttpResponse } from '@core-domain/entities/http-response';
import { LoggerPort } from '@core-domain/ports/logger-port';
import { PublishableNote, VpsConfig } from '@core-domain';

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

  private async postJson<TBody, TResult>(path: string, body: TBody): Promise<HttpResponse> {
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
  }): Promise<StartSessionResponse> {
    const result = await this.postJson('/api/session/start', {
      notesPlanned: payload.notesPlanned,
      assetsPlanned: payload.assetsPlanned,
      batchConfig: { maxBytesPerRequest: payload.maxBytesPerRequest },
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
