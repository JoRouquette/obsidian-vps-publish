import { ChunkedUploadService } from '@core-application/publishing/services/chunked-upload.service';
import { processWithControlledConcurrency } from '@core-application/utils/concurrency.util';
import { ProgressStepId } from '@core-domain/entities/progress-step';
import type { ResolvedAssetFile } from '@core-domain/entities/resolved-asset-file';
import type { GuidGeneratorPort } from '@core-domain/ports/guid-generator-port';
import type { LoggerPort } from '@core-domain/ports/logger-port';
import type { ProgressPort } from '@core-domain/ports/progress-port';
import type { StepProgressManagerPort } from '@core-domain/ports/step-progress-manager-port';
import { type UploaderPort } from '@core-domain/ports/uploader-port';

import { type SessionApiClient } from '../services/session-api.client';
import { processWithConcurrencyControl } from '../utils/async-helpers.util';
import { batchByBytesAsync } from '../utils/batch-by-bytes.util';
import { BrowserEncodingAdapter } from './browser-encoding.adapter';
import { AssetChunkUploaderAdapter } from './chunk-uploader.adapter';
import { ObsidianCompressionAdapter } from './obsidian-compression.adapter';

type ApiAsset = {
  relativePath: string;
  vaultPath: string;
  fileName: string;
  mimeType: string;
  contentBase64: string;
};

export class AssetsUploaderAdapter implements UploaderPort {
  private readonly _logger: LoggerPort;
  private readonly chunkedUploadService: ChunkedUploadService;
  private readonly concurrencyLimit: number;

  constructor(
    private readonly sessionClient: SessionApiClient,
    private readonly sessionId: string,
    private readonly guidGenerator: GuidGeneratorPort,
    logger: LoggerPort,
    private readonly maxBytesPerRequest: number,
    private readonly progress?: ProgressPort | StepProgressManagerPort,
    concurrencyLimit?: number
  ) {
    this._logger = logger.child({ adapter: 'AssetsUploaderAdapter' });
    this._logger.debug('AssetsUploaderAdapter initialized');
    this.concurrencyLimit = concurrencyLimit || 3; // Default to 3

    // Initialize dependencies (infrastructure adapters)
    const compression = new ObsidianCompressionAdapter();
    const encoding = new BrowserEncodingAdapter();

    // Initialize chunked upload service from core-application
    this.chunkedUploadService = new ChunkedUploadService(compression, encoding, this._logger, {
      maxChunkSize: Math.min(maxBytesPerRequest / 2, 5 * 1024 * 1024), // Half of max or 5MB
      compressionLevel: 6,
      retryAttempts: 3,
    });
  }

  async upload(assets: ResolvedAssetFile[]): Promise<boolean> {
    if (!Array.isArray(assets) || assets.length === 0) {
      this._logger.debug('No assets to upload.');
      return false;
    }

    this._logger.debug('Preparing to upload assets', {
      assetCount: assets.length,
    });

    let apiAssets: ApiAsset[];
    try {
      // Use controlled concurrency instead of Promise.all to avoid blocking
      apiAssets = await processWithConcurrencyControl(
        assets,
        async (asset) => await this.buildApiAsset(asset),
        {
          concurrency: this.concurrencyLimit, // Use same limit as upload batches
          batchSize: 10, // Yield to event loop every 10 assets
          onProgress: (completed, total) => {
            this._logger.debug('Assets preparation progress', {
              completed,
              total,
              percent: ((completed / total) * 100).toFixed(1),
            });
          },
        }
      );
    } catch (err) {
      this._logger.error('Failed to build API assets', { error: err });
      throw err;
    }

    const batches = await batchByBytesAsync(apiAssets, this.maxBytesPerRequest, (batch) => ({
      assets: batch,
    }));

    this._logger.debug('Uploading assets to session with concurrency=3', {
      batchCount: batches.length,
      assetCount: apiAssets.length,
    });

    // Upload batches in parallel with controlled concurrency
    let batchIndex = 0;
    await processWithControlledConcurrency(
      batches,
      async (batch) => {
        const currentBatchIndex = ++batchIndex;

        // Use chunked upload for each batch
        const uploadId = `assets-${this.sessionId}-${this.guidGenerator.generateGuid()}`;

        this._logger.debug('Preparing chunked upload for batch', {
          uploadId,
          batchIndex: currentBatchIndex,
          totalBatches: batches.length,
          batchSize: batch.length,
        });

        const chunks = await this.chunkedUploadService.prepareUpload(uploadId, { assets: batch });

        // Create uploader adapter for this session
        const uploader = new AssetChunkUploaderAdapter(this.sessionClient, this.sessionId);

        await this.chunkedUploadService.uploadAll(chunks, uploader, (current, total) => {
          this._logger.debug('Chunk upload progress', {
            uploadId,
            batchIndex: currentBatchIndex,
            current,
            total,
            percentComplete: ((current / total) * 100).toFixed(2),
          });
        });

        this._logger.debug('Assets batch uploaded', {
          batchIndex: currentBatchIndex,
          totalBatches: batches.length,
          batchSize: batch.length,
        });
        this.advanceProgress(batch.length);
      },
      {
        concurrency: this.concurrencyLimit, // Configurable batch concurrency
        yieldEveryN: 1, // yield after each batch
        onProgress: (current, total) => {
          this._logger.debug('Batch upload progress', {
            batchesCompleted: current,
            totalBatches: total,
            percentComplete: ((current / total) * 100).toFixed(1),
          });
        },
      }
    );

    this._logger.debug('Assets upload completed');
    return true;
  }

  /**
   * Retourne le nombre de batchs
   */
  async getBatchInfo(assets: ResolvedAssetFile[]): Promise<{ batchCount: number }> {
    if (!Array.isArray(assets) || assets.length === 0) {
      return { batchCount: 0 };
    }

    // Use controlled concurrency for batch info calculation too
    const apiAssets = await processWithConcurrencyControl(
      assets,
      async (asset) => await this.buildApiAsset(asset),
      { concurrency: 5, batchSize: 10 }
    );

    const batches = await batchByBytesAsync(apiAssets, this.maxBytesPerRequest, (batch) => ({
      assets: batch,
    }));

    return {
      batchCount: batches.length,
    };
  }

  private advanceProgress(step: number): void {
    if (!this.progress) return;

    if ('advanceStep' in this.progress) {
      // C'est un StepProgressManagerPort
      this.progress.advanceStep(ProgressStepId.UPLOAD_ASSETS, step);
    } else {
      // C'est un ProgressPort
      this.progress.advance(step);
    }
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
