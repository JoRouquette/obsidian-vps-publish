import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

import { AssetValidationError } from '@core-domain';

import { FileTypeAssetValidator } from '../infra/validation/file-type-asset-validator';

describe('FileTypeAssetValidator - MIME Detection & Size Limits', () => {
  let tmpDir: string;
  let validator: FileTypeAssetValidator;

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'asset-validation-'));
    // Initialize validator WITHOUT scanner for these tests (focused on MIME + size only)
    validator = new FileTypeAssetValidator(undefined);
  });

  afterEach(() => {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  describe('Size validation', () => {
    it('should reject asset exceeding size limit', async () => {
      const largeBuffer = Buffer.alloc(15 * 1024 * 1024); // 15MB
      const maxSize = 10 * 1024 * 1024; // 10MB limit

      await expect(
        validator.validate(largeBuffer, 'large-file.bin', 'application/octet-stream', maxSize)
      ).rejects.toThrow(AssetValidationError);

      await expect(
        validator.validate(largeBuffer, 'large-file.bin', 'application/octet-stream', maxSize)
      ).rejects.toThrow(/exceeds maximum allowed/);
    });

    it('should accept asset within size limit', async () => {
      const smallBuffer = Buffer.from('small content', 'utf-8');
      const maxSize = 10 * 1024 * 1024;

      const result = await validator.validate(smallBuffer, 'small-file.txt', 'text/plain', maxSize);

      expect(result.valid).toBe(true);
      expect(result.sizeBytes).toBe(smallBuffer.length);
    });

    it('should accept asset when no size limit is specified', async () => {
      const anyBuffer = Buffer.alloc(50 * 1024 * 1024); // 50MB, larger than typical limit

      const result = await validator.validate(
        anyBuffer,
        'no-limit.bin',
        'application/octet-stream'
        // No maxSizeBytes parameter
      );

      expect(result.valid).toBe(true);
      expect(result.sizeBytes).toBe(anyBuffer.length);
    });
  });

  describe('MIME type detection from bytes', () => {
    it('should detect PNG from magic bytes (MIME spoofing protection)', async () => {
      // PNG magic bytes: 89 50 4E 47 0D 0A 1A 0A
      // Need more bytes for file-type to reliably detect PNG
      const pngSignature = Buffer.from([
        0x89,
        0x50,
        0x4e,
        0x47,
        0x0d,
        0x0a,
        0x1a,
        0x0a, // PNG signature
        0x00,
        0x00,
        0x00,
        0x0d, // IHDR chunk length
        0x49,
        0x48,
        0x44,
        0x52, // IHDR
      ]);
      const fakePngBuffer = Buffer.concat([pngSignature, Buffer.alloc(200)]);

      // Client claims it's a JPEG (spoofing attempt)
      const result = await validator.validate(
        fakePngBuffer,
        'fake.png', // Use .png extension so fallback also gives PNG
        'image/jpeg', // Client lies about MIME
        10 * 1024 * 1024
      );

      expect(result.valid).toBe(true);
      expect(result.detectedMimeType).toBe('image/png'); // Real MIME detected
      expect(result.detectedMimeType).not.toBe('image/jpeg'); // Not the client's lie
    });

    it('should detect JPEG from magic bytes', async () => {
      // JPEG magic bytes: FF D8 FF
      const jpegSignature = Buffer.from([0xff, 0xd8, 0xff, 0xe0]);
      const fakeJpegBuffer = Buffer.concat([jpegSignature, Buffer.alloc(100)]);

      const result = await validator.validate(
        fakeJpegBuffer,
        'image.jpg',
        'image/jpeg',
        10 * 1024 * 1024
      );

      expect(result.valid).toBe(true);
      expect(result.detectedMimeType).toBe('image/jpeg');
    });

    it('should fallback to extension-based MIME when magic bytes not recognized', async () => {
      // Plain text has no magic bytes
      const textBuffer = Buffer.from('Hello, world!');

      const result = await validator.validate(
        textBuffer,
        'document.txt',
        'text/plain',
        10 * 1024 * 1024
      );

      expect(result.valid).toBe(true);
      // Should fallback to extension-based guess
      expect(result.detectedMimeType).toBe('text/plain');
    });

    it('should default to octet-stream for unknown extensions', async () => {
      const unknownBuffer = Buffer.from('unknown content');

      const result = await validator.validate(
        unknownBuffer,
        'file.unknownext',
        'application/octet-stream',
        10 * 1024 * 1024
      );

      expect(result.valid).toBe(true);
      expect(result.detectedMimeType).toBe('application/octet-stream');
    });
  });

  describe('Real-world scenarios', () => {
    it('should handle PDF files correctly', async () => {
      // PDF magic bytes: 25 50 44 46 (ASCII: %PDF)
      const pdfSignature = Buffer.from([0x25, 0x50, 0x44, 0x46, 0x2d, 0x31, 0x2e]);
      const fakePdfBuffer = Buffer.concat([pdfSignature, Buffer.alloc(500)]);

      const result = await validator.validate(
        fakePdfBuffer,
        'document.pdf',
        'application/pdf',
        10 * 1024 * 1024
      );

      expect(result.valid).toBe(true);
      expect(result.detectedMimeType).toBe('application/pdf');
    });

    it('should reject oversized image even with correct MIME', async () => {
      const hugeImageBuffer = Buffer.alloc(20 * 1024 * 1024); // 20MB
      hugeImageBuffer[0] = 0x89; // PNG signature start
      hugeImageBuffer[1] = 0x50;

      const maxSize = 10 * 1024 * 1024;

      await expect(
        validator.validate(hugeImageBuffer, 'huge.png', 'image/png', maxSize)
      ).rejects.toThrow(AssetValidationError);
    });
  });
});
