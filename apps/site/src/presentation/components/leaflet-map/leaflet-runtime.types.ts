import type { LatLngBoundsExpression } from 'leaflet';

export interface LeafletLatLngLiteral {
  lat: number;
  lng: number;
}

export interface LeafletLayerInstance {
  addTo(map: LeafletMapInstance): LeafletLayerInstance;
}

export interface LeafletMarkerInstance extends LeafletLayerInstance {
  addTo(map: LeafletMapInstance): LeafletMarkerInstance;
  bindPopup(content: string): LeafletMarkerInstance;
}

export interface LeafletMapInstance {
  remove(): void;
  removeLayer(layer: LeafletLayerInstance): void;
  invalidateSize(): void;
  on(
    eventName: 'zoomend' | 'moveend' | 'enterFullscreen' | 'exitFullscreen',
    handler: () => void
  ): void;
  off(
    eventName: 'zoomend' | 'moveend' | 'enterFullscreen' | 'exitFullscreen',
    handler: () => void
  ): void;
  fitBounds(
    bounds: LatLngBoundsExpression,
    options?: {
      padding?: [number, number];
      animate?: boolean;
      duration?: number;
    }
  ): void;
  setView(
    center: [number, number],
    zoom: number,
    options?: {
      animate?: boolean;
    }
  ): void;
  getZoom(): number;
  getCenter(): LeafletLatLngLiteral;
  dragging: {
    enable(): void;
    disable(): void;
  };
  scrollWheelZoom: {
    enable(): void;
    disable(): void;
  };
}

export interface LeafletFullscreenControlOptions {
  forceSeparateButton?: boolean;
}

export interface LeafletMapOptions {
  crs?: unknown;
  center?: [number, number];
  zoom?: number;
  minZoom?: number;
  maxZoom?: number;
  zoomDelta?: number;
  zoomSnap?: number;
  zoomControl: boolean;
  attributionControl: boolean;
  scrollWheelZoom: boolean;
  doubleClickZoom: boolean;
  boxZoom: boolean;
  keyboard: boolean;
  dragging: boolean;
  touchZoom?: boolean;
  tap?: boolean;
  zoomAnimation: boolean;
  fadeAnimation: boolean;
  markerZoomAnimation: boolean;
}

export interface LeafletRuntime {
  CRS: {
    Simple: unknown;
  };
  Icon?: {
    Default?: {
      mergeOptions(options: { iconRetinaUrl: string; iconUrl: string; shadowUrl: string }): void;
    };
  };
  map(container: HTMLElement, options: LeafletMapOptions): LeafletMapInstance;
  tileLayer(
    tileUrl: string,
    options: {
      attribution?: string;
      subdomains: string[];
      minZoom?: number;
      maxZoom?: number;
    }
  ): LeafletLayerInstance;
  imageOverlay(
    imageUrl: string,
    bounds: LatLngBoundsExpression,
    options: {
      interactive: boolean;
      className: string;
    }
  ): LeafletLayerInstance;
  marker(position: [number, number]): LeafletMarkerInstance;
}

export type LeafletRuntimeModule = typeof import('leaflet');

export type LeafletRuntimeModuleWithDefault = LeafletRuntimeModule & {
  default?: LeafletRuntime;
};
