import { of } from 'rxjs';
import { HttpManifestRepository } from '../infrastructure/http/HttpManifestRepository';
import { ManifestDTO } from '../infrastructure/dto/Manifest.dto';

describe('HttpManifestRepository', () => {
  const dto: ManifestDTO = {
    sessionId: 's1',
    createdAt: '2024-01-01T00:00:00Z',
    lastUpdatedAt: '2024-01-02T00:00:00Z',
    pages: [],
  };

  it('loads and maps manifest, using cache', async () => {
    const get = jest.fn().mockReturnValue(of(dto));
    const repo = new HttpManifestRepository({ get } as any);

    const res1 = await repo.load();
    const res2 = await repo.load();

    expect(get).toHaveBeenCalledTimes(1);
    expect(res1.sessionId).toBe('s1');
    expect(res2.sessionId).toBe('s1');
  });
});
