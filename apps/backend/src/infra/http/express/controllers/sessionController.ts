import { Router } from 'express';
import { LoggerPort } from '../../../../application/ports/LoggerPort';
import { UploadNotesHandler } from '../../../../application/publishing/handlers/UploadNotesHandler';
import { UploadAssetsHandler } from '../../../../application/publishing/handlers/UploadAssetsHandler';

export function createSessionController(
  notePublicationHandler: UploadNotesHandler,
  assetPublicationHandler: UploadAssetsHandler,
  logger?: LoggerPort
): Router {
  const router = Router();

  router.post('/session/start', createSession(logger));

  router.post('/session/:sessionId/notes/upload', uploadNotes(notePublicationHandler, logger));

  router.post('/session/:sessionId/assets/upload', uploadAssets(assetPublicationHandler, logger));

  router.post('/session/finish', finishSession(logger));

  router.post('/session/:sessionId/abort', abortSession(logger));

  return router;
}

function createSession(logger?: LoggerPort) {
  return (req: any, res: any) => {};
}

function uploadNotes(notePublicationHandler: UploadNotesHandler, logger?: LoggerPort) {
  return (req: any, res: any) => {};
}

function uploadAssets(assetPublicationHandler: UploadAssetsHandler, logger?: LoggerPort) {
  return (req: any, res: any) => {};
}

function finishSession(logger?: LoggerPort) {
  return (req: any, res: any) => {};
}

function abortSession(logger?: LoggerPort) {
  return (req: any, res: any) => {};
}
