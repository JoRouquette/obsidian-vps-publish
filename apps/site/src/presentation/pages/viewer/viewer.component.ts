import {
  ChangeDetectionStrategy,
  Component,
  effect,
  ElementRef,
  Inject,
  type OnDestroy,
  signal,
  ViewChild,
  ViewEncapsulation,
} from '@angular/core';
import { MatIconModule } from '@angular/material/icon';
import { MatTooltip, MatTooltipModule } from '@angular/material/tooltip';
import { DomSanitizer, type SafeHtml } from '@angular/platform-browser';
import { Router } from '@angular/router';
import { distinctUntilChanged, map, Subscription, switchMap } from 'rxjs';

import { CatalogFacade } from '../../../application/facades/catalog-facade';
import { CONTENT_REPOSITORY } from '../../../domain/ports/tokens';
import { HttpContentRepository } from '../../../infrastructure/http/http-content.repository';
import { ImageOverlayComponent } from '../../components/image-overlay/image-overlay.component';

@Component({
  standalone: true,
  selector: 'app-viewer',
  templateUrl: './viewer.component.html',
  styleUrls: ['./viewer.component.scss'],
  imports: [MatIconModule, MatTooltipModule, ImageOverlayComponent],
  encapsulation: ViewEncapsulation.None,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ViewerComponent implements OnDestroy {
  @ViewChild('contentEl', { static: true }) contentEl?: ElementRef<HTMLElement>;
  @ViewChild('tooltipTarget', { read: MatTooltip }) tooltip?: MatTooltip;
  @ViewChild('tooltipTarget', { read: ElementRef }) tooltipTarget?: ElementRef<HTMLElement>;
  @ViewChild(ImageOverlayComponent) imageOverlay?: ImageOverlayComponent;

  title = signal<string>('');
  html = signal<SafeHtml | null>(null);
  readonly tooltipMessage = 'Cette page arrive prochainement';

  private readonly sub = new Subscription();
  private readonly cleanupFns: Array<() => void> = [];

  constructor(
    @Inject(CONTENT_REPOSITORY) private readonly contentRepository: HttpContentRepository,
    private readonly router: Router,
    private readonly sanitizer: DomSanitizer,
    private readonly catalog: CatalogFacade
  ) {
    this.html.set(this.sanitizer.bypassSecurityTrustHtml('Chargement...'));
    const s = this.router.events
      .pipe(
        map(() => this.router.url.split('?')[0].split('#')[0]),
        distinctUntilChanged(),
        switchMap((routePath) => {
          const normalized = routePath.replace(/\/+$/, '') || '/';
          const htmlUrl = normalized === '/' ? '/index.html' : `${normalized}.html`;
          const manifest = this.catalog.manifest();

          if (manifest.pages.length > 0) {
            const p = manifest.pages.find((x) => x.route === normalized);

            if (p) {
              this.title.set(this.capitalize(p.title) ?? '');
            }
          }

          return this.contentRepository.fetch(htmlUrl);
        })
      )
      .subscribe({
        next: (raw) => this.html.set(this.sanitizer.bypassSecurityTrustHtml(raw)),
        error: () => this.html.set(this.sanitizer.bypassSecurityTrustHtml('<p>Introuvable.</p>')),
      });

    this.sub.add(s);

    effect(() => {
      this.html();
      setTimeout(() => {
        this.decorateWikilinks();
        this.decorateImages();
      });
    });
  }

  ngOnDestroy() {
    this.cleanupWikilinks();
    this.cleanupImages();
    this.tooltip?.hide();
    this.sub.unsubscribe();
  }

  private capitalize(s: string) {
    return s.charAt(0).toUpperCase() + s.slice(1);
  }

  private decorateWikilinks() {
    this.cleanupWikilinks();

    const container = this.contentEl?.nativeElement;
    if (!container) return;

    const resolvedLinks = Array.from(container.querySelectorAll<HTMLAnchorElement>('a.wikilink'));
    for (const link of resolvedLinks) {
      const clickHandler = (event: Event) => this.handleResolvedClick(event, link);
      link.addEventListener('click', clickHandler);
      this.cleanupFns.push(() => link.removeEventListener('click', clickHandler));
    }

    const unresolvedLinks = Array.from(
      container.querySelectorAll<HTMLElement>('.wikilink-unresolved')
    );
    for (const link of unresolvedLinks) {
      const prevent = (event: Event) => event.preventDefault();
      const show = (event: Event) => this.showTooltip(event);
      const hide = () => this.hideTooltip();

      link.addEventListener('click', prevent);
      link.addEventListener('mouseenter', show);
      link.addEventListener('focus', show);
      link.addEventListener('mouseleave', hide);
      link.addEventListener('blur', hide);

      this.cleanupFns.push(() => {
        link.removeEventListener('click', prevent);
        link.removeEventListener('mouseenter', show);
        link.removeEventListener('focus', show);
        link.removeEventListener('mouseleave', hide);
        link.removeEventListener('blur', hide);
      });
    }
  }

  private cleanupWikilinks() {
    while (this.cleanupFns.length > 0) {
      const fn = this.cleanupFns.pop();
      fn?.();
    }
  }

  private handleResolvedClick(event: Event, link: HTMLAnchorElement) {
    const href = link.getAttribute('href');
    if (!href) return;

    const isExternal = /^[a-z]+:\/\//i.test(href) || href.startsWith('mailto:');
    if (isExternal) return;

    event.preventDefault();
    void this.router.navigateByUrl(href);
  }

  private showTooltip(event: Event) {
    const target = event.currentTarget as HTMLElement | null;
    if (!target) return;

    const message =
      target.getAttribute('title') ?? target.dataset['tooltip'] ?? this.tooltipMessage;
    this.updateTooltipAnchor(target, message);
    target.removeAttribute('title');
  }

  private hideTooltip() {
    this.tooltip?.hide();
  }

  private updateTooltipAnchor(target: HTMLElement, message: string) {
    if (!this.tooltip || !this.tooltipTarget) return;

    const proxy = this.tooltipTarget.nativeElement;
    const rect = target.getBoundingClientRect();

    proxy.style.position = 'fixed';
    proxy.style.left = `${rect.left}px`;
    proxy.style.top = `${rect.top}px`;
    proxy.style.width = `${Math.max(rect.width, 1)}px`;
    proxy.style.height = `${Math.max(rect.height, 1)}px`;
    proxy.style.pointerEvents = 'none';
    proxy.style.opacity = '0';

    this.tooltip.message = message || this.tooltipMessage;
    this.tooltip.show();
  }

  private decorateImages() {
    this.cleanupImages();

    const container = this.contentEl?.nativeElement;
    if (!container) return;

    const images = Array.from(container.querySelectorAll<HTMLImageElement>('img'));
    for (const img of images) {
      img.style.cursor = 'pointer';
      const clickHandler = () => this.openImageOverlay(img);
      img.addEventListener('click', clickHandler);
      this.cleanupFns.push(() => img.removeEventListener('click', clickHandler));
    }
  }

  private cleanupImages() {
    // Cleanup is handled by cleanupWikilinks which clears the same cleanupFns array
  }

  private openImageOverlay(img: HTMLImageElement) {
    if (!this.imageOverlay) return;
    const src = img.src;
    const alt = img.alt || '';
    this.imageOverlay.open(src, alt);
  }
}
