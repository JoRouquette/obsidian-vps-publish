import { Router, Request, Response, NextFunction } from 'express';
import { UploadAssetUseCase } from '../../../../application/usecases/UploadAssetUseCase';
import { UploadAssetDto } from '../dto/UploadAssetsDto';

export function createAssetsUploadController(uploadAssetUseCase: UploadAssetUseCase): Router {
  const router = Router();

  router.post('/assets/upload', async (req: Request, res: Response, next: NextFunction) => {
    try {
      const parsed = UploadAssetDto.safeParse(req.body);

      if (!parsed.success) {
        console.error('UploadAssetDto validation error', parsed.error);
        return res.status(400).json({ status: 'invalid_payload' });
      }

      const dto = parsed.data;

      const buffer = Buffer.from(dto.contentBase64, 'base64');

      await uploadAssetUseCase.execute({
        noteId: dto.noteId,
        noteRoute: dto.noteRoute,
        relativeAssetPath: dto.relativeAssetPath,
        fileName: dto.fileName,
        content: buffer,
      });

      return res.json({ status: 'ok' });
    } catch (err) {
      console.error('Error in /api/assets/upload', err);
      return res.status(500).json({ status: 'error' });
    }
  });

  return router;
}
