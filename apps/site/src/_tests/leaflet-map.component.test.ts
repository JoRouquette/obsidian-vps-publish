import { PLATFORM_ID, SimpleChange } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import type { LeafletBlock } from '@core-domain';

import { LeafletRuntimeService } from '../application/services/leaflet-runtime.service';
import { LeafletMapComponent } from '../presentation/components/leaflet-map/leaflet-map.component';

function createMockL() {
  const mockMapRemove = jest.fn();
  const mockMapRemoveLayer = jest.fn();
  const mockMapInvalidateSize = jest.fn();
  const mockMapFitBounds = jest.fn();
  const mockMapSetView = jest.fn();
  const mockDragging = { enable: jest.fn(), disable: jest.fn() };
  const mockScrollWheelZoom = { enable: jest.fn(), disable: jest.fn() };
  const mockMapInstance = {
    remove: mockMapRemove,
    removeLayer: mockMapRemoveLayer,
    invalidateSize: mockMapInvalidateSize,
    on: jest.fn(),
    off: jest.fn(),
    fitBounds: mockMapFitBounds,
    setView: mockMapSetView,
    getZoom: jest.fn().mockReturnValue(13),
    getCenter: jest.fn().mockReturnValue({ lat: 48.8566, lng: 2.3522 }),
    dragging: mockDragging,
    scrollWheelZoom: mockScrollWheelZoom,
  };

  const createdTileLayers: Array<{ addTo: jest.Mock }> = [];
  const createdMarkers: Array<{ addTo: jest.Mock; bindPopup: jest.Mock }> = [];
  const createdOverlays: Array<{ addTo: jest.Mock }> = [];

  const L = {
    map: jest.fn().mockReturnValue(mockMapInstance),
    tileLayer: jest.fn().mockImplementation(() => {
      const layer = {
        addTo: jest.fn().mockReturnThis(),
      };
      createdTileLayers.push(layer);
      return layer;
    }),
    marker: jest.fn().mockImplementation(() => {
      const marker = {
        addTo: jest.fn().mockReturnThis(),
        bindPopup: jest.fn().mockReturnThis(),
      };
      createdMarkers.push(marker);
      return marker;
    }),
    imageOverlay: jest.fn().mockImplementation(() => {
      const overlay = {
        addTo: jest.fn().mockReturnThis(),
      };
      createdOverlays.push(overlay);
      return overlay;
    }),
    Icon: { Default: { mergeOptions: jest.fn() } },
    CRS: { Simple: {} },
  };

  return {
    L,
    createdMarkers,
    createdOverlays,
    createdTileLayers,
    mockMapInstance,
    mockMapFitBounds,
    mockMapInvalidateSize,
    mockMapRemove,
    mockMapRemoveLayer,
    mockMapSetView,
  };
}

