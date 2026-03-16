import { isPlatformBrowser } from '@angular/common';
import {
  AfterViewInit,
  afterNextRender,
  Component,
  ElementRef,
  Injector,
  inject,
  Input,
  NgZone,
  OnDestroy,
  PLATFORM_ID,
  ViewChild,
} from '@angular/core';
import type { LeafletBlock } from '@core-domain/entities/leaflet-block';
import { ContentVersionService } from '../../../infrastructure/content-version/content-version.service';

/**
 * Composant Angular pour afficher une carte Leaflet en mode lecture seule.
 *
 * IMPORTANT: Ce composant est SSR-safe et n'initialise Leaflet que côté navigateur.
 * Leaflet utilise des APIs de navigateur (window, document) qui ne sont pas disponibles
 * côté serveur lors du rendu SSR.
 *
 * Fonctionnalités:
 * - Lecture seule (pas d'édition, pas de sauvegarde d'état)
 * - Pan et zoom autorisés
 * - Support des marqueurs avec popups
 * - Support des images overlays
 * - Support des serveurs de tuiles personnalisés
 * - Mode sombre optionnel
 */
@Component({
  selector: 'app-leaflet-map',
  standalone: true,
  imports: [],
  templateUrl: './leaflet-map.component.html',
  styleUrls: ['./leaflet-map.component.scss'],
})
export class LeafletMapComponent implements AfterViewInit, OnDestroy {
  @ViewChild('mapContainer', { static: false }) mapContainer!: ElementRef<HTMLElement>;

  @Input({ required: true }) block!: LeafletBlock;

  private readonly platformId = inject(PLATFORM_ID);
  private readonly ngZone = inject(NgZone);
  private readonly injector = inject(Injector);
  private readonly contentVersionService = inject(ContentVersionService);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  private map: any = null; // Type 'any' pour éviter l'import de Leaflet côté serveur
  private isBrowser = false;
  private initInProgress = false;
  private initCompleted = false;
  private isDestroyed = false;
  private initAttemptCount = 0;
  private overlaysLoaded = 0;
  private totalOverlays = 0;
  private viewAdjusted = false; // Flag pour empêcher les fitBounds multiples
  private pendingRafId: number | null = null;
  private pendingTimeoutId: ReturnType<typeof setTimeout> | null = null;
  private resizeObserver: ResizeObserver | null = null;
  private resizeInvalidateCount = 0;
  private resizeInvalidateTimeoutId: ReturnType<typeof setTimeout> | null = null;
  private restoreInteractionsTimeoutId: ReturnType<typeof setTimeout> | null = null;
  private fitBoundsTimeoutId: ReturnType<typeof setTimeout> | null = null;
  private hasLoggedUnmeasurableContainer = false;

  private readonly maxInitAttempts = 30;
  private readonly maxResizeInvalidations = 12;

  ngAfterViewInit(): void {
    this.isBrowser = isPlatformBrowser(this.platformId);

    if (!this.isBrowser) {
      // En mode SSR, on ne fait rien
      return;
    }

    this.logInfo('init-started', { stage: 'after-view-init' });

    // Déclencher une tentative post-render explicite + fallback retry borné.
    afterNextRender(
      () => {
        this.tryInitialize('afterNextRender');
      },
      { injector: this.injector }
    );

    this.scheduleRetry('afterViewInit');
  }

  ngOnDestroy(): void {
    this.isDestroyed = true;

    if (this.pendingRafId !== null && typeof cancelAnimationFrame === 'function') {
      cancelAnimationFrame(this.pendingRafId);
      this.pendingRafId = null;
    }

    if (this.pendingTimeoutId !== null) {
      clearTimeout(this.pendingTimeoutId);
      this.pendingTimeoutId = null;
    }

    if (this.resizeInvalidateTimeoutId !== null) {
      clearTimeout(this.resizeInvalidateTimeoutId);
      this.resizeInvalidateTimeoutId = null;
    }

    if (this.restoreInteractionsTimeoutId !== null) {
      clearTimeout(this.restoreInteractionsTimeoutId);
      this.restoreInteractionsTimeoutId = null;
    }

    if (this.fitBoundsTimeoutId !== null) {
      clearTimeout(this.fitBoundsTimeoutId);
      this.fitBoundsTimeoutId = null;
    }

    if (this.resizeObserver) {
      this.resizeObserver.disconnect();
      this.resizeObserver = null;
    }

    if (this.map) {
      this.map.remove();
      this.map = null;
    }

    this.logInfo('destroy-executed', {
      attempts: this.initAttemptCount,
      initCompleted: this.initCompleted,
      overlaysLoaded: this.overlaysLoaded,
      totalOverlays: this.totalOverlays,
    });
  }

