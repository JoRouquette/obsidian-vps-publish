import { AssetStoragePort } from '../../../publishing/ports/assets-storage.port';

describe('AssetStoragePort', () => {
  let assetStorage: AssetStoragePort;

  beforeEach(() => {
    assetStorage = {
      save: jest.fn().mockResolvedValue(undefined),
    };
  });

  it('should call save with correct parameters', async () => {
    const files = [
      { filename: 'file1.txt', content: Buffer.from('hello') },
      { filename: 'file2.txt', content: Buffer.from('world') },
    ];
    await assetStorage.save(files);
    expect(assetStorage.save).toHaveBeenCalledWith(files);
  });

  it('should resolve when save is called', async () => {
    await expect(
      assetStorage.save([{ filename: 'test.txt', content: Buffer.from('data') }])
    ).resolves.toBeUndefined();
  });

  it('should handle empty array', async () => {
    await expect(assetStorage.save([])).resolves.toBeUndefined();
    expect(assetStorage.save).toHaveBeenCalledWith([]);
  });

  it('should reject if implementation throws', async () => {
    const errorStorage: AssetStoragePort = {
      save: jest.fn().mockRejectedValue(new Error('Save failed')),
    };
    await expect(
      errorStorage.save([{ filename: 'fail.txt', content: Buffer.from('fail') }])
    ).rejects.toThrow('Save failed');
  });
});
