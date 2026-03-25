import { type HttpResponseHandler } from '@core-application/vault-parsing/handler/http-response.handler';
import { type CustomIndexConfig, type PublishableNote, type VpsConfig } from '@core-domain';
import { type ChunkedData } from '@core-domain/entities/chunked-data';
import { type HttpResponse } from '@core-domain/entities/http-response';
import { type LoggerPort } from '@core-domain/ports/logger-port';
import type { RequestUrlResponse } from 'obsidian';

import { translate } from '../../i18n';
import type { Translations } from '../../i18n/locales';
import { requestUrlWithRetry, type RetryConfig } from '../utils/request-with-retry.util';

export interface StartSessionResponse {
  sessionId: string;
  maxBytesPerRequest: number;
  existingAssetHashes?: string[];
  existingNoteHashes?: Record<string, string>;
  pipelineChanged?: boolean;
}

interface FinalizationStatusResponse {
  jobId: string;
  sessionId: string;
  status: 'pending' | 'processing' | 'completed' | 'failed';
  progress: number;
  error?: string;
  result?: {
    promotionStats?: {
      notesPublished: number;
      notesDeduplicated: number;
      notesDeleted: number;
      assetsPublished: number;
      assetsDeduplicated: number;
    };
    contentRevision?: string;
  };
}

const FINALIZATION_STATUS_RETRY_CONFIG: RetryConfig = {
  maxRetries: 0,
  initialDelayMs: 1000,
  maxDelayMs: 1000,
  backoffMultiplier: 1,
};

export class SessionApiClient {
  constructor(
    private readonly baseUrl: string,
    private readonly apiKey: VpsConfig['apiKey'],
    private readonly responseHandler: HttpResponseHandler<RequestUrlResponse>,
    private readonly logger: LoggerPort,
    private readonly translations?: Translations
  ) {
    this.logger = logger.child({ component: 'SessionApiClient' });
    this.logger.debug('SessionApiClient initialized', { baseUrl });
  }

  private buildUrl(path: string): string {
    return `${this.baseUrl.replace(/\/$/, '')}${path}`;
  }

  private async postJson<TBody>(
    path: string,
    body: TBody,
    retryConfig?: RetryConfig
  ): Promise<HttpResponse> {
    return this.requestJson(path, 'POST', body, retryConfig);
  }

  private async getJson(path: string, retryConfig?: RetryConfig): Promise<HttpResponse> {
    return this.requestJson(path, 'GET', undefined, retryConfig);
  }

