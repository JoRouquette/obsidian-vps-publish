import { AssetScanError, type AssetScannerPort, type AssetScanResult } from '@core-domain';

import { FileTypeAssetValidator } from '../infra/validation/file-type-asset-validator';

/**
 * Mock asset scanner for testing virus detection workflow
 */
class MockInfectedScanner implements AssetScannerPort {
  constructor(private readonly infectPattern = 'VIRUS') {}

  async scan(buffer: Buffer | Uint8Array, filename: string): Promise<AssetScanResult> {
    const content = Buffer.from(buffer).toString('utf-8');

    // Simulate virus detection if content contains the pattern
    if (content.includes(this.infectPattern)) {
      throw new AssetScanError(
        `Mock virus detected: ${this.infectPattern}`,
        filename,
        this.infectPattern
      );
    }

    return {
      isClean: true,
      metadata: {
        scannerName: 'MockScanner',
        scanDurationMs: 1,
      },
    };
  }
}

class MockCleanScanner implements AssetScannerPort {
  async scan(_buffer: Buffer | Uint8Array, _filename: string): Promise<AssetScanResult> {
    return {
      isClean: true,
      metadata: {
        scannerName: 'MockCleanScanner',
        scanDurationMs: 1,
      },
    };
  }
}

describe('Asset Virus Scanning Integration', () => {
  describe('With mock infected scanner', () => {
    it('should reject asset containing virus pattern', async () => {
      const scanner = new MockInfectedScanner('EICAR');
      const validator = new FileTypeAssetValidator(scanner);

      // EICAR test virus string (standard test pattern)
      const infectedContent = Buffer.from('EICAR-STANDARD-ANTIVIRUS-TEST-FILE');

      await expect(
        validator.validate(infectedContent, 'infected.txt', 'text/plain', 10 * 1024 * 1024)
      ).rejects.toThrow(AssetScanError);

      await expect(
        validator.validate(infectedContent, 'infected.txt', 'text/plain', 10 * 1024 * 1024)
      ).rejects.toThrow(/Mock virus detected/);
    });

    it('should accept clean asset', async () => {
      const scanner = new MockInfectedScanner('EICAR');
      const validator = new FileTypeAssetValidator(scanner);

      const cleanContent = Buffer.from('Clean file content');

      const result = await validator.validate(
        cleanContent,
        'clean.txt',
        'text/plain',
        10 * 1024 * 1024
      );

      expect(result.valid).toBe(true);
      expect(result.detectedMimeType).toBe('text/plain');
    });
  });

  describe('With mock clean scanner', () => {
    it('should accept all assets', async () => {
      const scanner = new MockCleanScanner();
      const validator = new FileTypeAssetValidator(scanner);

      const content = Buffer.from('Any content');

      const result = await validator.validate(content, 'file.txt', 'text/plain', 10 * 1024 * 1024);

      expect(result.valid).toBe(true);
    });
  });

  describe('Without scanner (undefined)', () => {
    it('should skip virus scan and validate successfully', async () => {
      const validator = new FileTypeAssetValidator(undefined); // No scanner

      const content = Buffer.from('Content that would be flagged in other tests');

      const result = await validator.validate(content, 'file.txt', 'text/plain', 10 * 1024 * 1024);

      expect(result.valid).toBe(true);
      expect(result.detectedMimeType).toBe('text/plain');
    });
  });

  describe('Virus scan integration with MIME detection', () => {
    it('should detect MIME first, then scan for virus', async () => {
      const scanner = new MockInfectedScanner('MALWARE');
      const validator = new FileTypeAssetValidator(scanner);

      // PNG signature + text content with "MALWARE"
      const pngSignature = Buffer.from([
        0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0x00, 0x00, 0x00, 0x0d, 0x49, 0x48, 0x44,
        0x52,
      ]);
      const textContent = Buffer.from('MALWARE');
      const infectedImage = Buffer.concat([pngSignature, textContent, Buffer.alloc(200)]);

      await expect(
        validator.validate(infectedImage, 'image.png', 'image/png', 10 * 1024 * 1024)
      ).rejects.toThrow(AssetScanError);
    });

    it('should reject oversized file before virus scan', async () => {
      const scanner = new MockInfectedScanner();
      const validator = new FileTypeAssetValidator(scanner);

      const largeBuffer = Buffer.alloc(15 * 1024 * 1024); // 15MB
      const maxSize = 10 * 1024 * 1024; // 10MB limit

      // Should fail on size, not virus scan
      await expect(
        validator.validate(largeBuffer, 'huge.bin', 'application/octet-stream', maxSize)
      ).rejects.toThrow(/exceeds maximum allowed/);
    });
  });
});
