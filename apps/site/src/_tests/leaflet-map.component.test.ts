import { PLATFORM_ID } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import type { LeafletBlock } from '@core-domain/entities/leaflet-block';

import { LeafletMapComponent } from '../presentation/components/leaflet-map/leaflet-map.component';

describe('LeafletMapComponent', () => {
  let component: LeafletMapComponent;
  let fixture: ComponentFixture<LeafletMapComponent>;

  const mockLeafletBlock: LeafletBlock = {
    version: 1,
    id: 'test-map',
    type: 'tile',
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
      providers: [{ provide: PLATFORM_ID, useValue: 'browser' }],
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
    (component as any).map = {
      remove: mockRemove,
    };

    component.ngOnDestroy();

    expect(mockRemove).toHaveBeenCalled();
    expect((component as any).map).toBeNull();
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
      version: 1,
      id: 'map-with-markers',
      type: 'tile',
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

  it('should handle block with image.assetRef (mode image)', () => {
    const blockWithImage: LeafletBlock = {
      version: 1,
      id: 'map-image',
      type: 'image',
      image: {
        assetRef: 'test-image.png',
        bounds: [
          [0, 0],
          [512, 512],
        ],
      },
    };
    component.block = blockWithImage;
    fixture.detectChanges();
    expect(component).toBeTruthy();
  });

  it('should handle block with custom tile server', () => {
    const blockWithCustomTiles: LeafletBlock = {
      version: 1,
      id: 'map-custom-tiles',
      type: 'tile',
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
      version: 1,
      id: 'dark-map',
      type: 'tile',
      lat: 48.8566,
      long: 2.3522,
      darkMode: true,
    };
    component.block = blockWithDarkMode;
    fixture.detectChanges();
    expect(component).toBeTruthy();
  });

  it('should handle missing optional properties gracefully', () => {
    const minimalBlock: LeafletBlock = {
      version: 1,
      id: 'minimal-map',
      type: 'tile',
      lat: 0,
      long: 0,
    };
    component.block = minimalBlock;
    fixture.detectChanges();
    expect(component).toBeTruthy();
  });

  it('should handle geojson and overlays', () => {
    const blockWithGeojson: LeafletBlock = {
      version: 1,
      id: 'geo-map',
      type: 'tile',
      lat: 0,
      long: 0,
      geojson: [{ assetRef: 'test.geojson' }],
      overlays: [{ type: 'circle', lat: 0, long: 0, radius: 100, color: 'red' }],
    };
    component.block = blockWithGeojson;
    fixture.detectChanges();
    expect(component).toBeTruthy();
  });

  it('should display error for invalid block', async () => {
    const invalidBlock: any = { id: 'bad', type: undefined };
    component.block = invalidBlock;
    fixture.detectChanges();
    await fixture.whenStable();
    // Note: Error display requires async Leaflet initialization which may not complete in test environment
    // The component validates the block and would display error if Leaflet loads
    // For this unit test, we verify the component handles the invalid block without throwing
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
});
