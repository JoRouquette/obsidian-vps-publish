import {
  ChangeDetectionStrategy,
  Component,
  Inject,
  OnDestroy,
  signal,
  ViewEncapsulation,
} from '@angular/core';
import { DomSanitizer, SafeHtml } from '@angular/platform-browser';
import { Router } from '@angular/router';
import { distinctUntilChanged, map, Subscription, switchMap } from 'rxjs';
import { CatalogFacade } from '../../../application/facades/CatalogFacade';
import { CONTENT_REPOSITORY } from '../../../domain/ports/tokens';
import { HttpContentRepository } from '../../../infrastructure/http/HttpContentRepository';

@Component({
  standalone: true,
  selector: 'app-viewer',
  templateUrl: './viewer.component.html',
  styleUrls: ['./viewer.component.scss'],
  encapsulation: ViewEncapsulation.None,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ViewerComponent implements OnDestroy {
  title = signal<string>('');
  html = signal<SafeHtml>('Chargement…' as any);

  private readonly sub = new Subscription();

  constructor(
    @Inject(CONTENT_REPOSITORY) private readonly contentRepository: HttpContentRepository,
    private readonly router: Router,
    private readonly sanitizer: DomSanitizer,
    private readonly catalog: CatalogFacade
  ) {
    const s = this.router.events
      .pipe(
        map(() => this.router.url.split('?')[0].split('#')[0]),
        distinctUntilChanged(),
        switchMap((routePath) => {
          const normalized = routePath.replace(/\/+$/, '') || '/';
          const htmlUrl = normalized === '/' ? '/index.html' : `${normalized}.html`;
          const manifest = this.catalog.manifest();

          console.log('Loading content for', normalized);

          if (manifest.pages.length > 0) {
            const p = manifest.pages.find((x) => x.route === normalized);

            if (p) {
              this.title.set(this.capitalize(p.title) ?? '');
            }
          } else {
            const parts = normalized.split('/').filter(Boolean);
            const last = parts.at(-1);
            this.title.set(last ? decodeURIComponent(last) : '');
          }

          return this.contentRepository.fetch(htmlUrl);
        })
      )
      .subscribe({
        next: (raw) => this.html.set(this.sanitizer.bypassSecurityTrustHtml(raw)),
        error: () => this.html.set(this.sanitizer.bypassSecurityTrustHtml('<p>Introuvable.</p>')),
      });

    this.sub.add(s);
  }

  ngOnDestroy() {
    this.sub.unsubscribe();
  }

  private capitalize(s: string) {
    return s.charAt(0).toUpperCase() + s.slice(1);
  }
}
