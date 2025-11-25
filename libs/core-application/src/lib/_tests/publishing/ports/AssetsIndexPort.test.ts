import {
  AssetsIndexPort,
  AssetsIndex,
  AssetIndexEntry,
} from '../../../publishing/ports/AssetsIndexPort';

describe('AssetsIndexPort', () => {
  let port: AssetsIndexPort;

  beforeEach(() => {
    port = {
      save: jest.fn().mockResolvedValue(undefined),
      rebuildIndex: jest.fn().mockResolvedValue(undefined),
    };
  });

  const sampleEntry: AssetIndexEntry = {
    id: 'asset1',
    filename: 'file1.png',
    route: '/assets/file1.png',
    classes: ['image', 'thumbnail'],
  };

  const sampleIndex: AssetsIndex = {
    assets: [sampleEntry],
  };

  it('should call save with the correct index', async () => {
    await port.save(sampleIndex);
    expect(port.save).toHaveBeenCalledWith(sampleIndex);
  });

  it('should call rebuildIndex with the correct index', async () => {
    await port.rebuildIndex(sampleIndex);
    expect(port.rebuildIndex).toHaveBeenCalledWith(sampleIndex);
  });

  it('should handle saving an empty index', async () => {
    const emptyIndex: AssetsIndex = { assets: [] };
    await port.save(emptyIndex);
    expect(port.save).toHaveBeenCalledWith(emptyIndex);
  });

  it('should handle rebuilding index with multiple assets', async () => {
    const multiIndex: AssetsIndex = {
      assets: [
        sampleEntry,
        {
          id: 'asset2',
          filename: 'file2.jpg',
          route: '/assets/file2.jpg',
          classes: ['image'],
        },
      ],
    };
    await port.rebuildIndex(multiIndex);
    expect(port.rebuildIndex).toHaveBeenCalledWith(multiIndex);
  });

  it('should return a promise from save', async () => {
    await expect(port.save(sampleIndex)).resolves.toBeUndefined();
  });

  it('should return a promise from rebuildIndex', async () => {
    await expect(port.rebuildIndex(sampleIndex)).resolves.toBeUndefined();
  });
});
