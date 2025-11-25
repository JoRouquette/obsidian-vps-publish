import { ContentStoragePort } from '../../../publishing/ports/ContentStoragePort';

describe('ContentStoragePort', () => {
  let contentStorage: ContentStoragePort;

  beforeEach(() => {
    contentStorage = {
      save: jest.fn().mockResolvedValue(undefined),
    };
  });

  it('should call save with correct parameters', async () => {
    const params = { route: '/test', content: 'Hello World', slug: 'hello-world' };
    await contentStorage.save(params);
    expect(contentStorage.save).toHaveBeenCalledWith(params);
  });

  it('should resolve when save is successful', async () => {
    await expect(
      contentStorage.save({ route: '/route', content: 'data', slug: 'slug' })
    ).resolves.toBeUndefined();
  });

  it('should reject if save throws an error', async () => {
    const errorStorage: ContentStoragePort = {
      save: jest.fn().mockRejectedValue(new Error('Failed to save')),
    };
    await expect(
      errorStorage.save({ route: '/fail', content: 'fail', slug: 'fail-slug' })
    ).rejects.toThrow('Failed to save');
  });
});
