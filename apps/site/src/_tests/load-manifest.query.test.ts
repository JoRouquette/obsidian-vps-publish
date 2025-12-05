import { LoadManifestHandler } from '@core-application';
import type { ManifestRepository } from '@core-domain';

describe('LoadManifestHandler', () => {
  it('delegates to repository', async () => {
    const mockRepo: ManifestRepository = {
      load: jest.fn().mockResolvedValue({
        sessionId: 's',
        createdAt: new Date(),
        lastUpdatedAt: new Date(),
        pages: [],
      }),
    };

    const q = new LoadManifestHandler(mockRepo);
    const res = await q.handle();

    expect(mockRepo.load).toHaveBeenCalledTimes(1);
    expect(res.sessionId).toBe('s');
  });
});
