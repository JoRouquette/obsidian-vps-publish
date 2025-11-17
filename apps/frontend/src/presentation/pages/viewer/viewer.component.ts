import {
  Component,
  signal,
  OnDestroy,
  ViewEncapsulation,
  ChangeDetectionStrategy,
} from '@angular/core';
import { Router } from '@angular/router';
import { HttpClient } from '@angular/common/http';
import { DomSanitizer, SafeHtml } from '@angular/platform-browser';
import { Subscription, switchMap, map, distinctUntilChanged } from 'rxjs';
import { CatalogFacade } from '../../../application/facades/CatalogFacade';

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
    private readonly router: Router,
    private readonly http: HttpClient,
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
          const m = this.catalog.manifest?.();

          if (m?.pages?.length) {
            const p = m.pages.find((x) => x.route === normalized);
            this.title.set(p?.title ?? '');
          } else {
            const parts = normalized.split('/').filter(Boolean);
            const last = parts.at(-1);
            this.title.set(last ? decodeURIComponent(last) : '');
          }

          return this.http.get(`content${htmlUrl}`, { responseType: 'text' });
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
}
