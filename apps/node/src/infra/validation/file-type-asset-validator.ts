import {
  AssetScanError,
  type AssetScannerPort,
  AssetValidationError,
  type AssetValidationResult,
  type AssetValidatorPort,
  type LoggerPort,
} from '@core-domain';
import fileType from 'file-type';

/**
 * MIME types accepted for published assets. The detected (or extension-guessed)
 * type must belong to this set; anything else — including the
 * `application/octet-stream` fallback for undetectable/unknown content — is
 * rejected so arbitrary executable or active content cannot be stored and
 * served.
 */
const ALLOWED_MIME_TYPES: ReadonlySet<string> = new Set([
  'image/png',
  'image/jpeg',
  'image/gif',
  'image/webp',
  'image/svg+xml',
  'application/pdf',
  'audio/mpeg',
  'audio/wav',
  'audio/x-wav',
  'audio/wave',
  'audio/ogg',
  'video/ogg',
  'application/ogg',
  'video/mp4',
  'video/webm',
  'text/plain',
  'text/markdown',
  'application/json',
]);

/**
 * Asset validator that detects real MIME types from file bytes using file-type library.
 * Prevents MIME spoofing attacks by not trusting client-provided MIME types.
 * Optionally scans for viruses using an injected AssetScannerPort.
 */
export class FileTypeAssetValidator implements AssetValidatorPort {
  constructor(
    private readonly assetScanner?: AssetScannerPort,
    private readonly logger?: LoggerPort
  ) {}

  async validate(
    buffer: Buffer | Uint8Array,
    filename: string,
    clientMimeType?: string,
    maxSizeBytes?: number
  ): Promise<AssetValidationResult> {
    const sizeBytes = buffer.length;

    // Check 1: Size validation
    if (maxSizeBytes !== undefined && sizeBytes > maxSizeBytes) {
      const errorMsg = `Asset size ${sizeBytes} bytes exceeds maximum allowed ${maxSizeBytes} bytes`;
      this.logger?.warn('Asset size limit exceeded', {
        filename,
        sizeBytes,
        maxSizeBytes,
      });
      throw new AssetValidationError(errorMsg, filename, 'SIZE_EXCEEDED');
    }

    // Check 2: Detect MIME type from actual bytes
    let detectedMimeType: string;
    try {
      const fileTypeResult = await fileType.fromBuffer(buffer);

      if (fileTypeResult) {
        detectedMimeType = fileTypeResult.mime;
        this.logger?.debug('MIME type detected from bytes', {
          filename,
          detectedMimeType,
          clientMimeType,
        });
      } else {
        // Fallback: guess from extension if file-type can't detect
        detectedMimeType = this.guessMimeTypeFromExtension(filename);
        this.logger?.debug('MIME type guessed from extension (file-type returned null)', {
          filename,
          detectedMimeType,
        });
      }
    } catch (error) {
      // If file-type fails, fallback to extension-based guessing
      detectedMimeType = this.guessMimeTypeFromExtension(filename);
      this.logger?.warn('file-type detection failed, falling back to extension', {
        filename,
        error,
        detectedMimeType,
      });
    }

    // Check 3: MIME mismatch is informational; the detected type is trusted over
    // the client-provided one.
    if (clientMimeType && detectedMimeType !== clientMimeType) {
      this.logger?.warn('MIME type mismatch detected (potential spoofing)', {
        filename,
        clientMimeType,
        detectedMimeType,
        action: 'accepted_with_detected_mime',
      });
    }

    // Check 3b: Enforce the MIME allowlist. Reject anything outside the set of
    // supported asset types (and the octet-stream fallback for unknown content).
    if (!ALLOWED_MIME_TYPES.has(detectedMimeType)) {
      this.logger?.warn('Asset MIME type not allowed', {
        filename,
        detectedMimeType,
        clientMimeType,
      });
      throw new AssetValidationError(
        `Asset MIME type not allowed: ${detectedMimeType}`,
        filename,
        'INVALID_CONTENT'
      );
    }

    // Check 4: Virus scan (if scanner is configured)
    if (this.assetScanner) {
      try {
        const scanResult = await this.assetScanner.scan(buffer, filename);

        if (!scanResult.isClean) {
          const errorMsg = `Asset failed virus scan: ${scanResult.threat || 'unknown threat'}`;
          this.logger?.error('Asset failed virus scan', {
            filename,
            threat: scanResult.threat,
          });
          throw new AssetValidationError(errorMsg, filename, 'INVALID_CONTENT');
        }

        this.logger?.debug('Asset passed virus scan', {
          filename,
          scanDurationMs: scanResult.metadata?.scanDurationMs,
        });
      } catch (error) {
        // Re-throw AssetScanError (virus detected by scanner)
        if (error instanceof AssetScanError) {
          throw error;
        }

        // Re-throw AssetValidationError (scan failed with validation error)
        if (error instanceof AssetValidationError) {
          throw error;
        }

        // Fail closed: if a scanner is configured but cannot complete the scan,
        // reject the asset rather than storing unscanned content.
        this.logger?.error('Virus scan failed to complete; rejecting asset (fail-closed)', {
          filename,
          error,
        });
        throw new AssetValidationError(
          'Asset could not be scanned for threats',
          filename,
          'INVALID_CONTENT'
        );
      }
    }

    return {
      valid: true,
      detectedMimeType,
      sizeBytes,
    };
  }

  private guessMimeTypeFromExtension(filename: string): string {
    const ext = filename.split('.').pop()?.toLowerCase();
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
      case 'txt':
        return 'text/plain';
      case 'md':
        return 'text/markdown';
      case 'json':
        return 'application/json';
      default:
        return 'application/octet-stream';
    }
  }
}
