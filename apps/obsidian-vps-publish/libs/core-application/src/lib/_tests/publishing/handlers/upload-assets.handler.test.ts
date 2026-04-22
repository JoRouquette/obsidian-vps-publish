import {
  type AssetHashPort,
  type AssetValidatorPort,
  type ImageOptimizerPort,
  type LoggerPort,
  type ManifestAsset,
} from '@core-domain';

import { type UploadAssetsCommand } from '../../../publishing/commands/upload-assets.command';
import { UploadAssetsHandler } from '../../../publishing/handlers/upload-assets.handler';
import { type AssetStoragePort } from '../../../publishing/ports/assets-storage.port';
import { type ManifestPort } from '../../../publishing/ports/manifest-storage.port';

describe('UploadAssetsHandler', () => {
  let assetStorage: { upload: jest.Mock<any, any> } & jest.Mocked<AssetStoragePort>;
  let logger: jest.Mocked<LoggerPort>;
  let handler: UploadAssetsHandler;

  beforeEach(() => {
    assetStorage = {
      upload: jest.fn(),
    } as { upload: jest.Mock<any, any> } & jest.Mocked<AssetStoragePort>;

    logger = {
      child: jest.fn().mockReturnThis(),
      debug: jest.fn(),
    } as any;

    handler = new UploadAssetsHandler(
      assetStorage,
      undefined,
      undefined,
      undefined,
      undefined,
      undefined, // imageOptimizer
      logger
    );
  });

  it('should initialize logger with correct child context', () => {
    expect(logger.child).toHaveBeenCalledWith({ handler: 'UploadAssetHandler' });
    expect(logger.debug).toHaveBeenCalledWith('UploadAssetHandler initialized.', {
      hasValidator: false,
      hasManifest: false,
      hasHasher: false,
      hasImageOptimizer: false,
      maxAssetSizeBytes: undefined,
    });
  });

  it('should return sessionId and published=0 on handle', async () => {
    const command: UploadAssetsCommand = {
      sessionId: 'session-123',
    } as any;

    const result = await handler.handle(command);

    expect(result).toEqual({
      sessionId: 'session-123',
      published: 0,
    });
  });

  it('should not throw if logger is not provided', async () => {
    const handlerNoLogger = new UploadAssetsHandler(assetStorage);
    const command: UploadAssetsCommand = { sessionId: 'abc' } as any;
    await expect(handlerNoLogger.handle(command)).resolves.toEqual({
      sessionId: 'abc',
      published: 0,
    });
  });

  it('should assign assetStorage as a dependency', () => {
    expect((handler as any).assetStorage).toBe(assetStorage);
  });

  it('should not call assetStorage.upload in current implementation', async () => {
    const command: UploadAssetsCommand = { sessionId: 'no-upload' } as any;
    await handler.handle(command);
    expect(assetStorage.upload).not.toHaveBeenCalled();
  });

  it('should allow logger to be undefined and not throw during construction', () => {
    expect(() => new UploadAssetsHandler(assetStorage)).not.toThrow();
  });

  it('should allow logger to be null and not throw during construction', () => {
    expect(() => new UploadAssetsHandler(assetStorage, null as any)).not.toThrow();
  });

  it('should handle multiple handle calls without side effects', async () => {
    const command1: UploadAssetsCommand = { sessionId: 's1' } as any;
    const command2: UploadAssetsCommand = { sessionId: 's2' } as any;
    const result1 = await handler.handle(command1);
    const result2 = await handler.handle(command2);
    expect(result1).toEqual({ sessionId: 's1', published: 0 });
    expect(result2).toEqual({ sessionId: 's2', published: 0 });
  });

  it('should work if logger.child returns a different object with debug', () => {
    const customLogger = {
      child: jest.fn(() => ({
        debug: jest.fn(),
      })),
      debug: jest.fn(),
    } as any;
    expect(() => new UploadAssetsHandler(assetStorage, customLogger)).not.toThrow();
  });
});

