import { isPlatformBrowser } from '@angular/common';
import {
  ComponentRef,
  createComponent,
  EnvironmentInjector,
  inject,
  Injectable,
  PLATFORM_ID,
  runInInjectionContext,
} from '@angular/core';
import type { LeafletBlock } from '@core-domain/entities/leaflet-block';

import { LeafletMapComponent } from '../components/leaflet-map/leaflet-map.component';

// ---------------------------------------------------------------------------
// Public types
// ---------------------------------------------------------------------------

export interface LeafletInjectionStats {
  found: number;
  created: number;
  updated: number;
  active: number;
  ignored: Record<string, number>;
}

export interface LeafletBlockResolution {
  ok: true;
  block: LeafletBlock;
  mapId: string;
}

export interface LeafletBlockResolutionFailure {
  ok: false;
  reason: string;
}

export type BlockResolver = (
  placeholder: HTMLElement
) => LeafletBlockResolution | LeafletBlockResolutionFailure;

export interface LeafletLogSink {
  info(event: string, data?: Record<string, unknown>): void;
  warn(event: string, data?: Record<string, unknown>): void;
  error(event: string, data?: Record<string, unknown>): void;
}

// ---------------------------------------------------------------------------
// Service
// ---------------------------------------------------------------------------

@Injectable({ providedIn: 'root' })
export class LeafletInjectionService {
  private readonly platformId = inject(PLATFORM_ID);
  private readonly isBrowser = isPlatformBrowser(this.platformId);

  // -----------------------------------------------------------------------
  // Placeholder discovery
  // -----------------------------------------------------------------------

  findPlaceholders(container: HTMLElement, selector: string): HTMLElement[] {
    return Array.from(container.querySelectorAll<HTMLElement>(selector));
  }

  // -----------------------------------------------------------------------
  // Anti-double injection guard
  // -----------------------------------------------------------------------

  getSkipReason(
    placeholder: HTMLElement,
    refs: Map<HTMLElement, ComponentRef<LeafletMapComponent>>
  ): string | null {
    if (refs.has(placeholder)) {
      return 'already-injected';
    }
    if (placeholder.dataset['leafletInjected'] === 'true') {
      return 'dataset-already-injected';
    }
    if (placeholder.querySelector('app-leaflet-map')) {
      return 'dom-already-has-leaflet-component';
    }
    return null;
  }

  // -----------------------------------------------------------------------
  // Component creation
  // -----------------------------------------------------------------------

  createLeafletComponent(
    placeholder: HTMLElement,
    block: LeafletBlock,
    environmentInjector: EnvironmentInjector,
    refs: Map<HTMLElement, ComponentRef<LeafletMapComponent>>
  ): ComponentRef<LeafletMapComponent> {
    // Use runInInjectionContext to ensure inject() calls in the component work correctly
    return runInInjectionContext(environmentInjector, () => {
      const componentRef = createComponent(LeafletMapComponent, {
        environmentInjector,
        hostElement: placeholder,
      });
      componentRef.setInput('block', block);
      componentRef.changeDetectorRef.detectChanges();
      refs.set(placeholder, componentRef);
      placeholder.dataset['leafletInjected'] = 'true';
      return componentRef;
    });
  }

  updateLeafletComponent(
    placeholder: HTMLElement,
    block: LeafletBlock,
    refs: Map<HTMLElement, ComponentRef<LeafletMapComponent>>
  ): boolean {
    const componentRef = refs.get(placeholder);
    if (!componentRef) {
      return false;
    }

    componentRef.setInput('block', block);
    componentRef.changeDetectorRef.detectChanges();
    return true;
  }

  // -----------------------------------------------------------------------
  // Stale reference cleanup
  // -----------------------------------------------------------------------

  cleanupDetached(
    currentPlaceholders: HTMLElement[],
    refs: Map<HTMLElement, ComponentRef<LeafletMapComponent>>,
    log: LeafletLogSink
  ): void {
    const activeSet = new Set(currentPlaceholders);
    for (const [placeholder, componentRef] of refs.entries()) {
      if (!activeSet.has(placeholder) || !placeholder.isConnected) {
        const mapId = placeholder.dataset['leafletMapId'] ?? 'unknown-map';
        componentRef.destroy();
        refs.delete(placeholder);
        if (placeholder.dataset['leafletInjected'] === 'true') {
          delete placeholder.dataset['leafletInjected'];
        }
        log.info('destroy-executed', { mapId, reason: 'stale-placeholder' });
      }
    }
  }

  // -----------------------------------------------------------------------
  // Destroy all
  // -----------------------------------------------------------------------

  destroyAll(refs: Map<HTMLElement, ComponentRef<LeafletMapComponent>>, log: LeafletLogSink): void {
    for (const [placeholder, componentRef] of refs.entries()) {
      const mapId = placeholder.dataset['leafletMapId'] ?? 'unknown-map';
      componentRef.destroy();
      if (placeholder.dataset['leafletInjected'] === 'true') {
        delete placeholder.dataset['leafletInjected'];
      }
      log.info('destroy-executed', { mapId, reason: 'component-cleanup' });
    }
    refs.clear();
  }

  // -----------------------------------------------------------------------
  // Full injection pass
  // -----------------------------------------------------------------------

  runInjectionPass(opts: {
    placeholders: HTMLElement[];
    resolveBlock: BlockResolver;
    environmentInjector: EnvironmentInjector;
    refs: Map<HTMLElement, ComponentRef<LeafletMapComponent>>;
    log: LeafletLogSink;
  }): LeafletInjectionStats {
    const { placeholders, resolveBlock, environmentInjector, refs, log } = opts;

    this.cleanupDetached(placeholders, refs, log);

    const stats: LeafletInjectionStats = {
      found: placeholders.length,
      created: 0,
      updated: 0,
      active: refs.size,
      ignored: {},
    };

    for (const placeholder of placeholders) {
      const mapId = placeholder.dataset['leafletMapId'] ?? 'unknown-map';
      log.info('placeholder-found', { mapId });

      const resolution = resolveBlock(placeholder);

      if (refs.has(placeholder)) {
        if (!resolution.ok) {
          incrementReason(stats.ignored, resolution.reason);
          continue;
        }

        this.updateLeafletComponent(placeholder, resolution.block, refs);
        stats.updated++;
        log.info('component-updated', { mapId: resolution.mapId, category: 'timing' });
        continue;
      }

      const skipReason = this.getSkipReason(placeholder, refs);
      if (skipReason) {
        incrementReason(stats.ignored, skipReason);
        continue;
      }

      if (!resolution.ok) {
        incrementReason(stats.ignored, resolution.reason);
        continue;
      }

      try {
        this.createLeafletComponent(placeholder, resolution.block, environmentInjector, refs);
        stats.created++;
        log.info('component-injected', { mapId: resolution.mapId, category: 'timing' });
      } catch (error) {
        incrementReason(stats.ignored, 'component-creation-failed');
        log.error('component-injection-failed', {
          category: 'timing',
          mapId: resolution.mapId,
          error,
        });
      }
    }

    stats.active = refs.size;
    log.info('injection-pass', { ...stats });
    return stats;
  }

  // -----------------------------------------------------------------------
  // SSR guard
  // -----------------------------------------------------------------------

  get canRun(): boolean {
    return this.isBrowser;
  }
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function incrementReason(target: Record<string, number>, reason: string): void {
  target[reason] = (target[reason] ?? 0) + 1;
}
