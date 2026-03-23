import { ComponentRef, PLATFORM_ID } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import type { LeafletBlock } from '@core-domain';

import { LeafletMapComponent } from '../presentation/components/leaflet-map/leaflet-map.component';
import type {
  BlockResolver,
  LeafletInjectionStats,
  LeafletLogSink,
} from '../presentation/services/leaflet-injection.service';
import { LeafletInjectionService } from '../presentation/services/leaflet-injection.service';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function createLogSink(): LeafletLogSink & { calls: Array<{ fn: string; event: string }> } {
  const calls: Array<{ fn: string; event: string }> = [];
  return {
    calls,
    info: jest.fn((event: string) => calls.push({ fn: 'info', event })),
    warn: jest.fn((event: string) => calls.push({ fn: 'warn', event })),
    error: jest.fn((event: string) => calls.push({ fn: 'error', event })),
  };
}

function makePlaceholder(mapId: string, connected = true): HTMLElement {
  const el = document.createElement('div');
  el.classList.add('leaflet-map-placeholder');
  el.dataset['leafletMapId'] = mapId;
  // Attach to document so isConnected === true by default
  if (connected) {
    document.body.appendChild(el);
  }
  return el;
}

function makeFakeComponentRef(overrides?: Partial<ComponentRef<LeafletMapComponent>>) {
  return {
    destroy: jest.fn(),
    setInput: jest.fn(),
    changeDetectorRef: { detectChanges: jest.fn() },
    ...overrides,
  } as unknown as ComponentRef<LeafletMapComponent>;
}

const BLOCK_A: LeafletBlock = { id: 'map-a', lat: 48, long: 2 };
const BLOCK_B: LeafletBlock = { id: 'map-b', lat: 51, long: -0.1 };

// ---------------------------------------------------------------------------
// Service under test — instantiated without Angular DI.
// We test the pure-logic methods (findPlaceholders, getSkipReason,
// cleanupDetached, destroyAll, runInjectionPass).
// We do NOT test createLeafletComponent because it delegates to
// Angular's createComponent — that would be testing the framework.
// ---------------------------------------------------------------------------

