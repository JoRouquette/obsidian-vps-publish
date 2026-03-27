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
  OnChanges,
  OnDestroy,
  PLATFORM_ID,
  SimpleChanges,
  ViewChild,
} from '@angular/core';
import {
  UNAVAILABLE_INTERNAL_PAGE_MESSAGE,
  type LeafletBlock,
  type LeafletImageOverlay,
} from '@core-domain';

import { LeafletRuntimeService } from '../../../application/services/leaflet-runtime.service';
import type {
  LeafletFullscreenControlOptions,
  LeafletLayerInstance,
  LeafletMapInstance,
  LeafletMapOptions,
  LeafletMarkerInstance,
  LeafletRuntime,
  LeafletRuntimeModuleWithDefault,
} from './leaflet-runtime.types';

type LeafletFullscreenControlConstructor = new (options?: LeafletFullscreenControlOptions) => {
  addTo(map: LeafletMapInstance): void;
};

@Component({
  selector: 'app-leaflet-map',
  standalone: true,
  imports: [],
  templateUrl: './leaflet-map.component.html',
  styleUrls: ['./leaflet-map.component.scss'],
})
export class LeafletMapComponent implements AfterViewInit, OnChanges, OnDestroy {
  @ViewChild('mapContainer', { static: false }) mapContainer!: ElementRef<HTMLElement>;

  @Input({ required: true }) block!: LeafletBlock;

  private readonly platformId = inject(PLATFORM_ID);
  private readonly ngZone = inject(NgZone);
  private readonly injector = inject(Injector);
  private readonly runtimeService = inject(LeafletRuntimeService);

  private map: LeafletMapInstance | null = null;
  private leafletRuntime: LeafletRuntime | null = null;
  private tileLayer: LeafletLayerInstance | null = null;
  private markerLayers: LeafletMarkerInstance[] = [];
  private overlayLayers: LeafletLayerInstance[] = [];
  private markerZoomSyncCleanup: (() => void) | null = null;
  private mapViewSyncCleanup: (() => void) | null = null;
  private isBrowser = false;
  private initInProgress = false;
  private isDestroyed = false;
  private initAttemptCount = 0;
  private pendingTimeoutId: ReturnType<typeof setTimeout> | null = null;
  private resizeObserver: ResizeObserver | null = null;
  private resizeInvalidateTimeoutId: ReturnType<typeof setTimeout> | null = null;
  private fitBoundsTimeoutId: ReturnType<typeof setTimeout> | null = null;
  private globalCleanupFns: Array<() => void> = [];
  private simpleCrsInteractionCleanupFns: Array<() => void> = [];
  private lastSimpleCrsWheelZoomAt = 0;
  private renderToken = 0;
  private hasLoggedUnmeasurableContainer = false;

  ngAfterViewInit(): void {
    this.isBrowser = isPlatformBrowser(this.platformId);

    if (!this.isBrowser) {
      return;
    }

    this.logInfo('init-started', { stage: 'after-view-init' });

    afterNextRender(
      () => {
        this.tryInitialize('afterNextRender');
      },
      { injector: this.injector }
    );

    this.scheduleRetry('afterViewInit');
  }

  ngOnChanges(changes: SimpleChanges): void {
    const blockChange = changes['block'];
    if (!blockChange || blockChange.firstChange || !this.isBrowser || this.isDestroyed) {
      return;
    }

    const previous = blockChange.previousValue as LeafletBlock | undefined;
    const current = blockChange.currentValue as LeafletBlock | undefined;
    if (!previous || !current) {
      return;
    }

    if (!this.map || !this.leafletRuntime) {
      this.scheduleRetry('block-updated-before-init');
      return;
    }

    if (this.requiresFullRebuild(previous, current)) {
      this.rebuildMap('block-update:structural-change');
      return;
    }

    this.reconcileMapContent(this.leafletRuntime, 'block-update', {
      resetView: this.requiresViewReset(previous, current),
    });
  }

  ngOnDestroy(): void {
    this.isDestroyed = true;
    this.teardownMapRuntime();

    this.logInfo('destroy-executed', {
      attempts: this.initAttemptCount,
    });
  }

