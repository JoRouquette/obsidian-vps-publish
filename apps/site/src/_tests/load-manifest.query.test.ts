import { LoadManifestHandler } from '@core-application';
import { Manifest, ManifestRepository } from '@core-domain';

describe('LoadManifestHandler', () => {
  it('delegates to repository', async () => {
    const mockRepo: ManifestRepository = {
      load: jest.fn().mockResolvedValue({ sessionId: 's', createdAt: '', lastUpdatedAt: '', pages: [] } as Manifest),
    };

    const q = new LoadManifestHandler(mockRepo);
    const res = await q.handle();

    expect(mockRepo.load).toHaveBeenCalledTimes(1);
    expect(res.sessionId).toBe('s');
  });
});
