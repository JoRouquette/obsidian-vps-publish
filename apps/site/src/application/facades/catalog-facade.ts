import { computed, Inject, Injectable, signal } from '@angular/core';
import { FindPageHandler, LoadManifestHandler, SearchPagesHandler } from '@core-application';
import type { Manifest, ManifestPage, ManifestRepository } from '@core-domain';
import { defaultManifest } from '@core-domain';

import type { ContentRepository } from '../../domain/ports/content-repository.port';
import { CONTENT_REPOSITORY, MANIFEST_REPOSITORY } from '../../domain/ports/tokens';

@Injectable({ providedIn: 'root' })
export class CatalogFacade {
  private readonly loadManifestQuery: LoadManifestHandler;
  private readonly searchQuery: SearchPagesHandler;
  private readonly findQuery: FindPageHandler;

  manifest = signal<Manifest>(defaultManifest);
  query = signal('');
  loading = signal(false);
  error = signal<string | null>(null);

  constructor(
    @Inject(MANIFEST_REPOSITORY) private readonly manifestRepository: ManifestRepository,
    @Inject(CONTENT_REPOSITORY) private readonly contentRepository: ContentRepository
  ) {
    this.loadManifestQuery = new LoadManifestHandler(this.manifestRepository);
    void this.loadManifestQuery.handle().then((m) => {
      this.manifest.set(m);
    });

    this.searchQuery = new SearchPagesHandler();
    this.findQuery = new FindPageHandler();
  }

  results = computed(() => {
    const m = this.manifest();
    if (!m) return [];
    return this.searchQuery.handle({ manifest: m, query: this.query() });
  });

  async ensureManifest(): Promise<void> {
    this.loading.set(true);
    this.error.set(null);
    try {
      const m = await this.loadManifestQuery.handle();
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

    const page = await this.findQuery.handle({ manifest: m, slugOrRoute });

    if (!page) {
      return null;
    }

    const raw = await this.contentRepository.fetch((page as ManifestPage).route);

    return { title: page.title, html: raw };
  }
}
