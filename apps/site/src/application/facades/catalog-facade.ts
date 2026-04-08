import { computed, Inject, Injectable, Optional, signal } from '@angular/core';
import type { Manifest, ManifestPage, ManifestRepository } from '@core-domain';
import { defaultManifest } from '@core-domain';
import { Subject, takeUntil } from 'rxjs';
import { FindPageHandler } from '@core-application/catalog/queries/find-page.query';
import { LoadManifestHandler } from '@core-application/catalog/queries/load-manifest.query';
import { SearchPagesHandler } from '@core-application/catalog/queries/search-pages.query';

import type { ContentRepository } from '../../domain/ports/content-repository.port';
import { CONTENT_REPOSITORY, MANIFEST_REPOSITORY } from '../../domain/ports/tokens';
import { ContentVersionService } from '../../infrastructure/content-version/content-version.service';

@Injectable({ providedIn: 'root' })
export class CatalogFacade {
  private readonly loadManifestQuery: LoadManifestHandler;
  private readonly searchQuery: SearchPagesHandler;
  private readonly findQuery: FindPageHandler;
  private readonly destroy$ = new Subject<void>();

  manifest = signal<Manifest>(defaultManifest);
  query = signal('');
  loading = signal(false);
  error = signal<string | null>(null);

  constructor(
    @Inject(MANIFEST_REPOSITORY) private readonly manifestRepository: ManifestRepository,
    @Inject(CONTENT_REPOSITORY) private readonly contentRepository: ContentRepository,
    @Optional()
    @Inject(ContentVersionService)
    private readonly contentVersionService?: Pick<
      ContentVersionService,
      'versionChanged$' | 'checkVersion'
    >
  ) {
    this.loadManifestQuery = new LoadManifestHandler(this.manifestRepository);
    void this.initializeManifest();

    this.searchQuery = new SearchPagesHandler();
    this.findQuery = new FindPageHandler();

    this.contentVersionService?.versionChanged$.pipe(takeUntil(this.destroy$)).subscribe(() => {
      void this.ensureManifest();
    });
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

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
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

  private async initializeManifest(): Promise<void> {
    try {
      await this.contentVersionService?.checkVersion?.();
    } catch {
      // If version probing fails, still load the manifest.
    }

    const manifest = await this.loadManifestQuery.handle();
    this.manifest.set(manifest);
  }
}