describe('LeafletInjectionService', () => {
  let service: LeafletInjectionService;
  let log: ReturnType<typeof createLogSink>;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [LeafletInjectionService, { provide: PLATFORM_ID, useValue: 'browser' }],
    });
    service = TestBed.inject(LeafletInjectionService);
    log = createLogSink();
  });

  afterEach(() => {
    // Cleanup any elements appended to document.body
    document.body.innerHTML = '';
  });

  // =========================================================================
  // findPlaceholders
  // =========================================================================

  describe('findPlaceholders', () => {
    it('should return matching elements for the given selector', () => {
      const container = document.createElement('div');
      const p1 = document.createElement('div');
      p1.dataset['leafletMapId'] = 'a';
      const p2 = document.createElement('div');
      p2.dataset['leafletMapId'] = 'b';
      const unrelated = document.createElement('p');
      container.append(p1, unrelated, p2);

      const result = service.findPlaceholders(container, '[data-leaflet-map-id]');

      expect(result).toHaveLength(2);
      expect(result).toContain(p1);
      expect(result).toContain(p2);
    });

    it('should return an empty array when no elements match', () => {
      const container = document.createElement('div');
      container.innerHTML = '<p>No maps here</p>';

      expect(service.findPlaceholders(container, '[data-leaflet-map-id]')).toHaveLength(0);
    });
  });

  // =========================================================================
  // getSkipReason
  // =========================================================================

  describe('getSkipReason', () => {
    it('should return null for a fresh placeholder', () => {
      const ph = makePlaceholder('fresh');
      const refs = new Map<HTMLElement, ComponentRef<LeafletMapComponent>>();

      expect(service.getSkipReason(ph, refs)).toBeNull();
    });

    it('should return "already-injected" when placeholder exists in refs map', () => {
      const ph = makePlaceholder('dup');
      const refs = new Map<HTMLElement, ComponentRef<LeafletMapComponent>>();
      refs.set(ph, makeFakeComponentRef());

      expect(service.getSkipReason(ph, refs)).toBe('already-injected');
    });

    it('should return "dataset-already-injected" when dataset flag is set', () => {
      const ph = makePlaceholder('flagged');
      ph.dataset['leafletInjected'] = 'true';
      const refs = new Map<HTMLElement, ComponentRef<LeafletMapComponent>>();

      expect(service.getSkipReason(ph, refs)).toBe('dataset-already-injected');
    });

    it('should return "dom-already-has-leaflet-component" when child component exists', () => {
      const ph = makePlaceholder('with-child');
      const child = document.createElement('app-leaflet-map');
      ph.appendChild(child);
      const refs = new Map<HTMLElement, ComponentRef<LeafletMapComponent>>();

      expect(service.getSkipReason(ph, refs)).toBe('dom-already-has-leaflet-component');
    });

    it('should check refs map first (priority order)', () => {
      const ph = makePlaceholder('prio');
      ph.dataset['leafletInjected'] = 'true';
      const child = document.createElement('app-leaflet-map');
      ph.appendChild(child);
      const refs = new Map<HTMLElement, ComponentRef<LeafletMapComponent>>();
      refs.set(ph, makeFakeComponentRef());

      // refs map check comes first
      expect(service.getSkipReason(ph, refs)).toBe('already-injected');
    });
  });

  // =========================================================================
  // cleanupDetached
  // =========================================================================

  describe('cleanupDetached', () => {
    it('should destroy refs whose placeholder is no longer in currentPlaceholders', () => {
      const phStale = makePlaceholder('stale');
      phStale.dataset['leafletInjected'] = 'true';
      const phActive = makePlaceholder('active');

      const staleRef = makeFakeComponentRef();
      const activeRef = makeFakeComponentRef();
      const refs = new Map<HTMLElement, ComponentRef<LeafletMapComponent>>();
      refs.set(phStale, staleRef);
      refs.set(phActive, activeRef);

      // Only phActive is in the current set
      service.cleanupDetached([phActive], refs, log);

      expect(staleRef.destroy).toHaveBeenCalledTimes(1);
      expect(activeRef.destroy).not.toHaveBeenCalled();
      expect(refs.has(phStale)).toBe(false);
      expect(refs.has(phActive)).toBe(true);
    });

    it('should destroy refs whose placeholder is disconnected from DOM', () => {
      // Create a placeholder that is NOT attached to the document
      const phDetached = document.createElement('div');
      phDetached.dataset['leafletMapId'] = 'detached';
      phDetached.dataset['leafletInjected'] = 'true';
      // phDetached.isConnected === false

      const ref = makeFakeComponentRef();
      const refs = new Map<HTMLElement, ComponentRef<LeafletMapComponent>>();
      refs.set(phDetached, ref);

      // Pass it as a current placeholder — but it's disconnected
      service.cleanupDetached([phDetached], refs, log);

      expect(ref.destroy).toHaveBeenCalledTimes(1);
      expect(refs.size).toBe(0);
    });

    it('should clear leafletInjected dataset on destroyed placeholders', () => {
      const ph = makePlaceholder('cleanup-ds');
      ph.dataset['leafletInjected'] = 'true';
      const refs = new Map<HTMLElement, ComponentRef<LeafletMapComponent>>();
      refs.set(ph, makeFakeComponentRef());

      service.cleanupDetached([], refs, log);

      expect(ph.dataset['leafletInjected']).toBeUndefined();
    });

    it('should log destruction with mapId', () => {
      const ph = makePlaceholder('logged');
      const refs = new Map<HTMLElement, ComponentRef<LeafletMapComponent>>();
      refs.set(ph, makeFakeComponentRef());

      service.cleanupDetached([], refs, log);

      expect(log.info).toHaveBeenCalledWith(
        'destroy-executed',
        expect.objectContaining({ mapId: 'logged', reason: 'stale-placeholder' })
      );
    });

    it('should not destroy anything when all refs are still active and connected', () => {
      const ph1 = makePlaceholder('ok-1');
      const ph2 = makePlaceholder('ok-2');
      const ref1 = makeFakeComponentRef();
      const ref2 = makeFakeComponentRef();
      const refs = new Map<HTMLElement, ComponentRef<LeafletMapComponent>>();
      refs.set(ph1, ref1);
      refs.set(ph2, ref2);

      service.cleanupDetached([ph1, ph2], refs, log);

      expect(ref1.destroy).not.toHaveBeenCalled();
      expect(ref2.destroy).not.toHaveBeenCalled();
      expect(refs.size).toBe(2);
    });
  });

  // =========================================================================
  // destroyAll
  // =========================================================================

  describe('destroyAll', () => {
    it('should destroy every ComponentRef and clear the map', () => {
      const ph1 = makePlaceholder('d1');
      ph1.dataset['leafletInjected'] = 'true';
      const ph2 = makePlaceholder('d2');
      ph2.dataset['leafletInjected'] = 'true';

      const ref1 = makeFakeComponentRef();
      const ref2 = makeFakeComponentRef();
      const refs = new Map<HTMLElement, ComponentRef<LeafletMapComponent>>();
      refs.set(ph1, ref1);
      refs.set(ph2, ref2);

      service.destroyAll(refs, log);

      expect(ref1.destroy).toHaveBeenCalledTimes(1);
      expect(ref2.destroy).toHaveBeenCalledTimes(1);
      expect(refs.size).toBe(0);
    });

    it('should clear leafletInjected dataset on all placeholders', () => {
      const ph = makePlaceholder('ds-clear');
      ph.dataset['leafletInjected'] = 'true';
      const refs = new Map<HTMLElement, ComponentRef<LeafletMapComponent>>();
      refs.set(ph, makeFakeComponentRef());

      service.destroyAll(refs, log);

      expect(ph.dataset['leafletInjected']).toBeUndefined();
    });

    it('should log each destruction with correct mapId', () => {
      const ph1 = makePlaceholder('x');
      const ph2 = makePlaceholder('y');
      const refs = new Map<HTMLElement, ComponentRef<LeafletMapComponent>>();
      refs.set(ph1, makeFakeComponentRef());
      refs.set(ph2, makeFakeComponentRef());

      service.destroyAll(refs, log);

      expect(log.info).toHaveBeenCalledWith(
        'destroy-executed',
        expect.objectContaining({ mapId: 'x', reason: 'component-cleanup' })
      );
      expect(log.info).toHaveBeenCalledWith(
        'destroy-executed',
        expect.objectContaining({ mapId: 'y', reason: 'component-cleanup' })
      );
    });

    it('should handle empty refs map without error', () => {
      const refs = new Map<HTMLElement, ComponentRef<LeafletMapComponent>>();
      expect(() => service.destroyAll(refs, log)).not.toThrow();
      expect(refs.size).toBe(0);
    });
  });

  // =========================================================================
  // runInjectionPass — integration of the above primitives
  // =========================================================================

  describe('runInjectionPass', () => {
    // Spy on createLeafletComponent to avoid actually calling Angular's
    // createComponent — we already trust the framework. We verify that
    // the orchestration logic calls it with the right arguments.
    let createSpy: jest.SpyInstance;

    beforeEach(() => {
      createSpy = jest
        .spyOn(service, 'createLeafletComponent')
        .mockImplementation((placeholder, _block, _injector, refs) => {
          const fakeRef = makeFakeComponentRef();
          refs.set(placeholder, fakeRef);
          placeholder.dataset['leafletInjected'] = 'true';
          return fakeRef;
        });
    });

    afterEach(() => {
      createSpy.mockRestore();
    });

    const fakeInjector = {} as any;

    function makeResolver(...blocks: LeafletBlock[]): BlockResolver {
      const byId = new Map(blocks.map((b) => [b.id, b]));
      return (ph) => {
        const mapId = ph.dataset['leafletMapId'] ?? '';
        const block = byId.get(mapId);
        if (!block) return { ok: false, reason: `missing-block:${mapId}` };
        return { ok: true, block, mapId };
      };
    }

    it('should create components for fresh placeholders', () => {
      const ph = makePlaceholder('map-a');
      const refs = new Map<HTMLElement, ComponentRef<LeafletMapComponent>>();

      const stats = service.runInjectionPass({
        placeholders: [ph],
        resolveBlock: makeResolver(BLOCK_A),
        environmentInjector: fakeInjector,
        refs,
        log,
      });

      expect(createSpy).toHaveBeenCalledTimes(1);
      expect(createSpy).toHaveBeenCalledWith(ph, BLOCK_A, fakeInjector, refs);
      expect(stats.found).toBe(1);
      expect(stats.created).toBe(1);
      expect(stats.updated).toBe(0);
      expect(stats.active).toBe(1);
      expect(stats.ignored).toEqual({});
    });

    it('should update already-injected placeholders with the latest block', () => {
      const ph = makePlaceholder('map-a');
      const existingRef = makeFakeComponentRef();
      const refs = new Map<HTMLElement, ComponentRef<LeafletMapComponent>>();
      refs.set(ph, existingRef);

      const stats = service.runInjectionPass({
        placeholders: [ph],
        resolveBlock: makeResolver(BLOCK_A),
        environmentInjector: fakeInjector,
        refs,
        log,
      });

      expect(createSpy).not.toHaveBeenCalled();
      expect(existingRef.setInput).toHaveBeenCalledWith('block', BLOCK_A);
      expect(existingRef.changeDetectorRef.detectChanges).toHaveBeenCalled();
      expect(stats.created).toBe(0);
      expect(stats.updated).toBe(1);
      expect(stats.ignored['already-injected']).toBeUndefined();
    });

    it('should skip placeholders with dataset flag but no ref', () => {
      const ph = makePlaceholder('map-a');
      ph.dataset['leafletInjected'] = 'true';
      const refs = new Map<HTMLElement, ComponentRef<LeafletMapComponent>>();

      const stats = service.runInjectionPass({
        placeholders: [ph],
        resolveBlock: makeResolver(BLOCK_A),
        environmentInjector: fakeInjector,
        refs,
        log,
      });

      expect(createSpy).not.toHaveBeenCalled();
      expect(stats.updated).toBe(0);
      expect(stats.ignored['dataset-already-injected']).toBe(1);
    });

    it('should record resolver failure reason in stats.ignored', () => {
      const ph = makePlaceholder('map-unknown');
      const refs = new Map<HTMLElement, ComponentRef<LeafletMapComponent>>();

      const stats = service.runInjectionPass({
        placeholders: [ph],
        resolveBlock: makeResolver(BLOCK_A), // resolver knows map-a, not map-unknown
        environmentInjector: fakeInjector,
        refs,
        log,
      });

      expect(createSpy).not.toHaveBeenCalled();
      expect(stats.updated).toBe(0);
      expect(stats.ignored['missing-block:map-unknown']).toBe(1);
    });

    it('should handle mixed fresh + already-injected + unresolved in one pass', () => {
      const phFresh = makePlaceholder('map-a');
      const phDup = makePlaceholder('map-b');
      const phUnresolved = makePlaceholder('map-missing');

      const refs = new Map<HTMLElement, ComponentRef<LeafletMapComponent>>();
      refs.set(phDup, makeFakeComponentRef());

      const stats = service.runInjectionPass({
        placeholders: [phFresh, phDup, phUnresolved],
        resolveBlock: makeResolver(BLOCK_A, BLOCK_B),
        environmentInjector: fakeInjector,
        refs,
        log,
      });

      expect(createSpy).toHaveBeenCalledTimes(1);
      expect(stats.found).toBe(3);
      expect(stats.created).toBe(1);
      expect(stats.updated).toBe(1);
      expect(stats.ignored['already-injected']).toBeUndefined();
      expect(stats.ignored['missing-block:map-missing']).toBe(1);
      expect(stats.active).toBe(2); // phDup (pre-existing) + phFresh (new)
    });

    it('should cleanup stale refs before processing new placeholders', () => {
      const phStale = makePlaceholder('stale');
      const phFresh = makePlaceholder('map-a');

      const staleRef = makeFakeComponentRef();
      const refs = new Map<HTMLElement, ComponentRef<LeafletMapComponent>>();
      refs.set(phStale, staleRef);

      // Only phFresh is passed as current — phStale should be cleaned up
      service.runInjectionPass({
        placeholders: [phFresh],
        resolveBlock: makeResolver(BLOCK_A),
        environmentInjector: fakeInjector,
        refs,
        log,
      });

      expect(staleRef.destroy).toHaveBeenCalledTimes(1);
      expect(refs.has(phStale)).toBe(false);
    });

    it('should handle createLeafletComponent throwing gracefully', () => {
      createSpy.mockImplementation(() => {
        throw new Error('mock create failure');
      });

      const ph = makePlaceholder('map-a');
      const refs = new Map<HTMLElement, ComponentRef<LeafletMapComponent>>();

      const stats = service.runInjectionPass({
        placeholders: [ph],
        resolveBlock: makeResolver(BLOCK_A),
        environmentInjector: fakeInjector,
        refs,
        log,
      });

      expect(stats.created).toBe(0);
      expect(stats.updated).toBe(0);
      expect(stats.ignored['component-creation-failed']).toBe(1);
      expect(log.error).toHaveBeenCalledWith(
        'component-injection-failed',
        expect.objectContaining({ mapId: 'map-a' })
      );
    });

    it('should log injection-pass summary at end', () => {
      const ph = makePlaceholder('map-a');
      const refs = new Map<HTMLElement, ComponentRef<LeafletMapComponent>>();

      service.runInjectionPass({
        placeholders: [ph],
        resolveBlock: makeResolver(BLOCK_A),
        environmentInjector: fakeInjector,
        refs,
        log,
      });

      expect(log.info).toHaveBeenCalledWith(
        'injection-pass',
        expect.objectContaining({ found: 1, created: 1, updated: 0, active: 1 })
      );
    });

    it('should return correct stats for empty placeholders list', () => {
      const refs = new Map<HTMLElement, ComponentRef<LeafletMapComponent>>();

      const stats: LeafletInjectionStats = service.runInjectionPass({
        placeholders: [],
        resolveBlock: makeResolver(),
        environmentInjector: fakeInjector,
        refs,
        log,
      });

      expect(stats.found).toBe(0);
      expect(stats.created).toBe(0);
      expect(stats.updated).toBe(0);
      expect(stats.active).toBe(0);
      expect(stats.ignored).toEqual({});
    });
  });
});
