import {
  type AbortSessionHandler,
  type CreateSessionCommand,
  type CreateSessionHandler,
  type FinishSessionHandler,
  type SessionRepository,
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
import { BYTES_LIMIT } from '../app';
import { CreateSessionBodyDto } from '../dto/create-session-body.dto';
import { FinishSessionBodyDto } from '../dto/finish-session-body.dto';
import { ApiAssetsBodyDto } from '../dto/upload-assets.dto';
import { UploadSessionNotesBodyDto } from '../dto/upload-session-notes-body.dto';
import { asyncRoute } from './async-route.util';

export type SessionControllerDependencies = {
  createSessionHandler: CreateSessionHandler;
  finishSessionHandler: FinishSessionHandler;
  abortSessionHandler: AbortSessionHandler;
  notePublicationHandler: UploadNotesHandler;
  assetPublicationHandler: UploadAssetsHandler;
  stagingManager: StagingManager;
  calloutRenderer: CalloutRendererService;
  finalizationJobService: SessionFinalizationJobService;
  sessionRepository: SessionRepository;
  logger?: LoggerPort;
};

export class SessionControllerBuilder {
  private readonly dependencies: Partial<SessionControllerDependencies> = {};

  withCreateSessionHandler(handler: CreateSessionHandler): this {
    this.dependencies.createSessionHandler = handler;
    return this;
  }

  withFinishSessionHandler(handler: FinishSessionHandler): this {
    this.dependencies.finishSessionHandler = handler;
    return this;
  }

  withAbortSessionHandler(handler: AbortSessionHandler): this {
    this.dependencies.abortSessionHandler = handler;
    return this;
  }

  withNotePublicationHandler(handler: UploadNotesHandler): this {
    this.dependencies.notePublicationHandler = handler;
    return this;
  }

  withAssetPublicationHandler(handler: UploadAssetsHandler): this {
    this.dependencies.assetPublicationHandler = handler;
    return this;
  }

  withStagingManager(stagingManager: StagingManager): this {
    this.dependencies.stagingManager = stagingManager;
    return this;
  }

  withCalloutRenderer(calloutRenderer: CalloutRendererService): this {
    this.dependencies.calloutRenderer = calloutRenderer;
    return this;
  }

  withFinalizationJobService(finalizationJobService: SessionFinalizationJobService): this {
    this.dependencies.finalizationJobService = finalizationJobService;
    return this;
  }

  withSessionRepository(sessionRepository: SessionRepository): this {
    this.dependencies.sessionRepository = sessionRepository;
    return this;
  }

  withLogger(logger?: LoggerPort): this {
    this.dependencies.logger = logger;
    return this;
  }

  build(): Router {
    return createSessionController(ensureDependencies(this.dependencies));
  }
}

export function createSessionController({
  createSessionHandler,
  finishSessionHandler,
  abortSessionHandler,
  notePublicationHandler,
  assetPublicationHandler,
  stagingManager,
  calloutRenderer,
  finalizationJobService,
  sessionRepository,
  logger,
}: SessionControllerDependencies): Router {
  const router = Router();
  const log = logger?.child({ module: 'sessionController' });
  const serverBytesLimit = parseBytesLimit(BYTES_LIMIT);

  // Création de session
  router.post(
    '/session/start',
    asyncRoute(async (req: Request, res: Response) => {
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
        folderDisplayNames,
        pipelineSignature,
        locale,
        deduplicationEnabled,
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
        folderDisplayNames,
        pipelineSignature,
        locale,
        deduplicationEnabled,
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
        const effectiveMaxBytesPerRequest = Math.min(
          batchConfig.maxBytesPerRequest,
          serverBytesLimit
        );

        return res.status(201).json({
          sessionId: result.sessionId,
          success: result.success,
          maxBytesPerRequest: effectiveMaxBytesPerRequest,
          existingAssetHashes: result.existingAssetHashes ?? [],
          existingNoteHashes: result.existingNoteHashes ?? {},
          pipelineChanged: result.pipelineChanged,
          deduplicationEnabled: result.deduplicationEnabled ?? true,
        });
      } catch (err) {
        routeLogger?.error('Error while creating session', {
          error: err instanceof Error ? err : new Error(String(err)),
        });
        return res.status(500).json({ status: 'error' });
      }
    })
  );

  // Upload des notes pour une session
  router.post(
    '/session/:sessionId/notes/upload',
    asyncRoute(async (req: Request, res: Response) => {
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

      try {
        // Fetch session to get folderDisplayNames (only for first batch)
        const session = await sessionRepository.findById(req.params.sessionId);

        const command: UploadNotesCommand = {
          sessionId: req.params.sessionId,
          notes: parsed.data.notes,
          cleanupRules: parsed.data.cleanupRules,
          folderDisplayNames: session?.folderDisplayNames, // Pass displayNames from session
        };
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
    })
  );

  // Upload des assets pour une session
  router.post(
    '/session/:sessionId/assets/upload',
    asyncRoute(async (req: Request, res: Response) => {
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

      try {
        const session = await sessionRepository.findById(req.params.sessionId);
        const command: UploadAssetsCommand = {
          sessionId: req.params.sessionId,
          assets: parsed.data.assets,
          deduplicationEnabled: session?.deduplicationEnabled !== false,
        };

        routeLogger?.debug('Publishing assets batch', {
          sessionId: req.params.sessionId,
          count: parsed.data.assets.length,
        });

        const result = await assetPublicationHandler.handle(command);

        routeLogger?.debug('Asset publication result', {
          sessionId: result.sessionId,
          published: result.published,
          skipped: result.skipped,
          hasRenamedAssets: !!result.renamedAssets,
          renamedAssetsCount: result.renamedAssets ? Object.keys(result.renamedAssets).length : 0,
          renamedAssets: result.renamedAssets,
        });

        // If any assets were renamed (e.g., .png → .webp), save mappings to session
        if (result.renamedAssets && Object.keys(result.renamedAssets).length > 0) {
          if (session) {
            // Merge with existing mappings (multiple batches may add more)
            const existingMappings = session.assetPathMappings ?? {};
            await sessionRepository.save({
              ...session,
              assetPathMappings: { ...existingMappings, ...result.renamedAssets },
            });
            routeLogger?.debug('Saved asset path mappings to session', {
              newMappings: Object.keys(result.renamedAssets).length,
              totalMappings:
                Object.keys(existingMappings).length + Object.keys(result.renamedAssets).length,
            });
          }
        }

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
    })
  );

  // Fin de session (async with job queue)
  router.post(
    '/session/:sessionId/finish',
    asyncRoute(async (req: Request, res: Response) => {
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

        // Queue heavy finalization work
        const jobId = await finalizationJobService.queueFinalization(req.params.sessionId);

        routeLogger?.info('Session finalization queued, waiting for completion', {
          sessionId: req.params.sessionId,
          jobId,
        });

        // Wait for job to complete (with 2 minutes timeout)
        const completedJob = await finalizationJobService.waitForJob(jobId, 120000);

        routeLogger?.info('Session finalization completed', {
          sessionId: req.params.sessionId,
          jobId,
          promotionStats: completedJob.result?.promotionStats,
        });

        // Return 200 OK with promotion stats
        return res.status(200).json({
          sessionId: result.sessionId,
          success: true,
          contentRevision: completedJob.result?.contentRevision,
          promotionStats: completedJob.result?.promotionStats,
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
    })
  );

  // Get session/job status
  router.get(
    '/session/:sessionId/status',
    asyncRoute(async (req: Request, res: Response) => {
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
    })
  );

  // Abandon de session
  router.post(
    '/session/:sessionId/abort',
    asyncRoute(async (req: Request, res: Response) => {
      const routeLogger = log?.child({
        route: '/session/:sessionId/abort',
        method: 'POST',
        sessionId: req.params.sessionId,
      });

      const command = { sessionId: req.params.sessionId };

      try {
        const result = await abortSessionHandler.handle(command);
        routeLogger?.debug('Session aborted', { sessionId: result.sessionId });
        try {
          await stagingManager.discardSession(req.params.sessionId);
        } catch (cleanupError) {
          routeLogger?.warn('Session aborted but staging cleanup failed', {
            error: cleanupError instanceof Error ? cleanupError.message : String(cleanupError),
          });
        }

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
    })
  );

  return router;
}

function ensureDependencies(
  dependencies: Partial<SessionControllerDependencies>
): SessionControllerDependencies {
  const missing: string[] = [];

  if (!dependencies.createSessionHandler) missing.push('createSessionHandler');
  if (!dependencies.finishSessionHandler) missing.push('finishSessionHandler');
  if (!dependencies.abortSessionHandler) missing.push('abortSessionHandler');
  if (!dependencies.notePublicationHandler) missing.push('notePublicationHandler');
  if (!dependencies.assetPublicationHandler) missing.push('assetPublicationHandler');
  if (!dependencies.stagingManager) missing.push('stagingManager');
  if (!dependencies.calloutRenderer) missing.push('calloutRenderer');
  if (!dependencies.finalizationJobService) missing.push('finalizationJobService');
  if (!dependencies.sessionRepository) missing.push('sessionRepository');

  if (missing.length > 0) {
    throw new Error(`Cannot build session controller, missing dependencies: ${missing.join(', ')}`);
  }

  return dependencies as SessionControllerDependencies;
}

function parseBytesLimit(value: string | number): number {
  if (typeof value === 'number' && Number.isFinite(value) && value > 0) {
    return value;
  }

  if (typeof value === 'string') {
    const match = new RegExp(/^(\d+(?:\.\d+)?)\s*(kb|mb|gb)?$/i).exec(value.trim());
    if (match) {
      const amount = Number.parseFloat(match[1]);
      const unit = match[2]?.toLowerCase();
      if (unit === 'gb') return Math.floor(amount * 1024 * 1024 * 1024);
      if (unit === 'mb') return Math.floor(amount * 1024 * 1024);
      if (unit === 'kb') return Math.floor(amount * 1024);
      return Math.floor(amount);
    }
  }

  return 50 * 1024 * 1024;
}