  private async requestJson<TBody>(
    path: string,
    method: 'GET' | 'POST',
    body?: TBody,
    retryConfig?: RetryConfig
  ): Promise<HttpResponse> {
    const url = this.buildUrl(path);
    const res = await requestUrlWithRetry(
      {
        url,
        method,
        headers: {
          'x-api-key': this.apiKey,
          ...(method === 'POST' ? { 'Content-Type': 'application/json' } : {}),
        },
        ...(body !== undefined ? { body: JSON.stringify(body) } : {}),
        throw: false,
      },
      retryConfig,
      this.logger
    );

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
    customIndexConfigs?: CustomIndexConfig[];
    ignoredTags?: string[];
    folderDisplayNames?: Record<string, string>;
    pipelineSignature?: { version: string; renderSettingsHash: string };
    locale?: 'en' | 'fr';
    deduplicationEnabled?: boolean;
  }): Promise<StartSessionResponse> {
    const result = await this.postJson('/api/session/start', {
      notesPlanned: payload.notesPlanned,
      assetsPlanned: payload.assetsPlanned,
      batchConfig: { maxBytesPerRequest: payload.maxBytesPerRequest },
      calloutStyles: payload.calloutStyles ?? [],
      customIndexConfigs: payload.customIndexConfigs ?? [],
      ignoredTags: payload.ignoredTags ?? [],
      folderDisplayNames: payload.folderDisplayNames ?? {},
      pipelineSignature: payload.pipelineSignature,
      locale: payload.locale,
      deduplicationEnabled: payload.deduplicationEnabled ?? true,
    });

    if (result.isError) {
      const errorMsg = this.translations
        ? translate(this.translations, 'sessionErrors.startFailed')
        : 'startSession failed';
      throw result.error ?? new Error(errorMsg);
    }
    const parsed = JSON.parse(result.text ?? '{}');
    const serverLimit = parseLimit(parsed.maxBytesPerRequest);
    const effectiveLimit =
      payload.maxBytesPerRequest > 0
        ? Math.min(payload.maxBytesPerRequest, serverLimit)
        : serverLimit;

    this.logger.debug('Resolved effective request size limit', {
      requestedMaxBytesPerRequest: payload.maxBytesPerRequest,
      serverMaxBytesPerRequest: serverLimit,
      effectiveMaxBytesPerRequest: effectiveLimit,
    });

    return {
      sessionId: parsed.sessionId,
      maxBytesPerRequest: effectiveLimit,
      existingAssetHashes: parsed.existingAssetHashes ?? [],
      existingNoteHashes: parsed.existingNoteHashes ?? {},
      pipelineChanged: parsed.pipelineChanged,
    };
  }

  async uploadNotes(sessionId: string, notes: PublishableNote[]): Promise<void> {
    this.logger.debug('Uploading notes', { sessionId, notesCount: notes.length });
    const result = await this.postJson(`/api/session/${sessionId}/notes/upload`, {
      notes,
    });
    if (result.isError) {
      const errorMsg = this.translations
        ? translate(this.translations, 'sessionErrors.uploadNotesFailed')
        : 'uploadNotes failed';
      throw result.error ?? new Error(errorMsg);
    }
  }

  async uploadAssets(sessionId: string, assets: unknown[]): Promise<void> {
    const result = await this.postJson(`/api/session/${sessionId}/assets/upload`, {
      assets,
    });
    if (result.isError) {
      const errorMsg = this.translations
        ? translate(this.translations, 'sessionErrors.uploadAssetsFailed')
        : 'uploadAssets failed';
      throw result.error ?? new Error(errorMsg);
    }
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
    payload: {
      notesProcessed: number;
      assetsProcessed: number;
      allCollectedRoutes?: string[]; // PHASE 6.1: detect deleted pages
    }
  ): Promise<{
    promotionStats?: {
      notesPublished: number;
      notesDeduplicated: number;
      notesDeleted: number;
      assetsPublished: number;
      assetsDeduplicated: number;
    };
  }> {
    const result = await this.postJson(`/api/session/${sessionId}/finish`, payload);
    if (result.isError) {
      const errorMsg = this.translations
        ? translate(this.translations, 'sessionErrors.finishFailed')
        : 'finishSession failed';
      throw result.error ?? new Error(errorMsg);
    }
    const parsed = JSON.parse(result.text ?? '{}') as
      | {
          promotionStats?: {
            notesPublished: number;
            notesDeduplicated: number;
            notesDeleted: number;
            assetsPublished: number;
            assetsDeduplicated: number;
          };
          jobId?: string;
        }
      | undefined;

    if (parsed?.jobId) {
      return this.waitForFinalization(sessionId, parsed.jobId);
    }

    return {
      promotionStats: parsed?.promotionStats,
    };
  }

  async abortSession(sessionId: string): Promise<void> {
    const result = await this.postJson(`/api/session/${sessionId}/abort`, {});
    if (result.isError) {
      const errorMsg = this.translations
        ? translate(this.translations, 'sessionErrors.abortFailed')
        : 'abortSession failed';
      throw result.error ?? new Error(errorMsg);
    }
  }

  async cleanupVps(targetName: string): Promise<void> {
    const result = await this.postJson('/api/maintenance/cleanup', { targetName });
    if (result.isError) {
      const errorMsg = this.translations
        ? translate(this.translations, 'sessionErrors.cleanupFailed')
        : 'cleanupVps failed';
      throw result.error ?? new Error(errorMsg);
    }
    this.logger.debug('VPS cleanup completed', { targetName });
  }

  private async waitForFinalization(
    sessionId: string,
    jobId: string
  ): Promise<{
    promotionStats?: {
      notesPublished: number;
      notesDeduplicated: number;
      notesDeleted: number;
      assetsPublished: number;
      assetsDeduplicated: number;
    };
  }> {
    const timeoutMs = 10 * 60 * 1000;
    const pollIntervalMs = 1500;
    const startTime = Date.now();

    while (Date.now() - startTime < timeoutMs) {
      let result: HttpResponse;
      try {
        result = await this.getJson(
          `/api/session/${sessionId}/status`,
          FINALIZATION_STATUS_RETRY_CONFIG
        );
      } catch (error) {
        if (isTransientBackpressureError(error)) {
          this.logger.warn('Finalization status polling throttled by server backpressure', {
            sessionId,
            jobId,
            error: error instanceof Error ? error.message : String(error),
          });
          await sleep(pollIntervalMs);
          continue;
        }
        throw error;
      }

      if (result.isError) {
        if (isTransientBackpressureResponse(result)) {
          this.logger.warn('Finalization status polling returned HTTP 429', {
            sessionId,
            jobId,
            httpStatus: result.httpStatus,
          });
          await sleep(pollIntervalMs);
          continue;
        }
        throw result.error ?? new Error('finalization status polling failed');
      }

      const parsed = JSON.parse(result.text ?? '{}') as FinalizationStatusResponse;
      this.logger.debug('Finalization job status polled', {
        sessionId,
        jobId,
        status: parsed.status,
        progress: parsed.progress,
      });

      if (parsed.status === 'completed') {
        return {
          promotionStats: parsed.result?.promotionStats,
        };
      }

      if (parsed.status === 'failed') {
        throw new Error(parsed.error || `Finalization job failed: ${jobId}`);
      }

      await sleep(pollIntervalMs);
    }

    throw new Error(`Finalization polling timed out after ${timeoutMs}ms for ${jobId}`);
  }
}

function isTransientBackpressureError(error: unknown): boolean {
  if (!(error instanceof Error)) {
    return false;
  }

  return /(?:^|\s)429(?:\s|$)/.test(error.message) || /server under load/i.test(error.message);
}

function isTransientBackpressureResponse(response: HttpResponse): boolean {
  return response.isError && response.httpStatus?.startsWith('429') === true;
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

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