// ---------------------------------------------------------------------------
// Dedup-skipped assets must propagate renamedAssets when the published
// path on disk differs from the source filename sent by the plugin.
// ---------------------------------------------------------------------------

describe('UploadAssetsHandler – dedup-skipped asset path mapping', () => {
  function makeLogger(): jest.Mocked<LoggerPort> {
    const l: any = {
      child: jest.fn().mockReturnThis(),
      debug: jest.fn(),
      info: jest.fn(),
      warn: jest.fn(),
      error: jest.fn(),
    };
    return l;
  }

  function makeStorage(): jest.Mocked<AssetStoragePort> {
    return { save: jest.fn().mockResolvedValue(undefined) } as any;
  }

  function makeHasher(hash: string): jest.Mocked<AssetHashPort> {
    return { computeHash: jest.fn().mockResolvedValue(hash) };
  }

  function makeManifest(assets: ManifestAsset[]): jest.Mocked<ManifestPort> {
    return {
      load: jest.fn().mockResolvedValue({
        sessionId: 'prev',
        createdAt: new Date(),
        lastUpdatedAt: new Date(),
        pages: [],
        assets,
      }),
      save: jest.fn().mockResolvedValue(undefined),
    } as any;
  }

  it('should produce renamedAssets when dedup-skipped asset has a different published path', async () => {
    // Scenario: previous publication optimised Ektaron.png → Ektaron.webp.
    // New publication sends the same content (same hash after optimisation).
    // The handler should map "Ektaron.png" → "Ektaron.webp" for path rewriting.
    const existingAsset: ManifestAsset = {
      path: 'Ektaron.webp',
      hash: 'abc123',
      size: 1000,
      mimeType: 'image/webp',
      uploadedAt: new Date(),
    };

    const handler = new UploadAssetsHandler(
      makeStorage(),
      makeManifest([existingAsset]),
      makeHasher('abc123'), // same hash → dedup will fire
      undefined, // no validator
      undefined, // no size limit
      undefined, // no optimizer (already deduped before optimizer would run — or optimizer produces same hash)
      makeLogger()
    );

    const result = await handler.handle({
      sessionId: 's1',
      assets: [
        {
          relativePath: 'Ektaron.png',
          vaultPath: '_assets/Ektaron.png',
          fileName: 'Ektaron.png',
          mimeType: 'image/png',
          contentBase64: Buffer.from('fake-png-content').toString('base64'),
        },
      ],
    });

    expect(result.renamedAssets).toEqual({ 'Ektaron.png': 'Ektaron.webp' });
    expect(result.published).toBe(0);
    expect(result.skipped).toBe(1);
  });

  it('should NOT produce renamedAssets when dedup-skipped asset has the same path', async () => {
    const existingAsset: ManifestAsset = {
      path: 'icon.svg',
      hash: 'def456',
      size: 500,
      mimeType: 'image/svg+xml',
      uploadedAt: new Date(),
    };

    const handler = new UploadAssetsHandler(
      makeStorage(),
      makeManifest([existingAsset]),
      makeHasher('def456'),
      undefined,
      undefined,
      undefined,
      makeLogger()
    );

    const result = await handler.handle({
      sessionId: 's2',
      assets: [
        {
          relativePath: 'icon.svg',
          vaultPath: '_assets/icon.svg',
          fileName: 'icon.svg',
          mimeType: 'image/svg+xml',
          contentBase64: Buffer.from('fake-svg').toString('base64'),
        },
      ],
    });

    expect(result.renamedAssets).toBeUndefined();
    expect(result.skipped).toBe(1);
  });

  it('should produce renamedAssets for dedup-skipped assets with subfolder path differences', async () => {
    const existingAsset: ManifestAsset = {
      path: 'maps/world.webp',
      hash: 'hash789',
      size: 2000,
      mimeType: 'image/webp',
      uploadedAt: new Date(),
    };

    const handler = new UploadAssetsHandler(
      makeStorage(),
      makeManifest([existingAsset]),
      makeHasher('hash789'),
      undefined,
      undefined,
      undefined,
      makeLogger()
    );

    const result = await handler.handle({
      sessionId: 's3',
      assets: [
        {
          relativePath: 'maps/world.png',
          vaultPath: '_assets/maps/world.png',
          fileName: 'world.png',
          mimeType: 'image/png',
          contentBase64: Buffer.from('fake-map').toString('base64'),
        },
      ],
    });

    expect(result.renamedAssets).toEqual({ 'maps/world.png': 'maps/world.webp' });
  });

  it('should prefer existing published path over current optimizer output', async () => {
    // Previous publication converted Banner.png → Banner.webp.
    // Current session's optimizer is now configured for AVIF,
    // but the content hash still matches the existing .webp asset.
    // The handler MUST use the on-disk path (.webp), NOT the optimizer output (.avif).
    const existingAsset: ManifestAsset = {
      path: 'Banner.webp',
      hash: 'same-hash',
      size: 900,
      mimeType: 'image/webp',
      uploadedAt: new Date(),
    };

    const mockOptimizer: ImageOptimizerPort = {
      isOptimizable: jest.fn().mockReturnValue(true),
      optimize: jest.fn().mockResolvedValue({
        data: new Uint8Array(Buffer.from('avif-bytes')),
        format: 'avif',
        originalFilename: 'Banner.png',
        optimizedFilename: 'Banner.avif',
        originalSize: 2000,
        optimizedSize: 800,
        width: 100,
        height: 100,
        wasOptimized: true,
      }),
      getConfig: jest.fn(),
    };

    const handler = new UploadAssetsHandler(
      makeStorage(),
      makeManifest([existingAsset]),
      makeHasher('same-hash'),
      undefined,
      undefined,
      mockOptimizer,
      makeLogger()
    );

    const result = await handler.handle({
      sessionId: 's-opt',
      assets: [
        {
          relativePath: 'Banner.png',
          vaultPath: '_assets/Banner.png',
          fileName: 'Banner.png',
          mimeType: 'image/png',
          contentBase64: Buffer.from('raw-banner').toString('base64'),
        },
      ],
    });

    expect(result.renamedAssets).toEqual({ 'Banner.png': 'Banner.webp' });
    expect(result.published).toBe(0);
    expect(result.skipped).toBe(1);
  });

  it('should return no renamedAssets when no assets are provided', async () => {
    const handler = new UploadAssetsHandler(
      makeStorage(),
      undefined,
      undefined,
      undefined,
      undefined,
      undefined,
      makeLogger()
    );

    const result = await handler.handle({ sessionId: 's-empty', assets: [] });

    expect(result.renamedAssets).toBeUndefined();
    expect(result.published).toBe(0);
    expect(result.skipped).toBeUndefined();
  });
});

