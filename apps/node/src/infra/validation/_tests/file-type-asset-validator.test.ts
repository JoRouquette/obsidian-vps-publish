import { AssetScanError, type AssetScannerPort, AssetValidationError } from '@core-domain';

import { FileTypeAssetValidator } from '../file-type-asset-validator';

describe('FileTypeAssetValidator', () => {
  describe('MIME allowlist', () => {
    it('accepts a supported type resolved from the extension', async () => {
      const validator = new FileTypeAssetValidator();

      const result = await validator.validate(Buffer.from('<svg></svg>'), 'icon.svg');

      expect(result.valid).toBe(true);
      expect(result.detectedMimeType).toBe('image/svg+xml');
    });

    it('accepts plain text and json assets', async () => {
      const validator = new FileTypeAssetValidator();

      await expect(validator.validate(Buffer.from('hello'), 'note.txt')).resolves.toMatchObject({
        detectedMimeType: 'text/plain',
      });
      await expect(validator.validate(Buffer.from('{}'), 'data.json')).resolves.toMatchObject({
        detectedMimeType: 'application/json',
      });
    });

    it('rejects unknown content that falls back to octet-stream', async () => {
      const validator = new FileTypeAssetValidator();

      await expect(
        validator.validate(Buffer.from('MZ binary'), 'payload.exe')
      ).rejects.toBeInstanceOf(AssetValidationError);
    });

    it('still enforces the size limit', async () => {
      const validator = new FileTypeAssetValidator();

      await expect(
        validator.validate(Buffer.from('hello world'), 'note.txt', 'text/plain', 4)
      ).rejects.toMatchObject({ reason: 'SIZE_EXCEEDED' });
    });
  });

  describe('virus scanning', () => {
    const cleanBuffer = Buffer.from('hello');

    it('passes when the scanner reports the asset is clean', async () => {
      const scanner: AssetScannerPort = {
        scan: jest.fn().mockResolvedValue({ isClean: true }),
      };
      const validator = new FileTypeAssetValidator(scanner);

      await expect(validator.validate(cleanBuffer, 'note.txt')).resolves.toMatchObject({
        valid: true,
      });
    });

    it('rejects when the scanner reports a threat', async () => {
      const scanner: AssetScannerPort = {
        scan: jest.fn().mockResolvedValue({ isClean: false, threat: 'Eicar-Test' }),
      };
      const validator = new FileTypeAssetValidator(scanner);

      await expect(validator.validate(cleanBuffer, 'note.txt')).rejects.toBeInstanceOf(
        AssetValidationError
      );
    });

    it('fails closed when the scanner throws an unexpected error', async () => {
      const scanner: AssetScannerPort = {
        scan: jest.fn().mockRejectedValue(new Error('clamd unreachable')),
      };
      const validator = new FileTypeAssetValidator(scanner);

      await expect(validator.validate(cleanBuffer, 'note.txt')).rejects.toBeInstanceOf(
        AssetValidationError
      );
    });

    it('propagates AssetScanError raised by the scanner', async () => {
      const scanner: AssetScannerPort = {
        scan: jest.fn().mockRejectedValue(new AssetScanError('threat', 'note.txt', 'Trojan')),
      };
      const validator = new FileTypeAssetValidator(scanner);

      await expect(validator.validate(cleanBuffer, 'note.txt')).rejects.toBeInstanceOf(
        AssetScanError
      );
    });
  });
});
