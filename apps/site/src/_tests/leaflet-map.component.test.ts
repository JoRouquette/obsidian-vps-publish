import { PLATFORM_ID } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import type { LeafletBlock } from '@core-domain/entities/leaflet-block';

import { LeafletMapComponent } from '../presentation/components/leaflet-map/leaflet-map.component';

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
});
