import { ChunkedUploadService } from '@core-application/publishing/services/chunked-upload.service';
import { processWithControlledConcurrency } from '@core-application/utils/concurrency.util';
import { ProgressStepId } from '@core-domain/entities/progress-step';
import type { ResolvedAssetFile } from '@core-domain/entities/resolved-asset-file';
import type { AssetHashPort } from '@core-domain/ports/asset-hash-port';
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

type PreparedAssetUpload = {
  apiAssets: ApiAsset[];
  filteredAssets: ApiAsset[];
  skippedCount: number;
  batches: ApiAsset[][];
};

export class AssetsUploaderAdapter implements UploaderPort {
  private readonly _logger: LoggerPort;
  private readonly chunkedUploadService: ChunkedUploadService;
  private readonly concurrencyLimit: number;
  private readonly existingAssetHashes: Set<string>;
  private readonly deduplicationEnabled: boolean;
  private readonly preparedUploadsByAssetList = new WeakMap<
    ResolvedAssetFile[],
    Promise<PreparedAssetUpload>
  >();
  private readonly apiAssetsBySourceAsset = new WeakMap<ResolvedAssetFile, Promise<ApiAsset>>();

  constructor(
    private readonly sessionClient: SessionApiClient,
    private readonly sessionId: string,
    private readonly guidGenerator: GuidGeneratorPort,
    private readonly assetHasher: AssetHashPort,
    logger: LoggerPort,
    private readonly maxBytesPerRequest: number,
    private readonly progress?: ProgressPort | StepProgressManagerPort,
    concurrencyLimit?: number,
    existingAssetHashes?: string[],
    deduplicationEnabled = true
  ) {
    this._logger = logger.child({ adapter: 'AssetsUploaderAdapter' });
    this._logger.debug('AssetsUploaderAdapter initialized');
    this.concurrencyLimit = concurrencyLimit || 3; // Default to 3
    this.deduplicationEnabled = deduplicationEnabled;
    this.existingAssetHashes = new Set(
      this.deduplicationEnabled ? (existingAssetHashes ?? []) : []
    );

    if (this.existingAssetHashes.size > 0) {
      this._logger.debug('Client-side deduplication enabled', {
        existingAssetHashesCount: this.existingAssetHashes.size,
      });
    } else if (!this.deduplicationEnabled) {
      this._logger.info('Client-side deduplication disabled for assets upload');
    }

    // Initialize dependencies (infrastructure adapters)
    const compression = new ObsidianCompressionAdapter();
    const encoding = new BrowserEncodingAdapter();

    // Initialize chunked upload service from core-application
    this.chunkedUploadService = new ChunkedUploadService(compression, encoding, this._logger, {
      maxChunkSize: Math.min(maxBytesPerRequest / 2, 5 * 1024 * 1024), // Half of max or 5MB
      maxRequestBytes: maxBytesPerRequest,
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
    const uploadPrepStart = performance.now();

    const prepared = await this.getOrPrepareUpload(assets);
    const { apiAssets, filteredAssets, skippedCount, batches } = prepared;
    this._logger.debug('Asset upload preparation completed', {
      asset_upload_prep_duration_ms: performance.now() - uploadPrepStart,
      totalAssets: apiAssets.length,
      filteredAssets: filteredAssets.length,
      skippedAssets: skippedCount,
      batchCount: batches.length,
    });

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
    const batchInfoStart = performance.now();
    const prepared = await this.getOrPrepareUpload(assets);
    this._logger.debug('Asset batch info computed', {
      asset_batch_info_duration_ms: performance.now() - batchInfoStart,
      assetCount: assets.length,
      batchCount: prepared.batches.length,
    });

    return {
      batchCount: prepared.batches.length,
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

  private async getOrPrepareUpload(assets: ResolvedAssetFile[]): Promise<PreparedAssetUpload> {
    const existing = this.preparedUploadsByAssetList.get(assets);
    if (existing) {
      return existing;
    }

    const preparedUploadPromise = this.prepareUploadInternal(assets);
    this.preparedUploadsByAssetList.set(assets, preparedUploadPromise);
    return preparedUploadPromise;
  }

  private async prepareUploadInternal(assets: ResolvedAssetFile[]): Promise<PreparedAssetUpload> {
    let apiAssets: ApiAsset[];
    try {
      apiAssets = await processWithConcurrencyControl(
        assets,
        async (asset) => await this.getOrBuildApiAsset(asset),
        {
          concurrency: this.concurrencyLimit,
          batchSize: 10,
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

    let filteredAssets = apiAssets;
    let skippedCount = 0;

    if (this.deduplicationEnabled && this.existingAssetHashes.size > 0) {
      this._logger.debug('Computing asset hashes for client-side deduplication');
      const assetsWithHashes = await Promise.all(
        apiAssets.map(async (apiAsset) => {
          const assetBuffer = Buffer.from(apiAsset.contentBase64, 'base64');
          const hash = await this.assetHasher.computeHash(assetBuffer);
          return { apiAsset, hash };
        })
      );

      const newAssets = assetsWithHashes.filter((item) => {
        const exists = this.existingAssetHashes.has(item.hash);
        if (exists) {
          this._logger.debug('Asset already exists on server, skipping', {
            fileName: item.apiAsset.fileName,
            hash: item.hash,
          });
        }
        return !exists;
      });

      skippedCount = apiAssets.length - newAssets.length;
      filteredAssets = newAssets.map((item) => item.apiAsset);

      this._logger.info('Client-side deduplication completed', {
        totalAssets: apiAssets.length,
        skippedAssets: skippedCount,
        newAssets: filteredAssets.length,
      });
    }

    const batches = await batchByBytesAsync(filteredAssets, this.maxBytesPerRequest, (batch) => ({
      assets: batch,
    }));

    return {
      apiAssets,
      filteredAssets,
      skippedCount,
      batches,
    };
  }

  private async getOrBuildApiAsset(asset: ResolvedAssetFile): Promise<ApiAsset> {
    const existing = this.apiAssetsBySourceAsset.get(asset);
    if (existing) {
      return existing;
    }

    const buildPromise = this.buildApiAsset(asset);
    this.apiAssetsBySourceAsset.set(asset, buildPromise);
    return buildPromise;
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
