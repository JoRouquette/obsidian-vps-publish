import { NextFunction, Request, Response, Router } from 'express';
import { LoggerPort } from '../../../../application/ports/LoggerPort';
import { UploadAssetUseCase } from '../../../../application/usecases/UploadAssetUseCase';
import { UploadAssetDto } from '../dto/UploadAssetsDto';

export function createAssetsUploadController(
  uploadAssetUseCase: UploadAssetUseCase,
  logger?: LoggerPort
): Router {
  const router = Router();

  router.post('/assets/upload', async (req: Request, res: Response, next: NextFunction) => {
    const log = logger?.child({ route: '/assets/upload', method: 'POST' }) ?? logger;
    try {
      const parsed = UploadAssetDto.safeParse(req.body);

      if (!parsed.success) {
        log?.warn?.('UploadAssetDto validation error', { error: parsed.error });
        return res.status(400).json({ status: 'invalid_payload' });
      }

      const dto = parsed.data;

      const buffer = Buffer.from(dto.contentBase64, 'base64');

      log?.info?.('Uploading asset', {
        noteId: dto.noteId,
        noteRoute: dto.noteRoute,
        relativeAssetPath: dto.relativeAssetPath,
        fileName: dto.fileName,
      });

      await uploadAssetUseCase.execute({
        noteId: dto.noteId,
        noteRoute: dto.noteRoute,
        relativeAssetPath: dto.relativeAssetPath,
        fileName: dto.fileName,
        content: buffer,
      });

      log?.info?.('Asset uploaded successfully', { fileName: dto.fileName });
      return res.status(200).json({ message: 'Asset uploaded successfully' });
    } catch (err) {
      log?.error?.('Error in /api/assets/upload', { error: err });
      return res.status(500).json({ status: 'error' });
    }
  });

  return router;
}
