import { type LoggerPort } from '@core-domain';
import { type Request, type Response, Router as createRouter } from 'express';

import {
  type FinalizationJob,
  type SessionFinalizationJobService,
} from '../../../sessions/session-finalization-job.service';
import { type FinalizationStreamTokenService } from '../finalization-stream-token.service';

export function createFinalizationEventsController(
  finalizationJobService: SessionFinalizationJobService,
  tokenService: FinalizationStreamTokenService,
  logger?: LoggerPort
) {
  const router = createRouter();
  const log = logger?.child({ module: 'finalizationEventsController' });

  router.get('/events/session/:sessionId/finalization', (req: Request, res: Response) => {
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
  });

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
