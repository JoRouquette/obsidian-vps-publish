import { type LoggerPort } from '@core-domain';
import { type Request, type RequestHandler, Router as createRouter } from 'express';

import {
  type FinalizationJob,
  type SessionFinalizationJobService,
} from '../../../sessions/session-finalization-job.service';
import { type FinalizationStreamTokenService } from '../finalization-stream-token.service';
import { type FinalizationStreamAuthorizer } from '../middleware/backpressure.middleware';
import { allowObsidianDesktopOrigin } from '../middleware/cors.middleware';

const FINALIZATION_STREAM_PATH = '/events/session/:sessionId/finalization';

// FINALIZATION_STREAM_PATH as Express matches it at the root of the app: case
// insensitive, optional trailing slash. finalization-stream-authorizer.test.ts
// mounts the real router to keep the two aligned.
const FINALIZATION_STREAM_PATH_PATTERN = /^\/events\/session\/([^/]+)\/finalization\/?$/i;

/**
 * Builds the check the backpressure middleware uses to recognise an
 * authenticated finalization stream. It sits next to the stream handler it
 * mirrors: same route, same query helper, same token check, and a test that
 * compares both on the real router. The middleware adds its own cheap
 * prefilter (GET, SSE Accept header) before calling it. The stream URL handed
 * to the plugin is still built separately, by the session controller.
 *
 * It runs before routing, so the session id comes from the path, decoded the
 * way Express decodes route parameters. The query is already parsed by Express
 * at that point.
 */
export function createFinalizationStreamAuthorizer(
  tokenService: FinalizationStreamTokenService
): FinalizationStreamAuthorizer {
  return (req: Request): boolean => {
    const match = FINALIZATION_STREAM_PATH_PATTERN.exec(req.path);
    if (!match) {
      return false;
    }

    let sessionId: string;
    try {
      sessionId = decodeURIComponent(match[1]);
    } catch {
      return false;
    }

    const jobId = getSingleQueryParam(req.query.jobId);
    if (!jobId) {
      return false;
    }

    const token = getSingleQueryParam(req.query.token);
    return tokenService.validateToken(token, sessionId, jobId).ok;
  };
}

export function createFinalizationEventsController(
  finalizationJobService: SessionFinalizationJobService,
  tokenService: FinalizationStreamTokenService,
  logger?: LoggerPort
) {
  const router = createRouter();
  const log = logger?.child({ module: 'finalizationEventsController' });

  // Typed explicitly: extracted from the `router.get` call, the handler would
  // otherwise lose the contextual `RouteParameters` inference and `req.params`
  // would widen to a dictionary of strings, where a misspelt param still compiles.
  const streamFinalization: RequestHandler<{ sessionId: string }> = (req, res) => {
    const { sessionId } = req.params;
    const jobId = getSingleQueryParam(req.query.jobId);
    const token = getSingleQueryParam(req.query.token);

    if (!jobId) {
      log?.warn('Finalization SSE request missing jobId', { sessionId });
      return res.status(400).json({ error: 'missing jobId' });
    }

    const validation = tokenService.validateToken(token, sessionId, jobId);
    if (!validation.ok) {
      const statusCode = validation.reason === 'expired' ? 410 : 403;
      log?.warn('Finalization SSE token rejected', {
        sessionId,
        jobId,
        reason: validation.reason,
      });
      return res.status(statusCode).json({ error: validation.reason });
    }

    const initialJob = finalizationJobService.getJobStatus(jobId);
    if (!initialJob || initialJob.sessionId !== sessionId) {
      log?.warn('Finalization SSE job not found', { sessionId, jobId });
      return res.status(404).json({ error: 'job_not_found' });
    }

    const clientId = Math.random().toString(36).slice(2, 10);
    log?.debug('Finalization SSE client connected', { clientId, sessionId, jobId });

    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache, no-store');
    res.setHeader('Connection', 'keep-alive');
    res.setHeader('X-Accel-Buffering', 'no');
    res.flushHeaders();

    let closed = false;
    let heartbeatInterval: NodeJS.Timeout | null = null;
    let unsubscribe: (() => void) | null = null;

    const cleanup = () => {
      if (closed) {
        return;
      }

      closed = true;
      if (heartbeatInterval) {
        clearInterval(heartbeatInterval);
        heartbeatInterval = null;
      }

      unsubscribe?.();
      unsubscribe = null;
      log?.debug('Finalization SSE client disconnected', { clientId, sessionId, jobId });
    };

    const sendEvent = (eventName: string, payload: unknown) => {
      if (closed) {
        return;
      }

      res.write(`event: ${eventName}\n`);
      res.write(`data: ${JSON.stringify(payload)}\n\n`);
    };

    const emitJobEvent = (job: FinalizationJob) => {
      const payload = toJobStatusPayload(job);

      if (job.status === 'completed') {
        sendEvent('completed', payload);
        cleanup();
        res.end();
        return;
      }

      if (job.status === 'failed') {
        sendEvent('failed', payload);
        cleanup();
        res.end();
        return;
      }

      sendEvent('status', payload);
    };

    sendEvent('connected', toJobStatusPayload(initialJob));

    unsubscribe = finalizationJobService.subscribe(jobId, (job) => {
      if (job.sessionId !== sessionId) {
        return;
      }

      emitJobEvent(job);
    });

    heartbeatInterval = setInterval(() => {
      try {
        sendEvent('heartbeat', { timestamp: new Date().toISOString() });
      } catch {
        cleanup();
      }
    }, 30000);

    if (heartbeatInterval.unref) {
      heartbeatInterval.unref();
    }

    if (initialJob.status === 'completed' || initialJob.status === 'failed') {
      emitJobEvent(initialJob);
      return;
    }

    req.on('close', cleanup);
    req.on('error', () => cleanup());
  };

  // This stream is the only request the plugin makes that the browser subjects to
  // CORS; everything else goes through Obsidian's `requestUrl`, which bypasses it.
  // The allowance is mounted on this route rather than on the global middleware so
  // that `ALLOWED_ORIGINS` stays the sole authority everywhere else.
  router.get(FINALIZATION_STREAM_PATH, allowObsidianDesktopOrigin, streamFinalization);

  return router;
}

function getSingleQueryParam(value: unknown): string | undefined {
  if (typeof value === 'string') {
    return value;
  }

  if (Array.isArray(value) && value.length > 0 && typeof value[0] === 'string') {
    return value[0];
  }

  return undefined;
}

function toJobStatusPayload(job: FinalizationJob) {
  return {
    jobId: job.jobId,
    sessionId: job.sessionId,
    status: job.status,
    progress: job.progress,
    phase: job.phase,
    phaseTimings: job.phaseTimings,
    contentRevision: job.contentRevision,
    createdAt: job.createdAt,
    startedAt: job.startedAt,
    completedAt: job.completedAt,
    error: job.error,
    result: job.result,
  };
}
