import { Request, Response, Router } from 'express';

import {
  AbortSessionHandler,
  CreateSessionCommand,
  CreateSessionHandler,
  FinishSessionHandler,
  UploadAssetsCommand,
  UploadAssetsHandler,
  UploadNotesCommand,
  UploadNotesHandler,
} from '@core-application';
import { LoggerPort } from '@core-domain';
import { SessionInvalidError, SessionNotFoundError } from '@core-domain';
import { CalloutRendererService } from '../../../markdown/callout-renderer.service';
import { SessionFinalizerService } from '../../../sessions/session-finalizer.service';

import { BYTES_LIMIT } from '../app';
import { StagingManager } from '../../../filesystem/staging-manager';
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
    const { notesPlanned, assetsPlanned, batchConfig, calloutStyles } = parsed.data;
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
    };

    try {
      if (calloutStyles?.length) {
        calloutRenderer.extendFromStyles(calloutStyles);
        routeLogger?.info('Custom callout styles registered', {
          count: calloutStyles.length,
        });
      }

      const result = await createSessionHandler.handle(command);
      routeLogger?.info('Session created', { sessionId: result.sessionId });

      const base = '/api/session';

      return res.status(201).json({
        sessionId: result.sessionId,
        success: result.success,
        maxBytesPerRequest: BYTES_LIMIT,
      });
    } catch (err) {
      routeLogger?.error('Error while creating session', { err });
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
    };

    try {
      routeLogger?.info('Publishing notes batch', {
        sessionId: command.sessionId,
        count: command.notes.length,
      });

      const result = await notePublicationHandler.handle(command);

      routeLogger?.info('Notes published for session', {
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
      routeLogger?.error('Error while publishing notes', { err });
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
      routeLogger?.info('Publishing assets batch', {
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
      routeLogger?.error('Error while publishing assets', { err });
      return res.status(500).json({ status: 'error' });
    }
  });

  // Fin de session
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
      const result = await finishSessionHandler.handle(command);
      routeLogger?.info('Session finished', { sessionId: result.sessionId });

      await sessionFinalizer.rebuildFromStored(req.params.sessionId);
      routeLogger?.info('Session content rebuilt from full batch', {
        sessionId: req.params.sessionId,
      });

      await stagingManager.promoteSession(req.params.sessionId);
      routeLogger?.info('Staging promoted to production', { sessionId: req.params.sessionId });

      return res.status(200).json(result);
    } catch (err) {
      if (err instanceof SessionNotFoundError) {
        routeLogger?.warn('Session not found', { error: err.message });
        return res.status(404).json({ status: 'session_not_found' });
      }

      if (err instanceof SessionInvalidError) {
        routeLogger?.warn('Invalid session state for finish', { error: err.message });
        return res.status(409).json({ status: 'invalid_session_state' });
      }

      routeLogger?.error('Error while finishing session', { err });
      return res.status(500).json({ status: 'error' });
    }
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
      routeLogger?.info('Session aborted', { sessionId: result.sessionId });

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

      routeLogger?.error('Error while aborting session', { err });
      return res.status(500).json({ status: 'error' });
    }
  });

  return router;
}