  private get mapId(): string {
    return this.block?.id ?? 'unknown-map';
  }

  get containerWidth(): string {
    return this.block?.width?.trim() || '100%';
  }

  get containerHeight(): string | null {
    return this.block?.height?.trim() || null;
  }

  get containerAspectRatio(): string | null {
    if (this.containerHeight) {
      return null;
    }

    return this.isCompactTouchViewport() ? '5 / 4' : '16 / 9';
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
    if (!this.isBrowser || this.isDestroyed || this.map || this.initInProgress) {
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
    if (this.isDestroyed || this.map || this.initInProgress || this.pendingTimeoutId !== null) {
      return;
    }

    this.initAttemptCount++;
    this.pendingTimeoutId = setTimeout(() => {
      this.pendingTimeoutId = null;
      this.tryInitialize(`retry#${this.initAttemptCount} (${reason})`);
    }, 100);
  }

  private queueInvalidateSize(delayMs: number, context: string): void {
    if (!this.map || this.isDestroyed) {
      return;
    }

    if (this.resizeInvalidateTimeoutId !== null) {
      clearTimeout(this.resizeInvalidateTimeoutId);
      this.resizeInvalidateTimeoutId = null;
    }

    this.resizeInvalidateTimeoutId = setTimeout(() => {
      this.resizeInvalidateTimeoutId = null;

      if (!this.map || this.isDestroyed) {
        return;
      }

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
      if (!this.map || this.isDestroyed) {
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

  private setupGlobalResizeHandling(): void {
    if (!this.isBrowser || this.isDestroyed || globalThis.window === undefined) {
      return;
    }

    this.cleanupGlobalListeners();

    const register = (target: Window | Document, eventName: string, handler: () => void): void => {
      target.addEventListener(eventName, handler);
      this.globalCleanupFns.push(() => target.removeEventListener(eventName, handler));
    };

    register(globalThis.window, 'resize', () => this.queueInvalidateSize(0, 'window-resize'));
    register(globalThis.window, 'orientationchange', () =>
      this.queueInvalidateSize(80, 'orientation-change')
    );

    if (globalThis.document !== undefined) {
      register(globalThis.document, 'fullscreenchange', () =>
        this.queueInvalidateSize(50, 'fullscreen-change')
      );
      register(globalThis.document, 'visibilitychange', () => {
        if (globalThis.document.visibilityState === 'visible') {
          this.queueInvalidateSize(0, 'visibility-change');
        }
      });
    }
  }

  private async loadLeafletAndInitializeMap(trigger: string): Promise<void> {
    let L: unknown;
    let fullscreenControlCtor: LeafletFullscreenControlConstructor | undefined;

    try {
      const leafletModule = (await import('leaflet')) as LeafletRuntimeModuleWithDefault;
      L = leafletModule.default ?? (leafletModule as unknown as LeafletRuntime);
      const fullscreenModule = (await import('leaflet.fullscreen')) as {
        default?: LeafletFullscreenControlConstructor;
        FullScreen?: LeafletFullscreenControlConstructor;
      };
      fullscreenControlCtor = fullscreenModule.default ?? fullscreenModule.FullScreen;
    } catch (error) {
      this.logError('dynamic-import-failed', {
        category: 'import',
        trigger,
        error,
      });
      throw error;
    }

    const leaflet = L as LeafletRuntime;
    this.leafletRuntime = leaflet;
    if (leaflet.Icon?.Default) {
      leaflet.Icon.Default.mergeOptions(this.runtimeService.getMarkerIconUrls());
    }

    this.initializeMap(leaflet, trigger, fullscreenControlCtor);
  }

  private initializeMap(
    leaflet: LeafletRuntime,
    trigger: string,
    fullscreenControlCtor?: LeafletFullscreenControlConstructor
  ): void {
    const readiness = this.canInitializeNow();
    const container = readiness.container;
    if (!readiness.ok || !container) {
      throw new Error(`container is not ready during initializeMap: ${readiness.reason}`);
    }

    this.ngZone.runOutsideAngular(() => {
      this.initializeMapOutsideZone(leaflet, container, trigger, fullscreenControlCtor);
    });
  }

  private initializeMapOutsideZone(
    L: LeafletRuntime,
    container: HTMLElement,
    trigger: string,
    fullscreenControlCtor?: LeafletFullscreenControlConstructor
  ): void {
    const usesSimpleCrs = this.usesSimpleCrs(this.block);
    const compactTouchViewport = this.isCompactTouchViewport();
    const fallbackZoomWindow = this.getDefaultSimpleCrsZoomWindow(this.block);
    const mapOptions: LeafletMapOptions = {
      minZoom: this.block.minZoom ?? (usesSimpleCrs ? fallbackZoomWindow.minZoom : undefined),
      maxZoom: this.block.maxZoom ?? (usesSimpleCrs ? fallbackZoomWindow.maxZoom : undefined),
      zoomDelta: this.block.zoomDelta,
      zoomSnap: this.getZoomSnap(),
      zoomControl: true,
      attributionControl: this.shouldShowAttribution(this.block),
      scrollWheelZoom: !(this.block.noScrollZoom || this.block.lock),
      doubleClickZoom: !this.block.lock,
      boxZoom: !this.block.lock,
      keyboard: !this.block.lock,
      dragging: !this.block.lock,
      touchZoom: !this.block.lock,
      tap: compactTouchViewport ? false : undefined,
      zoomAnimation: true,
      fadeAnimation: true,
      markerZoomAnimation: true,
    };

    if (usesSimpleCrs) {
      mapOptions.crs = L.CRS.Simple;
      mapOptions.center = [0, 0];
      mapOptions.zoom = this.block.defaultZoom ?? 0;
    } else {
      mapOptions.center = [this.block.lat ?? 0, this.block.long ?? 0];
      mapOptions.zoom = this.block.defaultZoom ?? 13;
    }

    this.map = L.map(container, mapOptions);
    this.addFullscreenControl(fullscreenControlCtor);
    this.setupMapViewPersistence();
    this.setupFullscreenResizeSync();
    this.setupSimpleCrsInteractionOverrides(container);
    this.logInfo('leaflet-map-created', {
      category: 'timing',
      trigger,
      hasImageOverlays: (this.block.imageOverlays?.length ?? 0) > 0,
      center: mapOptions.center,
      zoom: mapOptions.zoom,
    });

    this.queueInvalidateSize(0, `post-init:${trigger}`);
    this.queueInvalidateSize(150, `post-init-second-pass:${trigger}`);
    this.setupResizeObserver(container);
    this.setupGlobalResizeHandling();
    this.reconcileMapContent(L, trigger, { resetView: true, preferPersistedView: true });
  }

  private reconcileMapContent(
    L: LeafletRuntime,
    context: string,
    opts?: { resetView?: boolean; preferPersistedView?: boolean }
  ): void {
    const container = this.mapContainer?.nativeElement;
    if (!this.map || !container) {
      return;
    }

    this.renderToken++;
    this.clearLayers();
    this.syncContainerClasses(container);

    if (this.shouldRenderTileLayer(this.block)) {
      this.addTileLayer(L);
    }

    if ((this.block.imageOverlays?.length ?? 0) > 0) {
      this.addImageOverlays(L, this.renderToken, {
        resetView: opts?.resetView ?? false,
        preferPersistedView: opts?.preferPersistedView ?? false,
      });
    } else if (opts?.resetView) {
      this.setBaseView(opts.preferPersistedView);
    }

    if ((this.block.markers?.length ?? 0) > 0) {
      this.addMarkers(L);
    }

    this.syncMarkersWithZoom();

    this.queueInvalidateSize(0, `reconcile:${context}`);
  }

  private addFullscreenControl(fullscreenControlCtor?: LeafletFullscreenControlConstructor): void {
    if (!this.map || !fullscreenControlCtor) {
      return;
    }

    try {
      new fullscreenControlCtor({ forceSeparateButton: true }).addTo(this.map);
    } catch (error) {
      this.logError('fullscreen-control-add-failed', {
        category: 'import',
        error,
      });
    }
  }

  private addTileLayer(L: LeafletRuntime): void {
    if (!this.map) {
      return;
    }

    const tileUrl =
      this.block.tileServer?.url ?? 'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png';

    this.tileLayer = L.tileLayer(tileUrl, {
      attribution: this.getTileAttribution(),
      subdomains: this.block.tileServer?.subdomains ?? ['a', 'b', 'c'],
      minZoom: this.block.tileServer?.minZoom,
      maxZoom: this.block.tileServer?.maxZoom,
    }).addTo(this.map);
  }

  private addImageOverlays(
    L: LeafletRuntime,
    renderToken: number,
    opts: { resetView: boolean; preferPersistedView: boolean }
  ): void {
    const overlays = this.block.imageOverlays ?? [];
    if (overlays.length === 0) {
      return;
    }

    let completed = 0;
    let unionBounds: [[number, number], [number, number]] | null = null;

    const finalizeOverlay = (bounds: [[number, number], [number, number]] | null): void => {
      if (this.isDestroyed || renderToken !== this.renderToken) {
        return;
      }

      completed++;
      if (bounds) {
        unionBounds = unionBounds ? this.extendBounds(unionBounds, bounds) : bounds;
      }

      if (completed === overlays.length && opts.resetView) {
        if (opts.preferPersistedView && this.restorePersistedView()) {
          return;
        }

        if (unionBounds) {
          this.scheduleFitBounds(unionBounds);
        } else {
          this.setBaseView(false);
        }
      }
    };

    overlays.forEach((overlay) => {
      const imageUrl = this.runtimeService.buildOverlayAssetUrl(overlay.path);
      const explicitBounds = this.getOverlayBoundsFromBlock(overlay);

      if (explicitBounds) {
        this.addOverlayLayer(L, imageUrl, explicitBounds);
        finalizeOverlay(explicitBounds);
        return;
      }

      const img = new Image();
      img.onload = () => {
        if (this.isDestroyed || renderToken !== this.renderToken) {
          return;
        }

        const bounds = this.deriveImageOverlayBounds(img.naturalWidth, img.naturalHeight);
        this.addOverlayLayer(L, imageUrl, bounds);
        finalizeOverlay(bounds);
      };
      img.onerror = () => {
        if (this.isDestroyed || renderToken !== this.renderToken) {
          return;
        }

        this.logError('image-overlay-load-failed', {
          category: 'data',
          imageUrl,
        });
        finalizeOverlay(null);
      };

      img.src = imageUrl;
    });
  }

  private addOverlayLayer(
    L: LeafletRuntime,
    imageUrl: string,
    bounds: [[number, number], [number, number]]
  ): void {
    if (!this.map) {
      return;
    }

    try {
      const overlayLayer = L.imageOverlay(imageUrl, bounds, {
        interactive: false,
        className: 'leaflet-image-overlay-no-animation',
      }).addTo(this.map);
      this.overlayLayers.push(overlayLayer);
    } catch (error) {
      this.logError('image-overlay-add-failed', {
        category: 'data',
        imageUrl,
        error,
      });
    }
  }

  private addMarkers(L: LeafletRuntime): void {
    const map = this.map;
    if (!map) {
      return;
    }

    let addedCount = 0;
    let skippedByZoom = 0;

    this.block.markers?.forEach((marker) => {
      if (marker.minZoom && map.getZoom() < marker.minZoom) {
        skippedByZoom++;
        return;
      }
      if (marker.maxZoom && map.getZoom() > marker.maxZoom) {
        skippedByZoom++;
        return;
      }

      const leafletMarker = L.marker([marker.lat, marker.long]).addTo(map);
      this.markerLayers.push(leafletMarker);

      let popupContent = '';
      if (marker.description) {
        popupContent = this.escapeHtml(marker.description);
      }
      if (marker.link) {
        const resolvedLink = this.runtimeService.resolveMarkerLink(marker.link);
        if (resolvedLink) {
          const text = this.escapeHtml(resolvedLink.text);
          const linkHtml = resolvedLink.unresolved
            ? `<span class="wikilink wikilink-unresolved" title="${this.escapeHtml(
                resolvedLink.unresolvedReason ?? UNAVAILABLE_INTERNAL_PAGE_MESSAGE
              )}">${text}</span>`
            : `<a href="${this.escapeHtml(resolvedLink.href)}"${
                resolvedLink.external ? ' target="_blank" rel="noopener"' : ''
              }>${text}</a>`;
          popupContent = popupContent ? `${popupContent}<br>${linkHtml}` : linkHtml;
        }
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

  private syncMarkersWithZoom(): void {
    this.markerZoomSyncCleanup?.();
    this.markerZoomSyncCleanup = null;

    if (!this.map || !this.leafletRuntime || !this.hasZoomConstrainedMarkers()) {
      return;
    }

    const handler = () => {
      if (this.isDestroyed || !this.leafletRuntime) {
        return;
      }

      this.refreshMarkers(this.leafletRuntime);
    };

    this.map.on('zoomend', handler);
    this.markerZoomSyncCleanup = () => {
      this.map?.off('zoomend', handler);
    };
  }

  private refreshMarkers(L: LeafletRuntime): void {
    if (!this.map) {
      return;
    }

    this.clearMarkerLayers();
    if ((this.block.markers?.length ?? 0) > 0) {
      this.addMarkers(L);
    }
  }

  private hasZoomConstrainedMarkers(): boolean {
    return (
      this.block.markers?.some(
        (marker) => marker.minZoom !== undefined || marker.maxZoom !== undefined
      ) ?? false
    );
  }

  private fitBoundsWithoutAnimation(finalBounds: [[number, number], [number, number]]): void {
    if (!this.map) {
      return;
    }

    this.map.fitBounds(finalBounds, {
      padding: [20, 20],
      animate: false,
      duration: 0,
    });

    this.queueInvalidateSize(30, 'post-fitBounds');
  }

  private setBaseView(preferPersistedView = false): void {
    if (!this.map) {
      return;
    }

    if (preferPersistedView && this.restorePersistedView()) {
      return;
    }

    const center = this.usesSimpleCrs(this.block)
      ? ([0, 0] as [number, number])
      : ([this.block.lat ?? 0, this.block.long ?? 0] as [number, number]);
    const zoom = this.usesSimpleCrs(this.block)
      ? (this.block.defaultZoom ?? 0)
      : (this.block.defaultZoom ?? 13);

    this.map.setView(center, zoom, { animate: false });
  }

  private scheduleFitBounds(finalBounds: [[number, number], [number, number]]): void {
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

  private requiresFullRebuild(previous: LeafletBlock, current: LeafletBlock): boolean {
    return this.getRebuildSignature(previous) !== this.getRebuildSignature(current);
  }

  private requiresViewReset(previous: LeafletBlock, current: LeafletBlock): boolean {
    if (this.usesSimpleCrs(current)) {
      return this.getImageViewSignature(previous) !== this.getImageViewSignature(current);
    }

    return previous.lat !== current.lat || previous.long !== current.long;
  }

  private getRebuildSignature(block: LeafletBlock): string {
    return JSON.stringify({
      simpleCrs: this.usesSimpleCrs(block),
      minZoom: block.minZoom ?? null,
      maxZoom: block.maxZoom ?? null,
      defaultZoom: block.defaultZoom ?? null,
      zoomDelta: block.zoomDelta ?? null,
      noScrollZoom: block.noScrollZoom ?? null,
      lock: block.lock ?? null,
      tileServer: block.tileServer
        ? {
            url: block.tileServer.url,
            attribution: block.tileServer.attribution ?? null,
            minZoom: block.tileServer.minZoom ?? null,
            maxZoom: block.tileServer.maxZoom ?? null,
            subdomains: block.tileServer.subdomains ?? null,
          }
        : null,
    });
  }

  private rebuildMap(reason: string): void {
    if (!this.leafletRuntime) {
      this.teardownMapRuntime();
      this.scheduleRetry(`${reason}:runtime-not-ready`);
      return;
    }

    this.teardownMapRuntime({ preserveLeafletRuntime: true, preserveRetryState: true });
    this.tryInitialize(reason);
  }

  private teardownMapRuntime(opts?: {
    preserveLeafletRuntime?: boolean;
    preserveRetryState?: boolean;
  }): void {
    this.renderToken++;
    this.clearPendingTimers();
    this.clearLayers();
    this.mapViewSyncCleanup?.();
    this.mapViewSyncCleanup = null;
    this.cleanupGlobalListeners();
    this.cleanupSimpleCrsInteractionOverrides();

    if (this.resizeObserver) {
      this.resizeObserver.disconnect();
      this.resizeObserver = null;
    }

    if (this.map) {
      this.map.remove();
      this.map = null;
    }

    this.initInProgress = false;
    this.hasLoggedUnmeasurableContainer = false;

    if (!opts?.preserveLeafletRuntime) {
      this.leafletRuntime = null;
    }

    if (!opts?.preserveRetryState) {
      this.initAttemptCount = 0;
    }
  }

  private clearPendingTimers(): void {
    if (this.pendingTimeoutId !== null) {
      clearTimeout(this.pendingTimeoutId);
      this.pendingTimeoutId = null;
    }

    if (this.resizeInvalidateTimeoutId !== null) {
      clearTimeout(this.resizeInvalidateTimeoutId);
      this.resizeInvalidateTimeoutId = null;
    }

    if (this.fitBoundsTimeoutId !== null) {
      clearTimeout(this.fitBoundsTimeoutId);
      this.fitBoundsTimeoutId = null;
    }
  }

  private clearLayers(): void {
    this.markerZoomSyncCleanup?.();
    this.markerZoomSyncCleanup = null;

    if (this.map) {
      if (this.tileLayer) {
        this.map.removeLayer(this.tileLayer);
      }

      this.clearMarkerLayers();
      this.overlayLayers.forEach((layer) => this.map?.removeLayer(layer));
    }

    this.tileLayer = null;
    this.overlayLayers = [];
  }

  private clearMarkerLayers(): void {
    if (this.map) {
      this.markerLayers.forEach((layer) => this.map?.removeLayer(layer));
    }

    this.markerLayers = [];
  }

  private cleanupGlobalListeners(): void {
    while (this.globalCleanupFns.length > 0) {
      const cleanup = this.globalCleanupFns.pop();
      cleanup?.();
    }
  }

  private cleanupSimpleCrsInteractionOverrides(): void {
    while (this.simpleCrsInteractionCleanupFns.length > 0) {
      const cleanup = this.simpleCrsInteractionCleanupFns.pop();
      cleanup?.();
    }
  }

  private shouldRenderTileLayer(block: LeafletBlock): boolean {
    return !this.usesSimpleCrs(block) || Boolean(block.tileServer);
  }

  private shouldShowAttribution(block: LeafletBlock): boolean {
    if (!this.shouldRenderTileLayer(block)) {
      return false;
    }

    return !block.tileServer || Boolean(block.tileServer.attribution);
  }

  private getTileAttribution(): string | undefined {
    if (!this.shouldShowAttribution(this.block)) {
      return undefined;
    }

    return (
      this.block.tileServer?.attribution ??
      '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
    );
  }

  private usesSimpleCrs(block: LeafletBlock): boolean {
    return (block.imageOverlays?.length ?? 0) > 0 && !block.tileServer;
  }

  private getDefaultSimpleCrsZoomWindow(block: LeafletBlock): { minZoom: number; maxZoom: number } {
    const baseZoom = block.defaultZoom ?? 0;
    return {
      minZoom: Math.min(block.minZoom ?? Number.POSITIVE_INFINITY, baseZoom - 4, -2),
      maxZoom: Math.max(block.maxZoom ?? Number.NEGATIVE_INFINITY, baseZoom + 4, 8),
    };
  }

  private getEffectiveMinZoom(block: LeafletBlock): number | undefined {
    if (block.minZoom !== undefined) {
      return block.minZoom;
    }

    return this.usesSimpleCrs(block)
      ? this.getDefaultSimpleCrsZoomWindow(block).minZoom
      : undefined;
  }

  private getEffectiveMaxZoom(block: LeafletBlock): number | undefined {
    if (block.maxZoom !== undefined) {
      return block.maxZoom;
    }

    return this.usesSimpleCrs(block)
      ? this.getDefaultSimpleCrsZoomWindow(block).maxZoom
      : undefined;
  }

  private getZoomStep(): number {
    const zoomDelta = this.block.zoomDelta;
    return zoomDelta !== undefined && Number.isFinite(zoomDelta) && zoomDelta > 0 ? zoomDelta : 1;
  }

  private getZoomSnap(): number | undefined {
    const zoomDelta = this.block.zoomDelta;
    if (zoomDelta === undefined || !Number.isFinite(zoomDelta) || zoomDelta <= 0) {
      return undefined;
    }

    return zoomDelta < 1 ? zoomDelta : 1;
  }

  private isCompactTouchViewport(): boolean {
    if (
      !this.isBrowser ||
      globalThis.window === undefined ||
      typeof globalThis.window.matchMedia !== 'function'
    ) {
      return false;
    }

    return globalThis.window.matchMedia('(max-width: 768px), (pointer: coarse)').matches;
  }

  private setupSimpleCrsInteractionOverrides(container: HTMLElement): void {
    this.cleanupSimpleCrsInteractionOverrides();

    if (!this.map || !this.usesSimpleCrs(this.block)) {
      return;
    }

    const register = <K extends keyof HTMLElementEventMap>(
      target: HTMLElement,
      eventName: K,
      handler: (event: HTMLElementEventMap[K]) => void,
      options?: AddEventListenerOptions
    ): void => {
      target.addEventListener(eventName, handler as EventListener, options);
      this.simpleCrsInteractionCleanupFns.push(() =>
        target.removeEventListener(eventName, handler as EventListener, options)
      );
    };

    const bindZoomControl = (
      selector: 'a.leaflet-control-zoom-in' | 'a.leaflet-control-zoom-out',
      direction: 1 | -1
    ): void => {
      const control = container.querySelector<HTMLElement>(selector);
      if (!control) {
        return;
      }

      register(
        control,
        'click',
        (event) => {
          event.preventDefault();
          event.stopPropagation();
          event.stopImmediatePropagation();
          this.applySimpleCrsZoomStep(direction);
        },
        { capture: true }
      );
    };

    bindZoomControl('a.leaflet-control-zoom-in', 1);
    bindZoomControl('a.leaflet-control-zoom-out', -1);

    if (this.block.noScrollZoom || this.block.lock) {
      return;
    }

    register(
      container,
      'wheel',
      (event) => {
        if (Math.abs(event.deltaY) < 4) {
          return;
        }

        const now = Date.now();
        if (now - this.lastSimpleCrsWheelZoomAt < 80) {
          event.preventDefault();
          event.stopPropagation();
          event.stopImmediatePropagation();
          return;
        }

        this.lastSimpleCrsWheelZoomAt = now;
        event.preventDefault();
        event.stopPropagation();
        event.stopImmediatePropagation();
        this.applySimpleCrsZoomStep(event.deltaY < 0 ? 1 : -1);
      },
      { capture: true, passive: false }
    );
  }

  private applySimpleCrsZoomStep(direction: 1 | -1): void {
    if (!this.map) {
      return;
    }

    const currentZoom = this.map.getZoom();
    const step = this.getZoomStep();
    const minZoom = this.getEffectiveMinZoom(this.block);
    const maxZoom = this.getEffectiveMaxZoom(this.block);
    const unclampedZoom = currentZoom + direction * step;
    const nextZoom = Math.max(
      minZoom ?? Number.NEGATIVE_INFINITY,
      Math.min(maxZoom ?? Number.POSITIVE_INFINITY, unclampedZoom)
    );

    if (nextZoom === currentZoom) {
      return;
    }

    const center = this.map.getCenter();
    this.map.setView([center.lat, center.lng], nextZoom, { animate: false });
    this.queueInvalidateSize(0, 'simple-crs-zoom-step');
  }

  private syncContainerClasses(container: HTMLElement): void {
    container.classList.toggle('has-image-overlay', (this.block.imageOverlays?.length ?? 0) > 0);
    container.classList.toggle('leaflet-dark-mode', Boolean(this.block.darkMode));
  }

  private getOverlayBoundsFromBlock(
    overlay: LeafletImageOverlay
  ): [[number, number], [number, number]] | null {
    const [topLat, topLng] = overlay.topLeft;
    const [bottomLat, bottomLng] = overlay.bottomRight;
    if (topLat === 0 && topLng === 0 && bottomLat === 0 && bottomLng === 0) {
      return null;
    }

    return this.normalizeBounds([overlay.topLeft, overlay.bottomRight]);
  }

  private normalizeBounds(
    bounds: [[number, number], [number, number]]
  ): [[number, number], [number, number]] {
    const [[latA, lngA], [latB, lngB]] = bounds;
    return [
      [Math.min(latA, latB), Math.min(lngA, lngB)],
      [Math.max(latA, latB), Math.max(lngA, lngB)],
    ];
  }

  private extendBounds(
    current: [[number, number], [number, number]],
    next: [[number, number], [number, number]]
  ): [[number, number], [number, number]] {
    return [
      [Math.min(current[0][0], next[0][0]), Math.min(current[0][1], next[0][1])],
      [Math.max(current[1][0], next[1][0]), Math.max(current[1][1], next[1][1])],
    ];
  }

  private deriveImageOverlayBounds(
    naturalWidth: number,
    naturalHeight: number
  ): [[number, number], [number, number]] {
    if (
      this.block.scale &&
      Number.isFinite(this.block.scale) &&
      naturalWidth > 0 &&
      naturalHeight > 0
    ) {
      const widthUnits = this.block.scale;
      const heightUnits = (widthUnits * naturalHeight) / naturalWidth;
      const halfWidth = widthUnits / 2;
      const halfHeight = heightUnits / 2;
      return this.normalizeBounds([
        [halfHeight, -halfWidth],
        [-halfHeight, halfWidth],
      ]);
    }

    return this.normalizeBounds([
      [0, 0],
      [naturalHeight, naturalWidth],
    ]);
  }

  private restorePersistedView(): boolean {
    if (!this.map) {
      return false;
    }

    const state = this.runtimeService.getPersistedViewState(this.mapId, {
      simpleCrs: this.usesSimpleCrs(this.block),
    });
    if (!state) {
      return false;
    }

    this.map.setView(state.center, state.zoom, { animate: false });
    return true;
  }

  private setupMapViewPersistence(): void {
    this.mapViewSyncCleanup?.();
    this.mapViewSyncCleanup = null;

    if (!this.map) {
      return;
    }

    const persist = () => {
      if (!this.map || this.isDestroyed) {
        return;
      }

      const center = this.map.getCenter();
      this.runtimeService.persistViewState(this.mapId, {
        center: [center.lat, center.lng],
        zoom: this.map.getZoom(),
        simpleCrs: this.usesSimpleCrs(this.block),
      });
    };

    this.map.on('moveend', persist);
    this.map.on('zoomend', persist);
    this.mapViewSyncCleanup = () => {
      this.map?.off('moveend', persist);
      this.map?.off('zoomend', persist);
    };
  }

  private setupFullscreenResizeSync(): void {
    if (!this.map) {
      return;
    }

    const schedule = () => this.queueInvalidateSize(0, 'leaflet-fullscreen');
    this.map.on('enterFullscreen', schedule);
    this.map.on('exitFullscreen', schedule);

    const previousCleanup = this.mapViewSyncCleanup;
    this.mapViewSyncCleanup = () => {
      previousCleanup?.();
      this.map?.off('enterFullscreen', schedule);
      this.map?.off('exitFullscreen', schedule);
    };
  }

  private getImageViewSignature(block: LeafletBlock): string {
    return JSON.stringify({
      scale: block.scale ?? null,
      overlays:
        block.imageOverlays?.map((overlay) => ({
          path: overlay.path,
          topLeft: overlay.topLeft,
          bottomRight: overlay.bottomRight,
        })) ?? [],
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
