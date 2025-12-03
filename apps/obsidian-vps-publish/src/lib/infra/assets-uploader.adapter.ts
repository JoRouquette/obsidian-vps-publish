import { UploaderPort } from '@core-domain/ports/uploader-port';
import type { ResolvedAssetFile } from '@core-domain/entities/resolved-asset-file';
import type { LoggerPort } from '@core-domain/ports/logger-port';
import type { ProgressPort } from '@core-domain/ports/progress-port';
import { SessionApiClient } from '../services/session-api.client';
import { batchByBytes } from '../utils/batch-by-bytes.util';

type ApiAsset = {
  relativePath: string;
  vaultPath: string;
  fileName: string;
  mimeType: string;
  contentBase64: string;
};

export class AssetsUploaderAdapter implements UploaderPort {
  private readonly _logger: LoggerPort;

  constructor(
    private readonly sessionClient: SessionApiClient,
    private readonly sessionId: string,
    logger: LoggerPort,
    private readonly maxBytesPerRequest: number,
    private readonly progress?: ProgressPort
  ) {
    this._logger = logger.child({ adapter: 'AssetsUploaderAdapter' });
    this._logger.debug('AssetsUploaderAdapter initialized');
  }

  async upload(assets: ResolvedAssetFile[]): Promise<boolean> {
    if (!Array.isArray(assets) || assets.length === 0) {
      this._logger.info('No assets to upload.');
      return false;
    }

    this._logger.debug('Preparing to upload assets', {
      assetCount: assets.length,
    });

    let apiAssets: ApiAsset[];
    try {
      apiAssets = await Promise.all(assets.map(async (asset) => await this.buildApiAsset(asset)));
    } catch (err) {
      this._logger.error('Failed to build API assets', err);
      throw err;
    }

    const batches = batchByBytes(apiAssets, this.maxBytesPerRequest, (batch) => ({
      assets: batch,
    }));

    this._logger.info('Uploading assets to session', {
      batchCount: batches.length,
      assetCount: apiAssets.length,
    });

    for (const batch of batches) {
      await this.sessionClient.uploadAssets(this.sessionId, batch);
      this._logger.debug('Assets batch uploaded', { batchSize: batch.length });
      this.progress?.advance(batch.length);
    }

    this._logger.info('Assets upload completed');
    return true;
  }

  private async buildApiAsset(asset: ResolvedAssetFile): Promise<ApiAsset> {
    this._logger.debug('Building API asset', { fileName: asset.fileName });

    const mimeType =
      asset.mimeType ?? this.guessMimeType(asset.fileName) ?? 'application/octet-stream';

    const content = asset.content;
    if (!content) {
      this._logger.error('ResolvedAssetFile has no content', { asset });
      throw new Error('ResolvedAssetFile has no content');
    }

    const contentBase64 = await this.toBase64(content);

    return {
      relativePath: asset.relativeAssetPath,
      vaultPath: asset.vaultPath,
      fileName: asset.fileName,
      mimeType,
      contentBase64,
    };
  }

  private async toBase64(content: ArrayBuffer | Uint8Array): Promise<string> {
    if (content instanceof ArrayBuffer) {
      return Buffer.from(content).toString('base64');
    }
    if (content instanceof Uint8Array) {
      return Buffer.from(content.buffer, content.byteOffset, content.byteLength).toString('base64');
    }
    this._logger.error('Unsupported asset content type', {
      contentType: typeof content,
    });
    throw new Error('Unsupported asset content type');
  }

  private guessMimeType(fileName: string): string {
    const ext = fileName.split('.').pop()?.toLowerCase();
    switch (ext) {
      case 'png':
        return 'image/png';
      case 'jpg':
      case 'jpeg':
        return 'image/jpeg';
      case 'gif':
        return 'image/gif';
      case 'svg':
        return 'image/svg+xml';
      case 'webp':
        return 'image/webp';
      case 'pdf':
        return 'application/pdf';
      case 'mp3':
        return 'audio/mpeg';
      case 'wav':
        return 'audio/wav';
      case 'ogg':
        return 'audio/ogg';
      case 'mp4':
        return 'video/mp4';
      case 'webm':
        return 'video/webm';
      default:
        return 'application/octet-stream';
    }
  }
}
