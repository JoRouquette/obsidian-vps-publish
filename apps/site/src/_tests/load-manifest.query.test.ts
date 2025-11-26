import { LoadManifestQuery } from '../application/queries/load-manifest.query';
import { Manifest } from '../domain/models/manifest';
import { ManifestRepository } from '../domain/ports/manifest-repository.port';

describe('LoadManifestQuery', () => {
  it('delegates to repository', async () => {
    const mockRepo: ManifestRepository = {
      load: jest.fn().mockResolvedValue({ sessionId: 's', createdAt: '', lastUpdatedAt: '', pages: [] } as Manifest),
    };

    const q = new LoadManifestQuery(mockRepo);
    const res = await q.execute(undefined as any);

    expect(mockRepo.load).toHaveBeenCalledTimes(1);
    expect(res.sessionId).toBe('s');
  });
});
