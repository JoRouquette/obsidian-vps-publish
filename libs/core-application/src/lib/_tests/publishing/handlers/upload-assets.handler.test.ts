import { type LoggerPort } from '@core-domain';

import { type UploadAssetsCommand } from '../../../publishing/commands/upload-assets.command';
import { UploadAssetsHandler } from '../../../publishing/handlers/upload-assets.handler';
import { type AssetStoragePort } from '../../../publishing/ports/assets-storage.port';

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

    handler = new UploadAssetsHandler(assetStorage, logger);
  });

  it('should initialize logger with correct child context', () => {
    expect(logger.child).toHaveBeenCalledWith({ handler: 'UploadAssetHandler' });
    expect(logger.debug).toHaveBeenCalledWith('UploadAssetHandler initialized.');
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
