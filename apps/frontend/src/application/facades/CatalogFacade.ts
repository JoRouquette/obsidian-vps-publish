import { computed, Inject, Injectable, signal } from '@angular/core';
import { Manifest } from '../../domain/models/Manifest';
import { HtmlGateway } from '../../domain/ports/HtmlGateway';
import { ManifestRepository } from '../../domain/ports/ManifestRepository';
import { HTML_GATEWAY, MANIFEST_REPOSITORY } from '../../domain/ports/tokens';
import { FindPageUseCase } from '../usecases/FindPage.usecase';
import { LoadManifestUseCase } from '../usecases/LoadManifest.usecase';
import { SearchPagesUseCase } from '../usecases/SearchPages.usecase';

@Injectable({ providedIn: 'root' })
export class CatalogFacade {
  private loadManifest: LoadManifestUseCase;
  private searchUc: SearchPagesUseCase;
  private findUc: FindPageUseCase;

  constructor(
    @Inject(MANIFEST_REPOSITORY) private manifestRepo: ManifestRepository,
    @Inject(HTML_GATEWAY) private html: HtmlGateway
  ) {
    this.loadManifest = new LoadManifestUseCase(this.manifestRepo);
    this.searchUc = new SearchPagesUseCase();
    this.findUc = new FindPageUseCase();
  }

  manifest = signal<Manifest | null>(null);
  query = signal('');
  loading = signal(false);
  error = signal<string | null>(null);

  results = computed(() => {
    const m = this.manifest();
    if (!m) return [];
    return this.searchUc.exec(m, this.query());
  });

  async ensureManifest(): Promise<void> {
    if (this.manifest()) return;
    this.loading.set(true);
    this.error.set(null);
    try {
      const m = await this.loadManifest.exec();
      this.manifest.set(m);
    } catch (e: any) {
      this.error.set('Manifest indisponible');
    } finally {
      this.loading.set(false);
    }
  }

  async getHtmlBySlugOrRoute(slugOrRoute: string): Promise<{ title: string; html: string } | null> {
    await this.ensureManifest();
    const m = this.manifest();
    if (!m) return null;
    const page = this.findUc.exec(m, slugOrRoute);
    if (!page) return null;
    const raw = await this.html.fetch(page.filePath);
    return { title: page.title, html: raw };
  }
}