  private get mapId(): string {
    return this.block?.id ?? 'unknown-map';
  }

  private hasMeasurableSize(container: HTMLElement): boolean {
    const rect = container.getBoundingClientRect();
    return rect.width > 0 && rect.height > 0;
  }

  private canInitializeNow(): { ok: boolean; reason?: string; container?: HTMLElement } {
    const container = this.mapContainer?.nativeElement;
    if (!container) {
      return { ok: false, reason: 'map container is missing' };
    }
    if (!container.isConnected) {
      return { ok: false, reason: 'map container is not attached to DOM' };
    }
    if (!this.hasMeasurableSize(container)) {
      return { ok: false, reason: 'map container has non-measurable size' };
    }
    return { ok: true, container };
  }

  private tryInitialize(trigger: string): void {
    if (
      !this.isBrowser ||
      this.isDestroyed ||
      this.map ||
      this.initCompleted ||
      this.initInProgress
    ) {
      return;
    }

    const readiness = this.canInitializeNow();
    if (!readiness.ok) {
      if (
        readiness.reason === 'map container has non-measurable size' &&
        !this.hasLoggedUnmeasurableContainer
      ) {
        this.hasLoggedUnmeasurableContainer = true;
        this.logWarn('container-not-measurable', {
          category: 'dimensions',
          trigger,
          attempt: this.initAttemptCount,
        });
      }

      if (this.initAttemptCount >= this.maxInitAttempts) {
        this.logError('init-aborted', {
          category: 'timing',
          trigger,
          attempts: this.maxInitAttempts,
          reason: readiness.reason,
        });
        return;
      }

      this.scheduleRetry(`${trigger} -> ${readiness.reason}`);
      return;
    }

    this.logInfo('leaflet-init-started', {
      category: 'timing',
      trigger,
      attempt: this.initAttemptCount,
    });

    this.initInProgress = true;

    void this.loadLeafletAndInitializeMap(trigger)
      .catch((error) => {
        this.logError('leaflet-init-failed', {
          category: 'timing',
          trigger,
          error,
        });
      })
      .finally(() => {
        this.initInProgress = false;
      });
  }

  private scheduleRetry(reason: string): void {
    if (this.isDestroyed || this.map || this.initCompleted || this.initInProgress) {
      return;
    }

    if (this.initAttemptCount >= this.maxInitAttempts) {
      return;
    }

    if (this.pendingRafId !== null || this.pendingTimeoutId !== null) {
      return;
    }

    this.initAttemptCount++;

    if (typeof requestAnimationFrame === 'function') {
      this.pendingRafId = requestAnimationFrame(() => {
        this.pendingRafId = null;
        this.tryInitialize(`retry#${this.initAttemptCount} (${reason})`);
      });
      return;
    }

    // Fallback sans RAF (environnement browser atypique).
    this.pendingTimeoutId = setTimeout(() => {
      this.pendingTimeoutId = null;
      this.tryInitialize(`retry#${this.initAttemptCount} (${reason})`);
    }, 16);
  }

  private queueInvalidateSize(delayMs: number, context: string): void {
    if (!this.map || this.isDestroyed) {
      return;
    }

    if (this.resizeInvalidateCount >= this.maxResizeInvalidations) {
      return;
    }

    if (this.resizeInvalidateTimeoutId !== null) {
      clearTimeout(this.resizeInvalidateTimeoutId);
      this.resizeInvalidateTimeoutId = null;
    }

    // Counter is incremented per actual execution (not per queued call),
    // acting as a bounded-execution guard rather than a call counter.
    this.resizeInvalidateTimeoutId = setTimeout(() => {
      this.resizeInvalidateTimeoutId = null;

      if (!this.map || this.isDestroyed) {
        return;
      }

      this.resizeInvalidateCount++;

      try {
        this.map.invalidateSize();
      } catch (error) {
        this.logError('invalidate-size-failed', {
          category: 'dimensions',
          context,
          error,
        });
      }
    }, delayMs);
  }

