import {
  AssetScanError,
  type AssetScannerPort,
  AssetValidationError,
  type AssetValidationResult,
  type AssetValidatorPort,
  type LoggerPort,
} from '@core-domain';
import fileType from 'file-type';

import { findUnsafeContent, hasSvgRootElement } from './asset-content-inspector';
import {
  extensionOf,
  guessMimeTypeFromExtension,
  isAllowedMimeType,
  isExtensionAllowedForMimeType,
} from './asset-mime-policy';

const SVG_MIME_TYPE = 'image/svg+xml';
const XML_MIME_TYPES: readonly string[] = ['application/xml', 'text/xml'];

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
    const detectedMimeType = await this.detectMimeType(buffer, filename, clientMimeType);

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
    if (!isAllowedMimeType(detectedMimeType)) {
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

    // Check 3c: The stored name decides how the file is served, so its extension must
    // belong to the detected type (a PNG header in `x.html` would be served as HTML).
    if (!isExtensionAllowedForMimeType(filename, detectedMimeType)) {
      this.logger?.warn('Asset extension does not match detected MIME type', {
        filename,
        detectedMimeType,
      });
      throw new AssetValidationError(
        `Asset extension does not match its content type: ${detectedMimeType}`,
        filename,
        'INVALID_CONTENT'
      );
    }

    // Check 3d: Text-based types are mostly not recognised from their bytes, and the type
    // may come from the extension or from file-type; either way the content is inspected
    // (the inspector ignores binary types).
    const problem = findUnsafeContent(detectedMimeType, buffer);
    if (problem) {
      this.logger?.warn('Asset content refused', { filename, detectedMimeType, problem });
      throw new AssetValidationError(
        `Asset content refused: ${problem}`,
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

  /**
   * Type read from the bytes. When file-type finds nothing (or fails), the type implied by
   * the extension is used.
   */
  private async detectMimeType(
    buffer: Buffer | Uint8Array,
    filename: string,
    clientMimeType?: string
  ): Promise<string> {
    try {
      const fileTypeResult = await fileType.fromBuffer(buffer);

      if (fileTypeResult) {
        this.logger?.debug('MIME type detected from bytes', {
          filename,
          detectedMimeType: fileTypeResult.mime,
          clientMimeType,
        });
        return this.reclassifySvgWithXmlProlog(fileTypeResult.mime, buffer, filename);
      }

      const mimeType = guessMimeTypeFromExtension(filename);
      this.logger?.debug('MIME type guessed from extension (file-type returned null)', {
        filename,
        detectedMimeType: mimeType,
      });
      return mimeType;
    } catch (error) {
      const mimeType = guessMimeTypeFromExtension(filename);
      this.logger?.warn('file-type detection failed, falling back to extension', {
        filename,
        error,
        detectedMimeType: mimeType,
      });
      return mimeType;
    }
  }

  /**
   * file-type reports a document starting with `<?xml` (Inkscape, Illustrator) as
   * `application/xml`, which would refuse a legitimate SVG. That type is read as SVG only
   * when the final extension is `.svg` and an `<svg>` root is present; the SVG content
   * checks then apply as for any SVG. The same bytes under another name stay refused.
   */
  private reclassifySvgWithXmlProlog(
    detectedMimeType: string,
    buffer: Buffer | Uint8Array,
    filename: string
  ): string {
    const isXml = XML_MIME_TYPES.includes(detectedMimeType);
    if (isXml && extensionOf(filename) === 'svg' && hasSvgRootElement(buffer)) {
      return SVG_MIME_TYPE;
    }
    return detectedMimeType;
  }
}
