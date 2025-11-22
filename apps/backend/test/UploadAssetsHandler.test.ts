import { describe, it, expect, vi, beforeEach } from 'vitest';
import { AssetStoragePort } from '../src/application/publishing/ports/AssetsStoragePort';
import { LoggerPort } from '../src/application/ports/LoggerPort';
import { UploadAssetsHandler } from '../src/application/publishing/handlers/UploadAssetsHandler';

describe('UploadAssetsHandler', () => {
  let assetStorage: AssetStoragePort;
  let logger: LoggerPort;
  let loggerChild: LoggerPort;
  let handler: UploadAssetsHandler;

  beforeEach(() => {
    assetStorage = {} as AssetStoragePort;
    loggerChild = {
      debug: vi.fn(),
      child: vi.fn().mockReturnThis(),
    } as unknown as LoggerPort;
    logger = {
      debug: vi.fn(),
      child: vi.fn().mockReturnValue(loggerChild),
    } as unknown as LoggerPort;
  });

  it('should initialize with logger and log debug message', () => {
    handler = new UploadAssetsHandler(assetStorage, logger);
    expect(logger.child).toHaveBeenCalledWith({ handler: 'UploadAssetHandler' });
    expect(loggerChild.debug).toHaveBeenCalledWith('UploadAssetHandler initialized.');
  });

  it('should initialize without logger', () => {
    handler = new UploadAssetsHandler(assetStorage);
    // No error should be thrown
    expect(handler).toBeInstanceOf(UploadAssetsHandler);
  });

  it('execute should resolve to void', async () => {
    handler = new UploadAssetsHandler(assetStorage, logger);
    await expect(handler.handle()).resolves.toBeUndefined();
  });
});