  private setupResizeObserver(container: HTMLElement): void {
    if (!this.isBrowser || this.isDestroyed || typeof ResizeObserver === 'undefined') {
      return;
    }

    this.resizeObserver?.disconnect();
    this.resizeObserver = new ResizeObserver((entries) => {
      if (
        !this.map ||
        this.isDestroyed ||
        this.resizeInvalidateCount >= this.maxResizeInvalidations
      ) {
        return;
      }

      const entry = entries[0];
      if (!entry) {
        return;
      }

      const { width, height } = entry.contentRect;
      if (width > 0 && height > 0) {
        this.queueInvalidateSize(50, 'resize-observer');
      }
    });

    this.resizeObserver.observe(container);
  }

  private async loadLeafletAndInitializeMap(trigger: string): Promise<void> {
    let L: unknown;

    try {
      // Import dynamique pour éviter les erreurs SSR
      const leafletModule = await import('leaflet');

      // Extraire L depuis le module (support ESM avec .default)
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      L = (leafletModule as any).default || leafletModule;

      // Importer le plugin fullscreen (side-effect: ajoute L.Control.Fullscreen)
      await import('leaflet.fullscreen');
    } catch (error) {
      this.logError('dynamic-import-failed', {
        category: 'import',
        trigger,
        error,
      });
      throw error;
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const leaflet = L as any;
    if (leaflet.Icon?.Default) {
      leaflet.Icon.Default.mergeOptions({
        iconRetinaUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
        iconUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
        shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
      });
    }

    this.initializeMap(leaflet, trigger);
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  private fitBoundsWithoutAnimation(finalBounds: [[number, number], [number, number]]): void {
    if (!this.map) {
      return;
    }

    this.map.dragging.disable();
    this.map.scrollWheelZoom.disable();

    this.map.fitBounds(finalBounds, {
      padding: [20, 20],
      animate: false,
      duration: 0,
    });

    this.queueInvalidateSize(30, 'post-fitBounds');
    this.restoreInteractionsAfterDelay(50);
  }

  private restoreInteractionsAfterDelay(delayMs: number): void {
    if (this.restoreInteractionsTimeoutId !== null) {
      clearTimeout(this.restoreInteractionsTimeoutId);
    }

    this.restoreInteractionsTimeoutId = setTimeout(() => {
      this.restoreInteractionsTimeoutId = null;

      if (!this.map || this.isDestroyed) {
        return;
      }

      this.map.dragging.enable();
      this.map.scrollWheelZoom.enable();
    }, delayMs);
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  private initializeMap(L: any, trigger: string): void {
    const readiness = this.canInitializeNow();
    if (!readiness.ok || !readiness.container) {
      throw new Error(`container is not ready during initializeMap: ${readiness.reason}`);
    }

    // Exécuter l'initialisation en dehors de la zone Angular
    // pour éviter le change detection permanent sur les events de la carte
    this.ngZone.runOutsideAngular(() => {
      this.initializeMapOutsideZone(L, readiness.container!, trigger);
    });
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  private initializeMapOutsideZone(L: any, container: HTMLElement, trigger: string): void {
    // Vérifier si on a des images overlays
    const hasImageOverlays = this.block.imageOverlays && this.block.imageOverlays.length > 0;

    // Pour les images overlays, utiliser un CRS simple (coordonnées pixels)
    // pour préserver les proportions de l'image
    interface LeafletMapOptions {
      crs?: unknown;
      center?: [number, number];
      zoom?: number;
      minZoom?: number;
      maxZoom?: number;
      zoomControl: boolean;
      attributionControl: boolean;
      scrollWheelZoom: boolean;
      doubleClickZoom: boolean;
      boxZoom: boolean;
      keyboard: boolean;
      dragging: boolean;
      zoomAnimation: boolean;
      fadeAnimation: boolean;
      markerZoomAnimation: boolean;
      fullscreenControl: boolean;
    }

    const mapOptions: LeafletMapOptions = {
      minZoom: this.block.minZoom ?? (hasImageOverlays ? -5 : undefined),
      maxZoom: this.block.maxZoom ?? (hasImageOverlays ? 2 : undefined),
      zoomControl: true,
      attributionControl: false, // Désactiver l'attribution Leaflet par défaut
      scrollWheelZoom: true,
      doubleClickZoom: true,
      boxZoom: true,
      keyboard: true,
      dragging: true,
      // Désactiver les animations pour une navigation plus fluide
      zoomAnimation: false,
      fadeAnimation: false,
      markerZoomAnimation: false,
      // Activer le contrôle fullscreen (le plugin est maintenant chargé)
      fullscreenControl: true,
    };

    // Si on a une image overlay, utiliser CRS.Simple pour coordonnées pixels
    if (hasImageOverlays && !this.block.tileServer) {
      mapOptions.crs = L.CRS.Simple;
      mapOptions.center = [0, 0];
      mapOptions.zoom = this.block.defaultZoom ?? 0;
    } else {
      // Sinon, utiliser les coordonnées géographiques normales
      mapOptions.center = [this.block.lat ?? 0, this.block.long ?? 0];
      mapOptions.zoom = this.block.defaultZoom ?? 13;
    }

    // Création de la carte
    this.map = L.map(container, mapOptions);
    this.initCompleted = true;
    this.logInfo('leaflet-map-created', {
      category: 'timing',
      trigger,
      hasImageOverlays,
      center: mapOptions.center,
      zoom: mapOptions.zoom,
    });

    // Invalidate initial + second pass après layout différé.
    this.queueInvalidateSize(0, `post-init:${trigger}`);
    this.queueInvalidateSize(150, `post-init-second-pass:${trigger}`);
    this.setupResizeObserver(container);

    // N'ajouter la couche de tuiles OSM QUE si on n'a pas d'image overlay
    // (pour éviter d'afficher une carte du monde réel derrière une carte fantasy)
    if (!hasImageOverlays || this.block.tileServer) {
      this.addTileLayer(L);
    }

    // Ajout des images overlays si présentes
    if (hasImageOverlays) {
      this.addImageOverlays(L);
      // Marquer comme ayant des images pour désactiver le filtre sombre sur les tuiles
      container.classList.add('has-image-overlay');
    }

    // Ajout des marqueurs si présents
    if (this.block.markers && this.block.markers.length > 0) {
      this.addMarkers(L);
    }

    // Application du mode sombre si spécifié dans le bloc
    // (force le mode sombre indépendamment du thème du site)
    if (this.block.darkMode) {
      container.classList.add('leaflet-dark-mode');
    }
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  private addTileLayer(L: any): void {
    // Utiliser le serveur de tuiles personnalisé ou OpenStreetMap par défaut
    const tileUrl =
      this.block.tileServer?.url ?? 'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png';

    const attribution =
      this.block.tileServer?.attribution ??
      '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors';

    L.tileLayer(tileUrl, {
      attribution: attribution,
      subdomains: this.block.tileServer?.subdomains ?? ['a', 'b', 'c'],
      minZoom: this.block.tileServer?.minZoom,
      maxZoom: this.block.tileServer?.maxZoom,
    }).addTo(this.map);
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  private addImageOverlays(L: any): void {
    this.totalOverlays = this.block.imageOverlays?.length ?? 0;
    this.overlaysLoaded = 0;

    // Stocker tous les bounds pour calculer la vue globale
    const allBounds: [[number, number], [number, number]][] = [];

    this.block.imageOverlays?.forEach((overlay) => {
      // Construire l'URL de l'image via l'API d'assets avec cache-busting
      const cv = this.contentVersionService.currentVersion;
      const basePath = `/assets/${encodeURI(overlay.path)}`;
      const imageUrl = cv ? `${basePath}?cv=${encodeURIComponent(cv)}` : basePath;

      // Charger l'image pour obtenir ses dimensions réelles
      const img = new Image();
      img.onload = () => {
        if (this.isDestroyed || !this.map) {
          return;
        }

        const width = img.naturalWidth;
        const height = img.naturalHeight;

        // Utiliser les dimensions réelles de l'image comme bounds
        // Dans CRS.Simple, les coordonnées sont des pixels
        // On centre l'image à [0, 0]
        const bounds: [[number, number], [number, number]] = [
          [0, 0], // coin supérieur gauche
          [height, width], // coin inférieur droit (attention: [y, x] en Leaflet)
        ];

        try {
          const overlay = L.imageOverlay(imageUrl, bounds, {
            interactive: false, // Désactiver les interactions sur l'image
            className: 'leaflet-image-overlay-no-animation', // Classe pour CSS custom
          });
          overlay.addTo(this.map);
          allBounds.push(bounds);

          this.overlaysLoaded++;

          // Ajuster la vue UNE SEULE FOIS après que TOUTES les images sont chargées
          if (
            this.overlaysLoaded === this.totalOverlays &&
            allBounds.length > 0 &&
            !this.viewAdjusted
          ) {
            this.viewAdjusted = true; // Marquer pour ne jamais refaire le fit
            // Utiliser le premier bounds (ou on pourrait calculer l'union de tous)
            const finalBounds = allBounds[0];

            // Attendre un peu pour laisser les overlays se positionner
            if (this.fitBoundsTimeoutId !== null) {
              clearTimeout(this.fitBoundsTimeoutId);
            }
            this.fitBoundsTimeoutId = setTimeout(() => {
              this.fitBoundsTimeoutId = null;
              if (!this.isDestroyed) {
                this.fitBoundsWithoutAnimation(finalBounds);
              }
            }, 150);
          }
        } catch (error) {
          this.logError('image-overlay-add-failed', {
            category: 'data',
            imageUrl,
            error,
          });
        }
      };

      img.onerror = () => {
        if (this.isDestroyed) {
          return;
        }

        this.overlaysLoaded++;
        this.logError('image-overlay-load-failed', {
          category: 'data',
          imageUrl,
        });
      };

      img.src = imageUrl;
    });
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  private addMarkers(L: any): void {
    let addedCount = 0;
    let skippedByZoom = 0;

    this.block.markers?.forEach((marker) => {
      // Vérifier les contraintes de zoom si définies
      if (marker.minZoom && this.map.getZoom() < marker.minZoom) {
        skippedByZoom++;
        return;
      }
      if (marker.maxZoom && this.map.getZoom() > marker.maxZoom) {
        skippedByZoom++;
        return;
      }

      const leafletMarker = L.marker([marker.lat, marker.long]).addTo(this.map);

      // Popup avec description ou lien — HTML-escaped to prevent XSS
      let popupContent = '';
      if (marker.description) {
        popupContent = this.escapeHtml(marker.description);
      }
      if (marker.link) {
        // Résoudre le lien wikilink en route Angular
        // Format: [[Page Name]] ou juste le nom de la page
        const cleanLink = marker.link.replaceAll(/^\[\[|\]\]$/g, '').trim();
        const route = `/viewer/${encodeURIComponent(cleanLink)}`;
        const linkHtml = `<a href="${route}">${this.escapeHtml(cleanLink)}</a>`;
        popupContent = popupContent ? `${popupContent}<br>${linkHtml}` : linkHtml;
      }

      if (popupContent) {
        leafletMarker.bindPopup(popupContent);
      }

      addedCount++;
    });

    this.logInfo('markers-added', {
      category: 'data',
      totalMarkers: this.block.markers?.length ?? 0,
      addedCount,
      skippedByZoom,
    });
  }

  private isVerboseLoggingEnabled(): boolean {
    if (!this.isBrowser || globalThis.window === undefined) {
      return false;
    }

    try {
      return (
        globalThis.window.localStorage.getItem('vps:leaflet:debug') === '1' ||
        globalThis.window.localStorage.getItem('leaflet:debug') === '1'
      );
    } catch {
      return false;
    }
  }

  private escapeHtml(text: string): string {
    return text
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  private logInfo(event: string, data?: Record<string, unknown>): void {
    if (!this.isVerboseLoggingEnabled()) {
      return;
    }
    console.info('[LeafletMapComponent]', {
      event,
      mapId: this.mapId,
      ...data,
    });
  }

  private logWarn(event: string, data?: Record<string, unknown>): void {
    console.warn('[LeafletMapComponent]', {
      event,
      mapId: this.mapId,
      ...data,
    });
  }

  private logError(event: string, data?: Record<string, unknown>): void {
    console.error('[LeafletMapComponent]', {
      event,
      mapId: this.mapId,
      ...data,
    });
  }
}
