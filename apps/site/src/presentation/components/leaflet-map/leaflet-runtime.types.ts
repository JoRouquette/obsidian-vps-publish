import type { LatLngBoundsExpression, Map as LeafletMap } from 'leaflet';

export type LeafletMapInstance = LeafletMap;

export interface LeafletMapOptions {
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
      attribution: string;
      subdomains: string[];
      minZoom?: number;
      maxZoom?: number;
    }
  ): { addTo(map: LeafletMapInstance): void };
  imageOverlay(
    imageUrl: string,
    bounds: LatLngBoundsExpression,
    options: {
      interactive: boolean;
      className: string;
    }
  ): { addTo(map: LeafletMapInstance): void };
  marker(position: [number, number]): {
    addTo(map: LeafletMapInstance): {
      bindPopup(content: string): void;
    };
  };
}

export type LeafletRuntimeModule = typeof import('leaflet');

export type LeafletRuntimeModuleWithDefault = LeafletRuntimeModule & {
  default?: LeafletRuntime;
};
