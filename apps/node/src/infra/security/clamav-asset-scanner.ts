import { Readable } from 'node:stream';

import {
  AssetScanError,
  type AssetScannerPort,
  type AssetScanResult,
  type LoggerPort,
} from '@core-domain';
import NodeClam from 'clamscan';

export interface ClamAVConfig {
  host: string;
  port: number;
  timeout: number; // milliseconds
}

/**
 * Asset scanner that uses ClamAV (clamd) for real virus detection.
 * Connects to ClamAV daemon via TCP socket.
 *
 * PREREQUISITES:
 * - ClamAV daemon (clamd) must be running and accessible
 * - Docker: use official clamav/clamav image or similar
 * - Local: install clamav-daemon and start clamd service
 *
 * CONFIGURATION:
 * - VIRUS_SCANNER_ENABLED=true
 * - CLAMAV_HOST=localhost (or container name in Docker)
 * - CLAMAV_PORT=3310 (default clamd port)
 */
export class ClamAVAssetScanner implements AssetScannerPort {
  private clamav?: NodeClam;
  private readonly config: ClamAVConfig;

  constructor(
    config: ClamAVConfig,
    private readonly logger?: LoggerPort
  ) {
    this.config = config;
  }

  /**
   * Initialize ClamAV connection (lazy, on first scan)
   */
  private async ensureInitialized(): Promise<NodeClam> {
    if (this.clamav) {
      return this.clamav;
    }

    try {
      this.logger?.debug('Initializing ClamAV scanner', {
        host: this.config.host,
        port: this.config.port,
      });

      this.clamav = await new NodeClam().init({
        clamdscan: {
          host: this.config.host,
          port: this.config.port,
          timeout: this.config.timeout,
          multiscan: false, // Single file scan
          active: true,
        },
        preference: 'clamdscan', // Use daemon, not binary
      });

      this.logger?.info('ClamAV scanner initialized successfully', {
        host: this.config.host,
        port: this.config.port,
      });

      return this.clamav;
    } catch (error) {
      this.logger?.error('Failed to initialize ClamAV scanner', {
        error,
        host: this.config.host,
        port: this.config.port,
      });
      throw new Error(
        `ClamAV initialization failed: ${error instanceof Error ? error.message : String(error)}`
      );
    }
  }

  async scan(buffer: Buffer | Uint8Array, filename: string): Promise<AssetScanResult> {
    const startTime = performance.now();

    try {
      const clam = await this.ensureInitialized();

      // Convert Uint8Array to Buffer if needed
      const bufferToScan = buffer instanceof Buffer ? buffer : Buffer.from(buffer);

      this.logger?.debug('Scanning asset with ClamAV', {
        filename,
        sizeBytes: bufferToScan.length,
      });

      // Create readable stream from buffer for ClamAV scanning
      const stream = Readable.from(bufferToScan);

      // Scan stream via ClamAV daemon
      const scanResult = await clam.scanStream(stream);

      const scanDurationMs = performance.now() - startTime;

      if (scanResult.isInfected) {
        const threat = scanResult.viruses?.join(', ') || 'unknown';
        this.logger?.error('VIRUS DETECTED in asset', {
          filename,
          threat,
          scanDurationMs,
        });

        throw new AssetScanError(`Virus detected: ${threat}`, filename, threat);
      }

      this.logger?.debug('Asset scan completed - CLEAN', {
        filename,
        scanDurationMs,
      });

      return {
        isClean: true,
        metadata: {
          scannerName: 'ClamAVAssetScanner',
          scanDurationMs,
        },
      };
    } catch (error) {
      // Re-throw AssetScanError (virus detected)
      if (error instanceof AssetScanError) {
        throw error;
      }

      // Log and re-throw other errors (connection issues, etc.)
      const scanDurationMs = performance.now() - startTime;
      this.logger?.error('ClamAV scan failed with error', {
        filename,
        error,
        scanDurationMs,
      });

      throw new Error(
        `ClamAV scan failed for ${filename}: ${error instanceof Error ? error.message : String(error)}`
      );
    }
  }
}
