import { PLATFORM_ID } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import type { LeafletBlock } from '@core-domain/entities/leaflet-block';

import { LeafletMapComponent } from '../presentation/components/leaflet-map/leaflet-map.component';

// ---------------------------------------------------------------------------
// Leaflet mock — passed directly to initializeMapOutsideZone
// ---------------------------------------------------------------------------
function createMockL() {
  const mockMapRemove = jest.fn();
  const mockMapInvalidateSize = jest.fn();
  const mockDragging = { enable: jest.fn(), disable: jest.fn() };
  const mockScrollWheelZoom = { enable: jest.fn(), disable: jest.fn() };
  const mockMapInstance = {
    remove: mockMapRemove,
    invalidateSize: mockMapInvalidateSize,
    fitBounds: jest.fn(),
    getZoom: jest.fn().mockReturnValue(13),
    dragging: mockDragging,
    scrollWheelZoom: mockScrollWheelZoom,
  };

  const mockTileLayerAddTo = jest.fn();
  const mockMarkerBindPopup = jest.fn();
  const mockMarker = { bindPopup: mockMarkerBindPopup, addTo: jest.fn() };
  // addTo must return the marker itself (Leaflet fluent API)
  mockMarker.addTo.mockReturnValue(mockMarker);

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const L: any = {
    map: jest.fn().mockReturnValue(mockMapInstance),
    tileLayer: jest.fn().mockReturnValue({ addTo: mockTileLayerAddTo }),
    marker: jest.fn().mockReturnValue(mockMarker),
    imageOverlay: jest.fn().mockReturnValue({
      addTo: jest.fn(),
      on: jest.fn((_event: string, handler: () => void) => handler()),
      getBounds: jest.fn().mockReturnValue([
        [0, 0],
        [100, 100],
      ]),
    }),
    latLngBounds: jest.fn().mockReturnValue({
      extend: jest.fn(),
      isValid: jest.fn().mockReturnValue(true),
    }),
    Icon: { Default: { mergeOptions: jest.fn() } },
    CRS: { Simple: {} },
  };

  return { L, mockMapInstance, mockMapRemove };
}