describe('UploadAssetsHandler - optimized image size validation', () => {
  function makeLogger(): jest.Mocked<LoggerPort> {
    const l: any = {
      child: jest.fn().mockReturnThis(),
      debug: jest.fn(),
      info: jest.fn(),
      warn: jest.fn(),
      error: jest.fn(),
    };
    return l;
  }

  function makeStorage(): jest.Mocked<AssetStoragePort> {
    return { save: jest.fn().mockResolvedValue(undefined) } as any;
  }

  it('should validate optimizable images against the final optimized size', async () => {
    const storage = makeStorage();
    const validator: jest.Mocked<AssetValidatorPort> = {
      validate: jest
        .fn()
        .mockImplementationOnce(async (buffer, filename, clientMimeType, maxSizeBytes) => {
          expect(filename).toBe('Ektaron.png');
          expect(clientMimeType).toBe('image/png');
          expect(maxSizeBytes).toBeUndefined();
          return {
            valid: true,
            detectedMimeType: 'image/png',
            sizeBytes: buffer.length,
          };
        })
        .mockImplementationOnce(async (buffer, filename, clientMimeType, maxSizeBytes) => {
          expect(filename).toBe('Ektaron.webp');
          expect(clientMimeType).toBe('image/webp');
          expect(maxSizeBytes).toBe(10);
          return {
            valid: true,
            detectedMimeType: 'image/webp',
            sizeBytes: buffer.length,
          };
        }),
    };
    const optimizer: jest.Mocked<ImageOptimizerPort> = {
      isOptimizable: jest.fn().mockReturnValue(true),
      optimize: jest.fn().mockResolvedValue({
        data: new Uint8Array(Buffer.alloc(5)),
        format: 'webp',
        originalFilename: 'Ektaron.png',
        optimizedFilename: 'Ektaron.webp',
        originalSize: 20,
        optimizedSize: 5,
        width: 100,
        height: 100,
        wasOptimized: true,
      }),
      getConfig: jest.fn(),
    };

    const handler = new UploadAssetsHandler(
      storage,
      undefined,
      undefined,
      validator,
      10,
      optimizer,
      makeLogger()
    );

    const result = await handler.handle({
      sessionId: 's-image-ok',
      assets: [
        {
          relativePath: 'Ektaron.png',
          vaultPath: '_assets/Ektaron.png',
          fileName: 'Ektaron.png',
          mimeType: 'image/png',
          contentBase64: Buffer.alloc(20).toString('base64'),
        },
      ],
    });

    expect(result.published).toBe(1);
    expect(result.errors).toBeUndefined();
    expect(result.renamedAssets).toEqual({ 'Ektaron.png': 'Ektaron.webp' });
    expect(storage.save).toHaveBeenCalledWith([
      { filename: 'Ektaron.webp', content: Buffer.alloc(5) },
    ]);
    expect(validator.validate).toHaveBeenCalledTimes(2);
  });

  it('should reject optimizable images when the optimized output still exceeds the size limit', async () => {
    const storage = makeStorage();
    const validator: jest.Mocked<AssetValidatorPort> = {
      validate: jest
        .fn()
        .mockImplementationOnce(async (buffer) => ({
          valid: true,
          detectedMimeType: 'image/png',
          sizeBytes: buffer.length,
        }))
        .mockImplementationOnce(async () => {
          throw new Error('Asset size 15 bytes exceeds maximum allowed 10 bytes');
        }),
    };
    const optimizer: jest.Mocked<ImageOptimizerPort> = {
      isOptimizable: jest.fn().mockReturnValue(true),
      optimize: jest.fn().mockResolvedValue({
        data: new Uint8Array(Buffer.alloc(15)),
        format: 'webp',
        originalFilename: 'Ektaron.png',
        optimizedFilename: 'Ektaron.webp',
        originalSize: 20,
        optimizedSize: 15,
        width: 100,
        height: 100,
        wasOptimized: true,
      }),
      getConfig: jest.fn(),
    };

    const handler = new UploadAssetsHandler(
      storage,
      undefined,
      undefined,
      validator,
      10,
      optimizer,
      makeLogger()
    );

    const result = await handler.handle({
      sessionId: 's-image-too-large',
      assets: [
        {
          relativePath: 'Ektaron.png',
          vaultPath: '_assets/Ektaron.png',
          fileName: 'Ektaron.png',
          mimeType: 'image/png',
          contentBase64: Buffer.alloc(20).toString('base64'),
        },
      ],
    });

    expect(result.published).toBe(0);
    expect(result.errors).toEqual([
      {
        assetName: 'Ektaron.png',
        message: 'Asset size 15 bytes exceeds maximum allowed 10 bytes',
      },
    ]);
    expect(storage.save).not.toHaveBeenCalled();
    expect(validator.validate).toHaveBeenCalledTimes(2);
  });
});