describe('LeafletMapComponent', () => {
  let component: LeafletMapComponent;
  let fixture: ComponentFixture<LeafletMapComponent>;

  const mockRuntimeService = {
    getMarkerIconUrls: jest.fn().mockReturnValue({
      iconRetinaUrl: '/assets/leaflet/marker-icon-2x.png',
      iconUrl: '/assets/leaflet/marker-icon.png',
      shadowUrl: '/assets/leaflet/marker-shadow.png',
    }),
    buildOverlayAssetUrl: jest.fn((assetPath: string) => `/assets/${assetPath}`),
    resolveMarkerLink: jest.fn((rawLink: string) =>
      /^https?:\/\//i.test(rawLink)
        ? { href: rawLink, external: true, text: rawLink }
        : { href: '/worlds/ektaron', external: false, text: 'Ektaron' }
    ),
    getPersistedViewState: jest.fn().mockReturnValue(null),
    persistViewState: jest.fn(),
  };

  const baseBlock: LeafletBlock = {
    id: 'test-map',
    lat: 48.8566,
    long: 2.3522,
    defaultZoom: 13,
  };

  beforeEach(async () => {
    jest.useFakeTimers();
    jest.spyOn(console, 'warn').mockImplementation(() => undefined);
    jest.spyOn(console, 'error').mockImplementation(() => undefined);
    mockRuntimeService.getPersistedViewState.mockReturnValue(null);

    await TestBed.configureTestingModule({
      imports: [LeafletMapComponent],
      providers: [
        { provide: PLATFORM_ID, useValue: 'browser' },
        { provide: LeafletRuntimeService, useValue: mockRuntimeService },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(LeafletMapComponent);
    component = fixture.componentInstance;
    component.block = baseBlock;
    fixture.detectChanges();
  });

  afterEach(() => {
    component.ngOnDestroy();
    jest.runOnlyPendingTimers();
    jest.useRealTimers();
    jest.clearAllMocks();
  });

  function getReadyContainer(): HTMLElement {
    const container = fixture.nativeElement.querySelector('.leaflet-map-container') as HTMLElement;
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
    return container;
  }

  it('creates the host container', () => {
    const container = fixture.nativeElement.querySelector('.leaflet-map-container');
    expect(container).toBeTruthy();
    expect(container.getAttribute('data-testid')).toBe('leaflet-map-test-map');
  });

  it('reconciles a mounted map when block markers change without recreating the map or resetting the view', () => {
    const { L, createdMarkers, mockMapRemove, mockMapRemoveLayer, mockMapSetView } = createMockL();
    const container = getReadyContainer();

    component.block = {
      ...baseBlock,
      markers: [{ type: 'default', lat: 48.8566, long: 2.3522, description: 'First marker' }],
    };
    (component as any).leafletRuntime = L;
    (component as any).initializeMapOutsideZone(L as any, container, 'initial');

    const updatedBlock: LeafletBlock = {
      ...component.block,
      markers: [{ type: 'default', lat: 48.857, long: 2.353, description: 'Updated marker' }],
    };
    component.block = updatedBlock;
    component.ngOnChanges({
      block: new SimpleChange(
        {
          ...baseBlock,
          markers: [{ type: 'default', lat: 48.8566, long: 2.3522, description: 'First marker' }],
        },
        updatedBlock,
        false
      ),
    });

    expect(L.map).toHaveBeenCalledTimes(1);
    expect(mockMapRemove).not.toHaveBeenCalled();
    expect(mockMapRemoveLayer).toHaveBeenCalledWith(createdMarkers[0]);
    expect(createdMarkers).toHaveLength(2);
    expect(createdMarkers[1].bindPopup).toHaveBeenCalledWith('Updated marker');
    expect(mockMapSetView).toHaveBeenCalledTimes(1);
  });

  it('does not refit an image map when only marker content changes', () => {
    const { L, mockMapFitBounds } = createMockL();
    const container = getReadyContainer();

    component.block = {
      id: 'image-map',
      defaultZoom: 6,
      scale: 1000,
      imageOverlays: [
        {
          path: 'map.png',
          topLeft: [0, 0],
          bottomRight: [100, 200],
        },
      ],
      markers: [{ type: 'default', lat: 10, long: 20, description: 'One' }],
    };

    (component as any).leafletRuntime = L;
    (component as any).initializeMapOutsideZone(L as any, container, 'initial-image');
    jest.runOnlyPendingTimers();
    mockMapFitBounds.mockClear();

    const updatedBlock: LeafletBlock = {
      ...component.block,
      markers: [{ type: 'default', lat: 10, long: 20, description: 'Two' }],
    };

    component.block = updatedBlock;
    component.ngOnChanges({
      block: new SimpleChange(
        {
          ...updatedBlock,
          markers: [{ type: 'default', lat: 10, long: 20, description: 'One' }],
        },
        updatedBlock,
        false
      ),
    });
    jest.runOnlyPendingTimers();

    expect(mockMapFitBounds).not.toHaveBeenCalled();
  });

  it('refreshes zoom-constrained markers on zoom changes instead of keeping the initial visibility forever', () => {
    const { L, createdMarkers, mockMapInstance } = createMockL();
    const container = getReadyContainer();
    const zoomendHandlers: Array<() => void> = [];

    component.block = {
      ...baseBlock,
      markers: [{ type: 'default', lat: 48.8566, long: 2.3522, minZoom: 15 }],
    };

    mockMapInstance.on.mockImplementation((eventName: string, handler: () => void) => {
      if (eventName === 'zoomend') {
        zoomendHandlers.push(handler);
      }
    });

    (component as any).leafletRuntime = L;
    (component as any).initializeMapOutsideZone(L as any, container, 'zoom-sync');

    expect(createdMarkers).toHaveLength(0);
    expect(zoomendHandlers.length).toBeGreaterThanOrEqual(1);

    mockMapInstance.getZoom.mockReturnValue(16);
    zoomendHandlers.forEach((handler) => handler());

    expect(createdMarkers).toHaveLength(1);
  });

  it('honors parsed overlay bounds when present', () => {
    const { L } = createMockL();
    const container = getReadyContainer();

    component.block = {
      ...baseBlock,
      imageOverlays: [
        {
          path: 'map.png',
          topLeft: [20, 30],
          bottomRight: [5, 10],
        },
      ],
    };

    (component as any).initializeMapOutsideZone(L as any, container, 'overlay-bounds');

    expect(mockRuntimeService.buildOverlayAssetUrl).toHaveBeenCalledWith('map.png');
    expect(L.imageOverlay).toHaveBeenCalledWith(
      '/assets/map.png',
      [
        [5, 10],
        [20, 30],
      ],
      expect.objectContaining({
        interactive: false,
        className: 'leaflet-image-overlay-no-animation',
      })
    );
  });

  it('fits the union of multiple overlay bounds instead of only the first overlay', () => {
    const { L, mockMapFitBounds, mockMapInstance } = createMockL();
    const container = getReadyContainer();

    component.block = {
      ...baseBlock,
      imageOverlays: [
        {
          path: 'one.png',
          topLeft: [0, 0],
          bottomRight: [10, 10],
        },
        {
          path: 'two.png',
          topLeft: [5, 5],
          bottomRight: [20, 20],
        },
      ],
    };

    (component as any).initializeMapOutsideZone(L as any, container, 'overlay-union');
    jest.runOnlyPendingTimers();

    expect(mockMapFitBounds).toHaveBeenCalledWith(
      [
        [0, 0],
        [20, 20],
      ],
      expect.objectContaining({
        animate: false,
        duration: 0,
        padding: [20, 20],
      })
    );
    expect(mockMapInstance.dragging.disable).not.toHaveBeenCalled();
    expect(mockMapInstance.scrollWheelZoom.disable).not.toHaveBeenCalled();
  });

  it('derives scaled image overlay bounds from the real image aspect ratio instead of a fake parser ratio', () => {
    const OriginalImage = globalThis.Image;
    const { L } = createMockL();
    const container = getReadyContainer();

    class MockImage {
      naturalWidth = 2000;
      naturalHeight = 1000;
      onload: (() => void) | null = null;
      onerror: (() => void) | null = null;

      set src(_value: string) {
        this.onload?.();
      }
    }

    (globalThis as typeof globalThis & { Image: typeof Image }).Image =
      MockImage as unknown as typeof Image;

    component.block = {
      id: 'scaled-image-map',
      defaultZoom: 6,
      scale: 1000,
      imageOverlays: [
        {
          path: 'scaled.png',
          topLeft: [0, 0],
          bottomRight: [0, 0],
        },
      ],
    };

    try {
      (component as any).initializeMapOutsideZone(L as any, container, 'scaled-image');

      expect(L.imageOverlay).toHaveBeenCalledWith(
        '/assets/scaled.png',
        [
          [-250, -500],
          [250, 500],
        ],
        expect.objectContaining({
          interactive: false,
          className: 'leaflet-image-overlay-no-animation',
        })
      );
    } finally {
      (globalThis as typeof globalThis & { Image: typeof Image }).Image = OriginalImage;
    }
  });

  it('renders external popup links as external and internal note links as router-friendly routes', () => {
    const { L, createdMarkers } = createMockL();
    const container = getReadyContainer();

    component.block = {
      ...baseBlock,
      markers: [
        { type: 'default', lat: 48.8566, long: 2.3522, link: 'https://example.com' },
        { type: 'default', lat: 48.857, long: 2.353, link: 'Internal Note' },
      ],
    };

    (component as any).initializeMapOutsideZone(L as any, container, 'marker-links');

    expect(createdMarkers[0].bindPopup).toHaveBeenCalledWith(
      '<a href="https://example.com" target="_blank" rel="noopener">https://example.com</a>'
    );
    expect(createdMarkers[1].bindPopup).toHaveBeenCalledWith(
      '<a href="/worlds/ektaron">Ektaron</a>'
    );
  });

  it('uses local marker assets instead of remote CDN URLs', () => {
    const { L } = createMockL();
    const container = getReadyContainer();

    (component as any).initializeMapOutsideZone(L as any, container, 'local-icons');
    L.Icon.Default.mergeOptions(mockRuntimeService.getMarkerIconUrls());

    expect(mockRuntimeService.getMarkerIconUrls).toHaveBeenCalled();
    expect(L.Icon.Default.mergeOptions).toHaveBeenCalledWith({
      iconRetinaUrl: '/assets/leaflet/marker-icon-2x.png',
      iconUrl: '/assets/leaflet/marker-icon.png',
      shadowUrl: '/assets/leaflet/marker-shadow.png',
    });
  });

  it('keeps invalidating size after repeated resize requests instead of stopping after an arbitrary cap', () => {
    const { L, mockMapInvalidateSize } = createMockL();
    const container = getReadyContainer();

    (component as any).initializeMapOutsideZone(L as any, container, 'resize');

    for (let index = 0; index < 20; index++) {
      (component as any).queueInvalidateSize(0, `resize-${index}`);
      jest.runOnlyPendingTimers();
    }

    const firstBatchCount = mockMapInvalidateSize.mock.calls.length;

    for (let index = 20; index < 40; index++) {
      (component as any).queueInvalidateSize(0, `resize-${index}`);
      jest.runOnlyPendingTimers();
    }

    expect(firstBatchCount).toBeGreaterThan(0);
    expect(mockMapInvalidateSize.mock.calls.length).toBeGreaterThan(firstBatchCount);
  });

  it('enables attribution control for the default OSM tile layer', () => {
    const { L } = createMockL();
    const container = getReadyContainer();

    (component as any).initializeMapOutsideZone(L as any, container, 'osm-attribution');

    expect(L.map).toHaveBeenCalledWith(
      container,
      expect.objectContaining({
        attributionControl: true,
        zoomAnimation: true,
        fadeAnimation: true,
        markerZoomAnimation: true,
      })
    );
  });

  it('applies zoomDelta, noScrollZoom, lock, and explicit block dimensions to the rendered map container', () => {
    const { L } = createMockL();
    const container = getReadyContainer();

    component.block = {
      ...baseBlock,
      width: '80%',
      height: '640px',
      zoomDelta: 0.5,
      noScrollZoom: true,
      lock: true,
    };
    fixture.detectChanges();

    (component as any).initializeMapOutsideZone(L as any, container, 'locked-options');

    expect(L.map).toHaveBeenCalledWith(
      container,
      expect.objectContaining({
        zoomDelta: 0.5,
        scrollWheelZoom: false,
        doubleClickZoom: false,
        boxZoom: false,
        keyboard: false,
        dragging: false,
        touchZoom: false,
      })
    );
    expect(container.style.width).toBe('80%');
    expect(container.style.height).toBe('640px');
    expect(container.style.paddingBottom).toBe('0px');
  });

  it('restores the last persisted view for the same map identity after a rebuild', () => {
    const { L, mockMapSetView } = createMockL();
    const container = getReadyContainer();

    mockRuntimeService.getPersistedViewState.mockReturnValue({
      center: [120, 240],
      zoom: 7,
      simpleCrs: true,
    });

    component.block = {
      id: 'persisted-map',
      defaultZoom: 6,
      scale: 1000,
      imageOverlays: [
        {
          path: 'persisted.png',
          topLeft: [10, 10],
          bottomRight: [110, 210],
        },
      ],
    };

    (component as any).initializeMapOutsideZone(L as any, container, 'persisted');
    jest.runOnlyPendingTimers();

    expect(mockRuntimeService.getPersistedViewState).toHaveBeenCalledWith('persisted-map', {
      simpleCrs: true,
    });
    expect(mockMapSetView).toHaveBeenCalledWith([120, 240], 7, { animate: false });
  });

  it('adds the fullscreen control explicitly from the plugin constructor', () => {
    const { L } = createMockL();
    const container = getReadyContainer();
    const addTo = jest.fn();
    const FullscreenControl = jest.fn().mockImplementation(() => ({
      addTo,
    }));

    (component as any).initializeMapOutsideZone(
      L as any,
      container,
      'fullscreen-control',
      FullscreenControl
    );

    expect(FullscreenControl).toHaveBeenCalledTimes(1);
    expect(FullscreenControl).toHaveBeenCalledWith({ forceSeparateButton: true });
    expect(addTo).toHaveBeenCalledWith((component as any).map);
  });

  it('cleans up the map on destroy', () => {
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
});
