import { type AssetScannerPort, type AssetScanResult, type LoggerPort } from '@core-domain';

/**
 * No-operation asset scanner that always returns "clean".
 * Used when virus scanning is disabled or not configured.
 *
 * IMPORTANT: This scanner does NOT perform actual malware detection.
 * It's a safe default that logs scan attempts but always passes validation.
 * Enable ClamAVAssetScanner for real virus protection.
 */
export class NoopAssetScanner implements AssetScannerPort {
  constructor(private readonly logger?: LoggerPort) {}

  async scan(buffer: Buffer | Uint8Array, filename: string): Promise<AssetScanResult> {
    this.logger?.debug('NoopAssetScanner: Skipping virus scan (scanner disabled)', {
      filename,
      sizeBytes: buffer.length,
    });

    return {
      isClean: true,
      metadata: {
        scannerName: 'NoopAssetScanner',
        scanDurationMs: 0,
      },
    };
  }
}