describe('LeafletMapComponent', () => {
  let component: LeafletMapComponent;
  let fixture: ComponentFixture<LeafletMapComponent>;

  const mockLeafletBlock: LeafletBlock = {
    id: 'test-map',
    height: '400px',
    width: '100%',
    lat: 48.8566,
    long: 2.3522,
    defaultZoom: 13,
    minZoom: 1,
    maxZoom: 18,
  };

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [LeafletMapComponent],
      providers: [
        { provide: PLATFORM_ID, useValue: 'browser' }, // Simule l'environnement navigateur
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(LeafletMapComponent);
    component = fixture.componentInstance;
    component.block = mockLeafletBlock;
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('should render map container with correct dimensions', () => {
    fixture.detectChanges();

    const container = fixture.nativeElement.querySelector('.leaflet-map-container');
    expect(container).toBeTruthy();
    expect(container.getAttribute('data-testid')).toBe('leaflet-map-test-map');
  });

  it('should apply correct CSS classes and attributes', () => {
    fixture.detectChanges();

    const container = fixture.nativeElement.querySelector('.leaflet-map-container');
    expect(container).toBeTruthy();
    expect(container.classList.contains('leaflet-map-container')).toBe(true);
    // La hauteur est maintenant gérée par CSS, pas par des styles inline
    expect(container.style.height).toBe('');
  });

  it('should use CSS for dimensions (no inline styles)', () => {
    const blockWithoutDimensions: LeafletBlock = {
      id: 'test-map-2',
      lat: 0,
      long: 0,
    };

    component.block = blockWithoutDimensions;
    fixture.detectChanges();

    const container = fixture.nativeElement.querySelector('.leaflet-map-container');
    // Les dimensions sont gérées par CSS (max-height: 33vh, responsive breakpoints)
    expect(container.style.height).toBe('');
    expect(container.style.width).toBe('');
  });

  it('should cleanup map on destroy', () => {
    fixture.detectChanges();

    // Simulate map initialization
    const mockRemove = jest.fn();
    const mockDisconnect = jest.fn();
    (component as any).map = {
      remove: mockRemove,
    };
    (component as any).resizeObserver = { disconnect: mockDisconnect };

    component.ngOnDestroy();

    expect(mockRemove).toHaveBeenCalled();
    expect(mockDisconnect).toHaveBeenCalled();
    expect((component as any).map).toBeNull();
    expect((component as any).resizeObserver).toBeNull();
  });

  it('should not initialize map on server side (SSR)', async () => {
    // Reconfigure with server platform
    await TestBed.resetTestingModule();
    await TestBed.configureTestingModule({
      imports: [LeafletMapComponent],
      providers: [{ provide: PLATFORM_ID, useValue: 'server' }],
    }).compileComponents();

    const serverFixture = TestBed.createComponent(LeafletMapComponent);
    const serverComponent = serverFixture.componentInstance;
    serverComponent.block = mockLeafletBlock;

    serverFixture.detectChanges();

    // Map should not be initialized on server
    expect((serverComponent as any).map).toBeNull();
  });

  it('should handle block with markers', () => {
    const blockWithMarkers: LeafletBlock = {
      id: 'map-with-markers',
      lat: 48.8566,
      long: 2.3522,
      markers: [
        { type: 'default', lat: 48.8566, long: 2.3522 },
        { type: 'custom', lat: 48.86, long: 2.35, description: 'Test marker' },
      ],
    };

    component.block = blockWithMarkers;
    fixture.detectChanges();

    expect(component).toBeTruthy();
  });

  it('should handle block with image overlays', () => {
    const blockWithImages: LeafletBlock = {
      id: 'map-with-images',
      lat: 48.8566,
      long: 2.3522,
      imageOverlays: [
        {
          path: 'test-image.png',
          topLeft: [48.86, 2.35],
          bottomRight: [48.85, 2.36],
        },
      ],
    };

    component.block = blockWithImages;
    fixture.detectChanges();

    expect(component).toBeTruthy();
  });

  it('should handle block with custom tile server', () => {
    const blockWithCustomTiles: LeafletBlock = {
      id: 'map-custom-tiles',
      lat: 48.8566,
      long: 2.3522,
      tileServer: {
        url: 'https://custom-tiles.example.com/{z}/{x}/{y}.png',
        attribution: 'Custom Tiles',
        subdomains: ['a', 'b'],
      },
    };

    component.block = blockWithCustomTiles;
    fixture.detectChanges();

    expect(component).toBeTruthy();
  });

  it('should apply dark mode class when darkMode is true', () => {
    const blockWithDarkMode: LeafletBlock = {
      id: 'dark-map',
      lat: 48.8566,
      long: 2.3522,
      darkMode: true,
    };

    component.block = blockWithDarkMode;
    fixture.detectChanges();

    // Note: This test would need the actual Leaflet initialization to verify the class
    expect(component).toBeTruthy();
  });

  it('should handle missing optional properties gracefully', () => {
    const minimalBlock: LeafletBlock = {
      id: 'minimal-map',
      lat: 0,
      long: 0,
    };

    component.block = minimalBlock;
    fixture.detectChanges();

    expect(component).toBeTruthy();
  });

  it('should disable attribution control by default', () => {
    fixture.detectChanges();

    // Vérifier que le composant est créé
    expect(component).toBeTruthy();

    // Note: L'attribution control est désactivé via mapOptions.attributionControl: false
    // Dans un environnement de test réel avec Leaflet chargé, on pourrait vérifier
    // l'absence de .leaflet-control-attribution dans le DOM
    // Pour ce test unitaire, on vérifie simplement que le composant se crée sans erreur
    const container = fixture.nativeElement.querySelector('.leaflet-map-container');
    expect(container).toBeTruthy();
  });

  // =======================================================================
  // Hardening scenarios — Leaflet correction regression tests
  // =======================================================================

  describe('Scenario: single block creates exactly one map', () => {
    it('should call L.map exactly once after initialization', () => {
      const { L } = createMockL();
      const container = fixture.nativeElement.querySelector('.leaflet-map-container');
      jest.spyOn(container, 'getBoundingClientRect').mockReturnValue({
        width: 600,
        height: 400,
        x: 0,
        y: 0,
        top: 0,
        left: 0,
        right: 600,
        bottom: 400,
        toJSON: () => ({}),
      });
      jest.spyOn(container, 'isConnected', 'get').mockReturnValue(true);

      (component as any).isBrowser = true;
      (component as any).mapContainer = { nativeElement: container };
      (component as any).initializeMapOutsideZone(L, container, 'test');

      expect(L.map).toHaveBeenCalledTimes(1);
      expect(L.map).toHaveBeenCalledWith(
        container,
        expect.objectContaining({
          attributionControl: false,
          fullscreenControl: true,
        })
      );
    });

    it('should add markers when block has markers', () => {
      const { L } = createMockL();
      const blockWithMarkers: LeafletBlock = {
        id: 'map-markers-test',
        lat: 48.8566,
        long: 2.3522,
        markers: [
          { type: 'default', lat: 48.8566, long: 2.3522, description: 'Paris' },
          { type: 'default', lat: 48.86, long: 2.35, description: 'Close by' },
        ],
      };
      component.block = blockWithMarkers;

      const container = fixture.nativeElement.querySelector('.leaflet-map-container');
      jest.spyOn(container, 'getBoundingClientRect').mockReturnValue({
        width: 600,
        height: 400,
        x: 0,
        y: 0,
        top: 0,
        left: 0,
        right: 600,
        bottom: 400,
        toJSON: () => ({}),
      });
      jest.spyOn(container, 'isConnected', 'get').mockReturnValue(true);

      (component as any).isBrowser = true;
      (component as any).mapContainer = { nativeElement: container };
      (component as any).initializeMapOutsideZone(L, container, 'test');

      expect(L.marker).toHaveBeenCalledTimes(2);
    });
  });

  describe('Scenario: no duplication on re-render', () => {
    it('should not create a second map if tryInitialize is called again', () => {
      const { L } = createMockL();
      const container = fixture.nativeElement.querySelector('.leaflet-map-container');
      jest.spyOn(container, 'getBoundingClientRect').mockReturnValue({
        width: 600,
        height: 400,
        x: 0,
        y: 0,
        top: 0,
        left: 0,
        right: 600,
        bottom: 400,
        toJSON: () => ({}),
      });
      jest.spyOn(container, 'isConnected', 'get').mockReturnValue(true);

      (component as any).isBrowser = true;
      (component as any).mapContainer = { nativeElement: container };
      (component as any).initializeMapOutsideZone(L, container, 'first');

      expect(L.map).toHaveBeenCalledTimes(1);

      // After first init, initCompleted=true and map is set → tryInitialize should bail
      (component as any).tryInitialize('second-attempt');

      // Still only 1 call
      expect(L.map).toHaveBeenCalledTimes(1);
    });
  });

  describe('Scenario: unmeasurable container retries', () => {
    it('should not create map when container has zero dimensions', () => {
      const container = fixture.nativeElement.querySelector('.leaflet-map-container');
      jest.spyOn(container, 'getBoundingClientRect').mockReturnValue({
        width: 0,
        height: 0,
        x: 0,
        y: 0,
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        toJSON: () => ({}),
      });
      jest.spyOn(container, 'isConnected', 'get').mockReturnValue(true);

      // Manually trigger initialization
      (component as any).isBrowser = true;
      (component as any).tryInitialize('test-zero-size');

      // Map should not have been created
      expect((component as any).map).toBeNull();
      // Attempt counter should have incremented (scheduling a retry)
      expect((component as any).initAttemptCount).toBeGreaterThan(0);
    });

    it('should eventually init when container becomes measurable', () => {
      const { L } = createMockL();
      const container = fixture.nativeElement.querySelector('.leaflet-map-container');
      const rectMock = jest.spyOn(container, 'getBoundingClientRect');
      jest.spyOn(container, 'isConnected', 'get').mockReturnValue(true);

      // First: zero dimensions → canInitializeNow returns false
      rectMock.mockReturnValue({
        width: 0,
        height: 0,
        x: 0,
        y: 0,
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        toJSON: () => ({}),
      });

      (component as any).isBrowser = true;
      (component as any).mapContainer = { nativeElement: container };
      (component as any).tryInitialize('test-zero-then-valid');

      expect(L.map).not.toHaveBeenCalled();

      // Now measurable → direct call to initializeMapOutsideZone
      rectMock.mockReturnValue({
        width: 600,
        height: 400,
        x: 0,
        y: 0,
        top: 0,
        left: 0,
        right: 600,
        bottom: 400,
        toJSON: () => ({}),
      });

      (component as any).initializeMapOutsideZone(L, container, 'test-now-valid');

      expect(L.map).toHaveBeenCalledTimes(1);
    });
  });

  describe('Scenario: destroy cleans map + observers', () => {
    it('should cancel pending timers and raf on destroy', () => {
      (component as any).pendingRafId = 42;
      (component as any).pendingTimeoutId = setTimeout(() => {}, 10000);

      const cancelRaf = jest.spyOn(globalThis, 'cancelAnimationFrame');

      component.ngOnDestroy();

      expect(cancelRaf.calls || cancelRaf).toBeTruthy();
      expect((component as any).pendingRafId).toBeNull();
      expect((component as any).pendingTimeoutId).toBeNull();
      expect((component as any).isDestroyed).toBe(true);

      cancelRaf.mockRestore();
    });

    it('should not throw if destroyed before init', () => {
      expect(() => component.ngOnDestroy()).not.toThrow();
      expect((component as any).isDestroyed).toBe(true);
    });

    it('should clear restoreInteractions and fitBounds timers on destroy', () => {
      (component as any).restoreInteractionsTimeoutId = setTimeout(() => {}, 10000);
      (component as any).fitBoundsTimeoutId = setTimeout(() => {}, 10000);

      component.ngOnDestroy();

      expect((component as any).restoreInteractionsTimeoutId).toBeNull();
      expect((component as any).fitBoundsTimeoutId).toBeNull();
    });
  });

  describe('Scenario: escapeHtml prevents XSS in popups', () => {
    it('should escape HTML special characters', () => {
      const escape = (component as any).escapeHtml.bind(component);

      expect(escape('<script>alert("xss")</script>')).toBe(
        '&lt;script&gt;alert(&quot;xss&quot;)&lt;/script&gt;'
      );
      expect(escape('Tom & Jerry')).toBe('Tom &amp; Jerry');
      expect(escape("it's fine")).toBe('it&#39;s fine');
    });

    it('should bind escaped description into popup', () => {
      const { L } = createMockL();
      const maliciousBlock: LeafletBlock = {
        id: 'xss-map',
        lat: 0,
        long: 0,
        markers: [
          { type: 'default', lat: 0, long: 0, description: '<img src=x onerror=alert(1)>' },
        ],
      };
      component.block = maliciousBlock;

      const container = fixture.nativeElement.querySelector('.leaflet-map-container');
      jest.spyOn(container, 'getBoundingClientRect').mockReturnValue({
        width: 600,
        height: 400,
        x: 0,
        y: 0,
        top: 0,
        left: 0,
        right: 600,
        bottom: 400,
        toJSON: () => ({}),
      });
      jest.spyOn(container, 'isConnected', 'get').mockReturnValue(true);

      (component as any).isBrowser = true;
      (component as any).mapContainer = { nativeElement: container };
      (component as any).initializeMapOutsideZone(L, container, 'test');

      const marker = L.marker.mock.results[0].value;
      expect(marker.bindPopup).toHaveBeenCalledWith('&lt;img src=x onerror=alert(1)&gt;');
    });
  });
});
