/* eslint-disable @typescript-eslint/no-misused-promises */
import {
  type AbortSessionHandler,
  type CreateSessionCommand,
  type CreateSessionHandler,
  type FinishSessionHandler,
  type UploadAssetsCommand,
  type UploadAssetsHandler,
  type UploadNotesCommand,
  type UploadNotesHandler,
} from '@core-application';
import { type LoggerPort } from '@core-domain';
import { SessionInvalidError, SessionNotFoundError } from '@core-domain';
import { type Request, type Response, Router } from 'express';

import { type StagingManager } from '../../../filesystem/staging-manager';
import { type CalloutRendererService } from '../../../markdown/callout-renderer.service';
import { type SessionFinalizationJobService } from '../../../sessions/session-finalization-job.service';
import { type SessionFinalizerService } from '../../../sessions/session-finalizer.service';
import { BYTES_LIMIT } from '../app';
import { CreateSessionBodyDto } from '../dto/create-session-body.dto';
import { FinishSessionBodyDto } from '../dto/finish-session-body.dto';
import { ApiAssetsBodyDto } from '../dto/upload-assets.dto';
import { UploadSessionNotesBodyDto } from '../dto/upload-session-notes-body.dto';

export function createSessionController(
  createSessionHandler: CreateSessionHandler,
  finishSessionHandler: FinishSessionHandler,
  abortSessionHandler: AbortSessionHandler,
  notePublicationHandler: UploadNotesHandler,
  assetPublicationHandler: UploadAssetsHandler,
  sessionFinalizer: SessionFinalizerService,
  stagingManager: StagingManager,
  calloutRenderer: CalloutRendererService,
  finalizationJobService: SessionFinalizationJobService,
  logger?: LoggerPort
): Router {
  const router = Router();
  const log = logger?.child({ module: 'sessionController' });

  // Création de session
  router.post('/session/start', async (req: Request, res: Response) => {
    const routeLogger = log?.child({ route: '/session/start', method: 'POST' });

    const parsed = CreateSessionBodyDto.safeParse(req.body);
    if (!parsed.success) {
      routeLogger?.warn('Invalid create session payload', { error: parsed.error });
      return res.status(400).json({ status: 'invalid_payload' });
    }

    // Ensure required fields are present for CreateSessionCommand
    const {
      notesPlanned,
      assetsPlanned,
      batchConfig,
      calloutStyles,
      customIndexConfigs,
      ignoredTags,
    } = parsed.data;
    if (typeof notesPlanned !== 'number' || typeof assetsPlanned !== 'number') {
      routeLogger?.warn('Missing required fields for session creation', {
        notesPlanned,
        assetsPlanned,
      });
      return res.status(400).json({
        status: 'invalid_payload',
        message: 'notesPlanned and assetsPlanned are required',
      });
    }
    const command: CreateSessionCommand = {
      notesPlanned: notesPlanned,
      assetsPlanned: assetsPlanned,
      batchConfig: {
        maxBytesPerRequest: batchConfig.maxBytesPerRequest,
      },
      customIndexConfigs,
      ignoredTags,
    };

    try {
      if (calloutStyles?.length) {
        calloutRenderer.extendFromStyles(calloutStyles);
        routeLogger?.debug('Custom callout styles registered', {
          count: calloutStyles.length,
        });
      }

      const result = await createSessionHandler.handle(command);
      routeLogger?.debug('Session created', { sessionId: result.sessionId });

      return res.status(201).json({
        sessionId: result.sessionId,
        success: result.success,
        maxBytesPerRequest: BYTES_LIMIT,
      });
    } catch (err) {
      routeLogger?.error('Error while creating session', {
        error: err instanceof Error ? err : new Error(String(err)),
      });
      return res.status(500).json({ status: 'error' });
    }
  });

  // Upload des notes pour une session
  router.post('/session/:sessionId/notes/upload', async (req: Request, res: Response) => {
    const routeLogger = log?.child({
      route: '/session/:sessionId/notes/upload',
      method: 'POST',
      sessionId: req.params.sessionId,
    });

    const parsed = UploadSessionNotesBodyDto.safeParse(req.body);
    if (!parsed.success) {
      routeLogger?.warn('Invalid notes upload payload', { error: parsed.error });
      return res.status(400).json({ status: 'invalid_payload' });
    }

    const command: UploadNotesCommand = {
      sessionId: req.params.sessionId,
      notes: parsed.data.notes,
      cleanupRules: parsed.data.cleanupRules,
    };

    try {
      routeLogger?.debug('Publishing notes batch', {
        sessionId: command.sessionId,
        count: command.notes.length,
      });

      const result = await notePublicationHandler.handle(command);

      routeLogger?.debug('Notes published for session', {
        sessionId: result.sessionId,
        published: result.published,
        errorsCount: result.errors?.length,
      });

      return res.status(200).json({
        sessionId: result.sessionId,
        publishedCount: result.published,
        errors: result.errors ?? [],
      });
    } catch (err) {
      routeLogger?.error('Error while publishing notes', {
        error: err instanceof Error ? err : new Error(String(err)),
      });
      return res.status(500).json({ status: 'error' });
    }
  });

  // Upload des assets pour une session
  router.post('/session/:sessionId/assets/upload', async (req: Request, res: Response) => {
    const routeLogger = log?.child({
      route: '/session/:sessionId/assets/upload',
      method: 'POST',
      sessionId: req.params.sessionId,
    });

    const parsed = ApiAssetsBodyDto.safeParse(req.body);
    if (!parsed.success) {
      routeLogger?.warn('Invalid assets upload payload', { error: parsed.error });
      return res.status(400).json({ status: 'invalid_payload' });
    }

    const command: UploadAssetsCommand = {
      sessionId: req.params.sessionId,
      assets: parsed.data.assets,
    };

    try {
      routeLogger?.debug('Publishing assets batch', {
        sessionId: req.params.sessionId,
        count: parsed.data.assets.length,
      });

      const result = await assetPublicationHandler.handle(command);

      return res.status(200).json({
        sessionId: result.sessionId,
        publishedCount: result.published,
        errors: result.errors ?? [],
      });
    } catch (err) {
      routeLogger?.error('Error while publishing assets', {
        error: err instanceof Error ? err : new Error(String(err)),
      });
      return res.status(500).json({ status: 'error' });
    }
  });

  // Fin de session (async with job queue)
  router.post('/session/:sessionId/finish', async (req: Request, res: Response) => {
    const routeLogger = log?.child({
      route: '/session/:sessionId/finish',
      method: 'POST',
      sessionId: req.params.sessionId,
    });

    const parsed = FinishSessionBodyDto.safeParse(req.body);
    if (!parsed.success) {
      routeLogger?.warn('Invalid finish session payload', { error: parsed.error });
      return res.status(400).json({ status: 'invalid_payload' });
    }

    const command = {
      sessionId: req.params.sessionId,
      ...parsed.data,
    };

    try {
      // Update session status (fast)
      const result = await finishSessionHandler.handle(command);
      routeLogger?.debug('Session finished', { sessionId: result.sessionId });

      // Queue heavy finalization work (returns immediately)
      const jobId = await finalizationJobService.queueFinalization(req.params.sessionId);

      routeLogger?.info('Session finalization queued', {
        sessionId: req.params.sessionId,
        jobId,
      });

      // Return 202 Accepted with job ID for status polling
      return res.status(202).json({
        sessionId: result.sessionId,
        success: true,
        jobId,
        message: 'Session finalization in progress',
        statusUrl: `/api/session/${req.params.sessionId}/status`,
      });
    } catch (err) {
      if (err instanceof SessionNotFoundError) {
        routeLogger?.warn('Session not found', { error: err.message });
        return res.status(404).json({ status: 'session_not_found' });
      }

      if (err instanceof SessionInvalidError) {
        routeLogger?.warn('Invalid session state for finish', { error: err.message });
        return res.status(409).json({ status: 'invalid_session_state' });
      }

      routeLogger?.error('Error while finishing session', {
        error: err instanceof Error ? err : new Error(String(err)),
      });
      return res.status(500).json({ status: 'error' });
    }
  });

  // Get session/job status
  router.get('/session/:sessionId/status', async (req: Request, res: Response) => {
    const routeLogger = log?.child({
      route: '/session/:sessionId/status',
      method: 'GET',
      sessionId: req.params.sessionId,
    });

    const job = finalizationJobService.getJobBySessionId(req.params.sessionId);

    if (!job) {
      routeLogger?.warn('No finalization job found for session', {
        sessionId: req.params.sessionId,
      });
      return res.status(404).json({
        status: 'not_found',
        message: 'No finalization job found for this session',
      });
    }

    routeLogger?.debug('Finalization job status retrieved', {
      sessionId: req.params.sessionId,
      jobId: job.jobId,
      status: job.status,
      progress: job.progress,
    });

    return res.status(200).json({
      jobId: job.jobId,
      sessionId: job.sessionId,
      status: job.status,
      progress: job.progress,
      createdAt: job.createdAt,
      startedAt: job.startedAt,
      completedAt: job.completedAt,
      error: job.error,
      result: job.result,
    });
  });

  // Abandon de session
  router.post('/session/:sessionId/abort', async (req: Request, res: Response) => {
    const routeLogger = log?.child({
      route: '/session/:sessionId/abort',
      method: 'POST',
      sessionId: req.params.sessionId,
    });

    const command = { sessionId: req.params.sessionId };

    try {
      const result = await abortSessionHandler.handle(command);
      routeLogger?.debug('Session aborted', { sessionId: result.sessionId });

      await stagingManager.discardSession(req.params.sessionId);

      return res.status(200).json(result);
    } catch (err) {
      if (err instanceof SessionNotFoundError) {
        routeLogger?.warn('Session not found', { error: err.message });
        return res.status(404).json({ status: 'session_not_found' });
      }

      if (err instanceof SessionInvalidError) {
        routeLogger?.warn('Invalid session state for abort', { error: err.message });
        return res.status(409).json({ status: 'invalid_session_state' });
      }

      routeLogger?.error('Error while aborting session', {
        error: err instanceof Error ? err : new Error(String(err)),
      });
      return res.status(500).json({ status: 'error' });
    }
  });

  return router;
}
