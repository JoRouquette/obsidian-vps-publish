import { toDomain } from '../infrastructure/mappers/manifest.mapper';
import { ManifestDTO } from '../infrastructure/dto/manifest.dto';

describe('manifest.mapper', () => {
  it('maps dto to domain with slug fallback and dates', () => {
    const dto: ManifestDTO = {
      sessionId: 's1',
      createdAt: '2024-01-01T00:00:00Z',
      lastUpdatedAt: '2024-01-02T00:00:00Z',
      pages: [
        {
          id: 'p1',
          route: '/guide/start',
          title: 'Start',
          tags: ['guide'],
          relativePath: 'guide/start.md',
        },
      ],
    };

    const domain = toDomain(dto);

    expect(domain.pages[0].slug.toString()).toBe('start');
    expect(domain.pages[0].publishedAt).toBeUndefined();
    expect(new Date(domain.createdAt).getTime()).toBe(new Date(dto.createdAt).getTime());
  });
});
