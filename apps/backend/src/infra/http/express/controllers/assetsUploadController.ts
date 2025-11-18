import { NextFunction, Request, Response, Router } from 'express';
import { LoggerPort } from '../../../../application/ports/LoggerPort';
import { UploadAssetUseCase } from '../../../../application/usecases/UploadAssetUseCase';
import { ApiAssetsBodyDto } from '../dto/UploadAssetsDto';
import { Asset } from '../../../../domain/entities/Asset';

export function createAssetsUploadController(
  uploadAssetUseCase: UploadAssetUseCase,
  logger?: LoggerPort
): Router {
  const router = Router();

  router.post('/assets/upload', async (req: Request, res: Response, next: NextFunction) => {
    const log = logger?.child({ route: '/assets/upload', method: 'POST' }) ?? logger;

    try {
      const parsed = ApiAssetsBodyDto.safeParse(req.body);

      if (!parsed.success) {
        log?.warn?.('UploadAssetsBodyDto validation error', { error: parsed.error });
        return res.status(400).json({ status: 'invalid_payload' });
      }

      const { assets } : { assets: Asset[] } = parsed.data;
      log?.info?.('Uploading assets batch', { count: assets.length });

      for (const dto of assets) {
        const buffer = Buffer.from(dto.contentBase64, 'base64');

        log?.info?.('Uploading asset', {
          fileName: dto.fileName,
          relativePath: dto.relativePath,
          vaultPath: dto.vaultPath,
          size: buffer.length,
        });

        const asset: Asset = dto; // types compatibles

        await uploadAssetUseCase.execute(asset, buffer);
      }

      log?.info?.('Assets uploaded successfully', { count: assets.length });
      return res
        .status(200)
        .json({ message: 'Assets uploaded successfully', count: assets.length });
    } catch (err) {
      log?.error?.('Error in /api/assets/upload', { error: err });
      return res.status(500).json({ status: 'error' });
    }
  });

  return router;
}
