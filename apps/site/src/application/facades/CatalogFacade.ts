import { computed, Inject, Injectable, signal } from '@angular/core';
import { defaultManifest, Manifest } from '../../domain/models/Manifest';
import { ContentRepository } from '../../domain/ports/ContentRepository';
import { ManifestRepository } from '../../domain/ports/ManifestRepository';
import { CONTENT_REPOSITORY, MANIFEST_REPOSITORY } from '../../domain/ports/tokens';
import { LoadManifestQuery } from '../queries/LoadManifest.query';
import { SearchPagesQuery } from '../queries/SearchPages.query';
import { FindPageQuery } from '../queries/FindPage.query';
import { Page } from '../../domain/models/Page';

@Injectable({ providedIn: 'root' })
export class CatalogFacade {
  private readonly loadManifestQuery: LoadManifestQuery;
  private readonly searchQuery: SearchPagesQuery;
  private readonly findQuery: FindPageQuery;

  manifest = signal<Manifest>(defaultManifest);
  query = signal('');
  loading = signal(false);
  error = signal<string | null>(null);

  constructor(
    @Inject(MANIFEST_REPOSITORY) private readonly manifestRepository: ManifestRepository,
    @Inject(CONTENT_REPOSITORY) private readonly contentRepository: ContentRepository
  ) {
    this.loadManifestQuery = new LoadManifestQuery(this.manifestRepository);
    this.loadManifestQuery.execute().then((m) => {
      this.manifest.set(m);
    });

    this.searchQuery = new SearchPagesQuery();
    this.findQuery = new FindPageQuery();
  }

  results = computed(() => {
    const m = this.manifest();
    if (!m) return [];
    return this.searchQuery.execute({ manifest: m, query: this.query() });
  });

  async ensureManifest(): Promise<void> {
    if (this.manifest()) {
      return;
    }
    this.loading.set(true);
    this.error.set(null);
    try {
      const m = await this.loadManifestQuery.execute();
      this.manifest.set(m);
    } catch (e) {
      this.error.set(
        'Manifest indisponible pour le moment :' + (e instanceof Error ? ' ' + e.message : '')
      );
    } finally {
      this.loading.set(false);
    }
  }

  async getHtmlBySlugOrRoute(slugOrRoute: string): Promise<{ title: string; html: string } | null> {
    await this.ensureManifest();
    const m = this.manifest();

    if (!m) {
      return null;
    }

    const page = await this.findQuery.execute({ manifest: m, slugOrRoute });

    if (!page) {
      return null;
    }

    const raw = await this.contentRepository.fetch((page as Page).route);

    return { title: page.title, html: raw };
  }
}
