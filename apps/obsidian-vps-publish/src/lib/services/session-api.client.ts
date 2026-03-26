import { type HttpResponseHandler } from '@core-application/vault-parsing/handler/http-response.handler';
import {
  type CustomIndexConfig,
  type FinalizationPhase,
  type IgnoreRule,
  type PublishableNote,
  type VpsConfig,
} from '@core-domain';
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
  existingSourceNoteHashesByVaultPath?: Record<string, string>;
  pipelineChanged?: boolean;
}

interface FinalizationStatusResponse {
  jobId: string;
  sessionId: string;
  status: 'pending' | 'processing' | 'completed' | 'failed';
  progress: number;
  phase?: FinalizationPhase;
  phaseTimings?: Record<string, number>;
  contentRevision?: string;
  createdAt?: string;
  startedAt?: string | null;
  completedAt?: string | null;
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

interface FinalizationRealtimeMetadata {
  transport: 'sse';
  streamUrl: string;
  token: string;
  expiresAt: string;
}

interface FinishSessionResponse {
  promotionStats?: {
    notesPublished: number;
    notesDeduplicated: number;
    notesDeleted: number;
    assetsPublished: number;
    assetsDeduplicated: number;
  };
  jobId?: string;
  realtime?: FinalizationRealtimeMetadata;
}

type FinalizationEventName = 'connected' | 'status' | 'completed' | 'failed' | 'heartbeat';

interface EventSourceMessageLike {
  data?: string;
}

interface EventSourceLike {
  addEventListener(type: string, listener: (event: EventSourceMessageLike) => void): void;
  removeEventListener(type: string, listener: (event: EventSourceMessageLike) => void): void;
  close(): void;
}

type EventSourceConstructor = new (url: string) => EventSourceLike;

const FINALIZATION_STATUS_RETRY_CONFIG: RetryConfig = {
  maxRetries: 0,
  initialDelayMs: 1000,
  maxDelayMs: 1000,
  backoffMultiplier: 1,
};

const FINALIZATION_SSE_CONNECT_TIMEOUT_MS = 10000;
const FINALIZATION_SSE_IDLE_TIMEOUT_MS = 45000;

export class SessionApiClient {
  constructor(
    private readonly baseUrl: string,
    private readonly apiKey: VpsConfig['apiKey'],
    private readonly responseHandler: HttpResponseHandler<RequestUrlResponse>,
    private readonly logger: LoggerPort,
    private readonly translations?: Translations,
    private readonly requestContext?: { uploadRunId?: string }
  ) {
    this.logger = logger.child({
      component: 'SessionApiClient',
      ...(requestContext?.uploadRunId ? { uploadRunId: requestContext.uploadRunId } : {}),
    });
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
          ...(this.requestContext?.uploadRunId
            ? { 'x-upload-run-id': this.requestContext.uploadRunId }
            : {}),
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
    ignoreRules?: IgnoreRule[];
    ignoredTags?: string[];
    folderDisplayNames?: Record<string, string>;
    pipelineSignature?: { version: string; renderSettingsHash: string };
    locale?: 'en' | 'fr';
    deduplicationEnabled?: boolean;
    apiOwnedDeterministicNoteTransformsEnabled?: boolean;
  }): Promise<StartSessionResponse> {
    const result = await this.postJson('/api/session/start', {
      notesPlanned: payload.notesPlanned,
      assetsPlanned: payload.assetsPlanned,
      batchConfig: { maxBytesPerRequest: payload.maxBytesPerRequest },
      calloutStyles: payload.calloutStyles ?? [],
      customIndexConfigs: payload.customIndexConfigs ?? [],
      ignoreRules: payload.ignoreRules ?? [],
      ignoredTags: payload.ignoredTags ?? [],
      folderDisplayNames: payload.folderDisplayNames ?? {},
      pipelineSignature: payload.pipelineSignature,
      locale: payload.locale,
      deduplicationEnabled: payload.deduplicationEnabled ?? true,
      apiOwnedDeterministicNoteTransformsEnabled:
        payload.apiOwnedDeterministicNoteTransformsEnabled === true,
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
      existingSourceNoteHashesByVaultPath: parsed.existingSourceNoteHashesByVaultPath ?? {},
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
    },
    options?: {
      onFinalizationUpdate?: (status: FinalizationStatusResponse) => void;
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
    const parsed = JSON.parse(result.text ?? '{}') as FinishSessionResponse | undefined;

    if (parsed?.jobId) {
      options?.onFinalizationUpdate?.({
        jobId: parsed.jobId,
        sessionId,
        status: 'pending',
        progress: 0,
        phase: 'queued',
      });

      if (parsed.realtime?.transport === 'sse') {
        try {
          return await this.waitForFinalizationViaSse(
            sessionId,
            parsed.jobId,
            parsed.realtime,
            options?.onFinalizationUpdate
          );
        } catch (error) {
          if (error instanceof FinalizationTerminalError) {
            throw error;
          }

          const realtimeError = error as FinalizationRealtimeError;
          this.logger.warn('SSE finalization failed, falling back to polling', {
            sessionId,
            jobId: parsed.jobId,
            reason: realtimeError.reason ?? 'unknown',
            error: error instanceof Error ? error.message : String(error),
          });
        }
      }

      return this.waitForFinalization(sessionId, parsed.jobId, options?.onFinalizationUpdate);
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
    jobId: string,
    onFinalizationUpdate?: (status: FinalizationStatusResponse) => void
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
      onFinalizationUpdate?.(parsed);
      this.logger.debug('Finalization job status polled', {
        sessionId,
        jobId,
        status: parsed.status,
        progress: parsed.progress,
        phase: parsed.phase,
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

  private async waitForFinalizationViaSse(
    sessionId: string,
    jobId: string,
    realtime: FinalizationRealtimeMetadata,
    onFinalizationUpdate?: (status: FinalizationStatusResponse) => void
  ): Promise<{
    promotionStats?: {
      notesPublished: number;
      notesDeduplicated: number;
      notesDeleted: number;
      assetsPublished: number;
      assetsDeduplicated: number;
    };
  }> {
    const eventSourceCtor = this.getEventSourceConstructor();
    if (!eventSourceCtor) {
      throw new FinalizationRealtimeError(
        'unsupported',
        'EventSource is not available in this runtime'
      );
    }

    if (!realtime.streamUrl || !realtime.token) {
      throw new FinalizationRealtimeError('invalid_metadata', 'Realtime metadata is incomplete');
    }

    const expiresAtMs = Date.parse(realtime.expiresAt);
    if (Number.isFinite(expiresAtMs) && expiresAtMs <= Date.now()) {
      throw new FinalizationRealtimeError('auth_expired', 'Realtime token is already expired');
    }

    const streamUrl = new URL(this.buildUrl(realtime.streamUrl));
    streamUrl.searchParams.set('token', realtime.token);

    this.logger.debug('Connecting to finalization SSE stream', {
      sessionId,
      jobId,
      streamUrl: streamUrl.pathname,
    });

    return new Promise((resolve, reject) => {
      const eventSource = new eventSourceCtor(streamUrl.toString());
      let settled = false;
      let connected = false;
      let connectTimeout: ReturnType<typeof setTimeout> | null = null;
      let idleTimeout: ReturnType<typeof setTimeout> | null = null;

      const cleanup = () => {
        if (connectTimeout) {
          clearTimeout(connectTimeout);
          connectTimeout = null;
        }

        if (idleTimeout) {
          clearTimeout(idleTimeout);
          idleTimeout = null;
        }

        eventSource.removeEventListener('connected', handleConnected);
        eventSource.removeEventListener('status', handleStatus);
        eventSource.removeEventListener('completed', handleCompleted);
        eventSource.removeEventListener('failed', handleFailed);
        eventSource.removeEventListener('heartbeat', handleHeartbeat);
        eventSource.removeEventListener('error', handleError);
        eventSource.close();
      };

      const settle = (callback: () => void, error?: Error, onBeforeSettle?: () => void): void => {
        if (settled) {
          return;
        }

        settled = true;
        onBeforeSettle?.();
        cleanup();
        callback();

        if (error) {
          reject(error);
        }
      };

      const resetIdleTimeout = () => {
        if (idleTimeout) {
          clearTimeout(idleTimeout);
        }

        idleTimeout = setTimeout(() => {
          settle(
            () => undefined,
            new FinalizationRealtimeError(
              'timeout',
              `SSE finalization stream timed out after ${FINALIZATION_SSE_IDLE_TIMEOUT_MS}ms`
            )
          );
        }, FINALIZATION_SSE_IDLE_TIMEOUT_MS);
      };

      const markConnected = () => {
        connected = true;
        if (connectTimeout) {
          clearTimeout(connectTimeout);
          connectTimeout = null;
        }
        resetIdleTimeout();
      };

      const parseStatusEvent = (
        eventName: FinalizationEventName,
        event: EventSourceMessageLike
      ): FinalizationStatusResponse => {
        if (typeof event.data !== 'string') {
          throw new FinalizationRealtimeError(
            'invalid_payload',
            `SSE ${eventName} event did not include JSON data`
          );
        }

        try {
          return JSON.parse(event.data) as FinalizationStatusResponse;
        } catch {
          throw new FinalizationRealtimeError(
            'invalid_payload',
            `SSE ${eventName} event contained invalid JSON`
          );
        }
      };

      const logStatus = (source: FinalizationEventName, payload: FinalizationStatusResponse) => {
        onFinalizationUpdate?.(payload);
        this.logger.debug('Finalization SSE event received', {
          sessionId,
          jobId,
          source,
          status: payload.status,
          progress: payload.progress,
          phase: payload.phase,
        });
      };

      const handleConnected = (event: EventSourceMessageLike) => {
        try {
          const payload = parseStatusEvent('connected', event);
          markConnected();
          logStatus('connected', payload);
        } catch (error) {
          settle(
            () => undefined,
            error instanceof Error
              ? error
              : new FinalizationRealtimeError(
                  'invalid_payload',
                  'Failed to parse SSE connected event'
                )
          );
        }
      };

      const handleStatus = (event: EventSourceMessageLike) => {
        try {
          const payload = parseStatusEvent('status', event);
          markConnected();
          logStatus('status', payload);
        } catch (error) {
          settle(
            () => undefined,
            error instanceof Error
              ? error
              : new FinalizationRealtimeError('invalid_payload', 'Failed to parse SSE status event')
          );
        }
      };

      const handleCompleted = (event: EventSourceMessageLike) => {
        try {
          const payload = parseStatusEvent('completed', event);
          markConnected();
          logStatus('completed', payload);
          settle(() => resolve({ promotionStats: payload.result?.promotionStats }));
        } catch (error) {
          settle(
            () => undefined,
            error instanceof Error
              ? error
              : new FinalizationRealtimeError(
                  'invalid_payload',
                  'Failed to parse SSE completed event'
                )
          );
        }
      };

      const handleFailed = (event: EventSourceMessageLike) => {
        try {
          const payload = parseStatusEvent('failed', event);
          markConnected();
          logStatus('failed', payload);
          settle(
            () => undefined,
            new FinalizationTerminalError(payload.error || `Finalization job failed: ${jobId}`)
          );
        } catch (error) {
          settle(
            () => undefined,
            error instanceof Error
              ? error
              : new FinalizationRealtimeError('invalid_payload', 'Failed to parse SSE failed event')
          );
        }
      };

      const handleHeartbeat = () => {
        markConnected();
        this.logger.debug('Finalization SSE heartbeat received', { sessionId, jobId });
      };

      const handleError = () => {
        const reason = connected ? 'network_error' : 'connection_error';
        const message = connected
          ? 'Finalization SSE stream disconnected before terminal status'
          : 'Finalization SSE connection could not be established';

        settle(() => undefined, new FinalizationRealtimeError(reason, message));
      };

      eventSource.addEventListener('connected', handleConnected);
      eventSource.addEventListener('status', handleStatus);
      eventSource.addEventListener('completed', handleCompleted);
      eventSource.addEventListener('failed', handleFailed);
      eventSource.addEventListener('heartbeat', handleHeartbeat);
      eventSource.addEventListener('error', handleError);

      connectTimeout = setTimeout(() => {
        settle(
          () => undefined,
          new FinalizationRealtimeError(
            'timeout',
            `SSE connection was not established within ${FINALIZATION_SSE_CONNECT_TIMEOUT_MS}ms`
          )
        );
      }, FINALIZATION_SSE_CONNECT_TIMEOUT_MS);
    });
  }

  private getEventSourceConstructor(): EventSourceConstructor | undefined {
    const candidate = (
      globalThis as typeof globalThis & {
        EventSource?: EventSourceConstructor;
      }
    ).EventSource;

    return typeof candidate === 'function' ? candidate : undefined;
  }
}

class FinalizationTerminalError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'FinalizationTerminalError';
  }
}

class FinalizationRealtimeError extends Error {
  constructor(
    readonly reason:
      | 'unsupported'
      | 'invalid_metadata'
      | 'auth_expired'
      | 'invalid_payload'
      | 'timeout'
      | 'connection_error'
      | 'network_error',
    message: string
  ) {
    super(message);
    this.name = 'FinalizationRealtimeError';
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
