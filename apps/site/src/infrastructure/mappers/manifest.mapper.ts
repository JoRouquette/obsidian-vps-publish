import { ManifestDTO } from '../dto/Manifest.dto';
import { Manifest } from '../../domain/models/Manifest';
import { Page } from '../../domain/models/Page';
import { Slug } from '../../domain/value-objects/Slug';

export function toDomain(dto: ManifestDTO): Manifest {
  return {
    sessionId: dto.sessionId,
    createdAt: dto.createdAt,
    lastUpdatedAt: dto.lastUpdatedAt,
    pages: dto.pages.map<Page>((p) => ({
      id: p.id,
      route: p.route,
      title: p.title,
      tags: p.tags ?? [],
      relativePath: p.relativePath,
      publishedAt: p.publishedAt ? new Date(p.publishedAt) : undefined,
      slug: p.slug ? Slug.from(p.slug) : Slug.fromRoute(p.route),
    })),
  };
}
