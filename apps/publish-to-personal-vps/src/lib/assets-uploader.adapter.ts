import { UploaderPort } from '@core-domain/publish/uploader-port';
import { HttpResponseHandler } from '@core-application/publish/handler/http-response.handler';
import { requestUrl, RequestUrlResponse } from 'obsidian';
import type { ResolvedAssetFile } from '@core-domain/publish/ResolvedAssetFile';
import type { VpsConfig } from '@core-domain/publish/VpsConfig';
import type { LoggerPort } from '@core-domain/publish/ports/logger-port';

type ApiAsset = {
  relativePath: string;
  vaultPath: string;
  fileName: string;
  mimeType: string;
  contentBase64: string;
};

export class AssetsUploaderAdapter implements UploaderPort {
  private readonly _logger: LoggerPort;
  private readonly _handleResponse: HttpResponseHandler<RequestUrlResponse>;
  private readonly vpsConfig: VpsConfig;

  constructor(
    vpsConfig: VpsConfig,
    handleResponse: HttpResponseHandler<RequestUrlResponse>,
    logger: LoggerPort
  ) {
    this.vpsConfig = vpsConfig;
    this._logger = logger.child({ adapter: 'AssetsUploaderAdapter' });
    this._handleResponse = handleResponse;
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
      apiAssets = await Promise.all(
        assets.map(async (asset) => await this.buildApiAsset(asset))
      );
    } catch (err) {
      this._logger.error('Failed to build API assets', err);
      throw err;
    }

    const body = { assets: apiAssets };
    const vps = this.vpsConfig;

    const url = vps.url.replace(/\/$/, '') + '/api/assets/upload';

    this._logger.info('Uploading assets to VPS', {
      url,
      assetCount: apiAssets.length,
    });

    try {
      const response = await requestUrl({
        url,
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': vps.apiKey,
        },
        body: JSON.stringify(body),
        throw: false,
      });

      const result = await this._handleResponse.handleResponseAsync({
        response,
        url,
      });

      this._logger.info('Assets upload completed');

      if (result.isError) {
        this._logger.error('Assets upload failed', {
          error: result.error,
          httpStatus: result.httpStatus,
          text: result.text,
        });

        throw result.error ?? new Error('Unknown assets upload error');
      }

      this._logger.debug('Assets upload response', {
        httpStatus: result.httpStatus,
        text: result.text,
      });

      return true;
    } catch (err) {
      this._logger.error('HTTP request to upload assets failed', err);
      throw err;
    }
  }

  private async buildApiAsset(asset: ResolvedAssetFile): Promise<ApiAsset> {
    this._logger.debug('Building API asset', { fileName: asset.fileName });

    const mimeType =
      asset.mimeType ??
      this.guessMimeType(asset.fileName) ??
      'application/octet-stream';

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
      return Buffer.from(
        content.buffer,
        content.byteOffset,
        content.byteLength
      ).toString('base64');
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
