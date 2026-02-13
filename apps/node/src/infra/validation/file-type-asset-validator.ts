import {
  AssetValidationError,
  type AssetValidationResult,
  type AssetValidatorPort,
  type LoggerPort,
} from '@core-domain';
import { fileTypeFromBuffer } from 'file-type';

/**
 * Asset validator that detects real MIME types from file bytes using file-type library.
 * Prevents MIME spoofing attacks by not trusting client-provided MIME types.
 */
export class FileTypeAssetValidator implements AssetValidatorPort {
  constructor(private readonly logger?: LoggerPort) {}

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
      const fileTypeResult = await fileTypeFromBuffer(buffer);

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

    // Check 3: MIME mismatch warning (optional - we can choose to reject or just log)
    // For now, we LOG but ACCEPT with the detected MIME (not client-provided)
    if (clientMimeType && detectedMimeType !== clientMimeType) {
      this.logger?.warn('MIME type mismatch detected (potential spoofing)', {
        filename,
        clientMimeType,
        detectedMimeType,
        action: 'accepted_with_detected_mime',
      });
      // If we wanted strict mode, we would throw here:
      // throw new AssetValidationError(`MIME mismatch: client=${clientMimeType}, detected=${detectedMimeType}`, filename, 'MIME_MISMATCH');
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
