import { isPlatformBrowser } from '@angular/common';
import {
  AfterViewInit,
  ApplicationRef,
  Component,
  ElementRef,
  inject,
  Input,
  NgZone,
  OnDestroy,
  PLATFORM_ID,
  ViewChild,
} from '@angular/core';
import type { LeafletBlock } from '@core-domain/entities/leaflet-block';
import { first } from 'rxjs/operators';

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
  private readonly appRef = inject(ApplicationRef);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  private map: any = null; // Type 'any' pour éviter l'import de Leaflet côté serveur
  private isBrowser = false;
  private isInitialized = false;
  private overlaysLoaded = 0;
  private totalOverlays = 0;
  private viewAdjusted = false; // Flag pour empêcher les fitBounds multiples

  ngAfterViewInit(): void {
    this.isBrowser = isPlatformBrowser(this.platformId);

    if (!this.isBrowser) {
      // En mode SSR, on ne fait rien
      return;
    }

    // Attendre que l'application soit stable avant d'initialiser Leaflet
    // Utiliser first() pour unsubscribe automatiquement après la première émission
    this.appRef.isStable.pipe(first((stable) => stable)).subscribe(() => {
      if (!this.isInitialized) {
        this.isInitialized = true;
        // Import dynamique de Leaflet uniquement côté navigateur
        void this.loadLeafletAndInitializeMap();
      }
    });
  }

  ngOnDestroy(): void {
    if (this.map) {
      this.map.remove();
      this.map = null;
    }
  }

  private async loadLeafletAndInitializeMap(): Promise<void> {
    try {
      // Import dynamique pour éviter les erreurs SSR
      const leafletModule = await import('leaflet');
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const L = (leafletModule as any).default || leafletModule;
      await import('leaflet.fullscreen');
      if (L.Icon?.Default) {
        L.Icon.Default.mergeOptions({
          iconRetinaUrl: '/assets/leaflet/marker-icon-2x.png',
          iconUrl: '/assets/leaflet/marker-icon.png',
          shadowUrl: '/assets/leaflet/marker-shadow.png',
        });
      }
      // Validation du bloc DTO v1
      if (!this.block?.version || !this.block?.id || !this.block?.type) {
        this.displayError('Bloc Leaflet invalide ou non supporté');
        return;
      }
      this.initializeMap(L);
    } catch {
      this.displayError('Erreur d’initialisation Leaflet');
    }
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  private initializeMap(L: any): void {
    if (!this.mapContainer?.nativeElement) {
      return;
    }

    // Exécuter l'initialisation en dehors de la zone Angular
    // pour éviter le change detection permanent sur les events de la carte
    this.ngZone.runOutsideAngular(() => {
      this.initializeMapOutsideZone(L);
    });
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  private initializeMapOutsideZone(L: any): void {
    // DTO v1 : type 'image' ou 'tile'
    const isImage = this.block.type === 'image' && this.block.image?.assetRef;
    const isTile = this.block.type === 'tile' && this.block.tileServer?.url;

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
      minZoom: this.block.minZoom ?? (isImage ? -5 : undefined),
      maxZoom: this.block.maxZoom ?? (isImage ? 2 : undefined),
      zoomControl: true,
      attributionControl: false,
      scrollWheelZoom: true,
      doubleClickZoom: true,
      boxZoom: true,
      keyboard: true,
      dragging: true,
      zoomAnimation: false,
      fadeAnimation: false,
      markerZoomAnimation: false,
      fullscreenControl: true,
    };

    if (isImage) {
      mapOptions.crs = L.CRS.Simple;
      mapOptions.center = [0, 0];
      mapOptions.zoom = this.block.defaultZoom ?? 0;
    } else if (isTile) {
      mapOptions.center = [this.block.lat ?? 0, this.block.long ?? 0];
      mapOptions.zoom = this.block.defaultZoom ?? 13;
    } else {
      this.displayError('Bloc Leaflet incomplet ou non supporté');
      return;
    }

    this.map = L.map(this.mapContainer.nativeElement, mapOptions);
    setTimeout(() => {
      if (this.map) this.map.invalidateSize();
    }, 100);

    if (isTile) {
      this.addTileLayer(L);
    }
    if (isImage) {
      this.addImageOverlayDTO(L);
      this.mapContainer.nativeElement.classList.add('has-image-overlay');
    }
    if (this.block.markers && this.block.markers.length > 0) {
      this.addMarkers(L);
    }
    if (this.block.geojson && this.block.geojson.length > 0) {
      this.addGeoJsonOverlays(L);
    }
    if (this.block.overlays && this.block.overlays.length > 0) {
      this.addCircleOverlays(L);
    }
    if (this.block.darkMode) {
      this.mapContainer.nativeElement.classList.add('leaflet-dark-mode');
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
  private addImageOverlayDTO(L: any): void {
    if (!this.block.image?.assetRef) return;
    const imageUrl = `/assets/${this.block.image.assetRef}`;
    const bounds = this.block.image.bounds ?? [
      [0, 0],
      [512, 512],
    ];
    try {
      const overlay = L.imageOverlay(imageUrl, bounds, {
        interactive: false,
        className: 'leaflet-image-overlay-no-animation',
      });
      overlay.addTo(this.map);
      this.map.fitBounds(bounds, {
        padding: [20, 20],
        animate: false,
        duration: 0,
      });
    } catch {
      // Ignore errors silently
    }
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  private addGeoJsonOverlays(L: any): void {
    this.block.geojson?.forEach((geo) => {
      const url = geo.assetRef.startsWith('http') ? geo.assetRef : `/assets/${geo.assetRef}`;
      fetch(url)
        .then((res) => res.json())
        .then((data) => {
          const layer = L.geoJSON(data, { style: geo.style ?? {} });
          layer.addTo(this.map);
        })
        .catch(() => {
          // Ignore errors silently
        });
    });
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  private addCircleOverlays(L: any): void {
    this.block.overlays?.forEach((ov) => {
      if (ov.type === 'circle') {
        L.circle([ov.lat, ov.long], {
          radius: ov.radius,
          color: ov.color ?? 'blue',
          fillOpacity: 0.2,
        }).addTo(this.map);
      }
    });
  }

  private displayError(msg: string): void {
    if (this.mapContainer?.nativeElement) {
      this.mapContainer.nativeElement.innerHTML = `<div class="leaflet-error">${msg}</div>`;
    }
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  private addMarkers(L: any): void {
    this.block.markers?.forEach((marker) => {
      // Vérifier les contraintes de zoom si définies
      if (marker.minZoom && this.map.getZoom() < marker.minZoom) {
        return;
      }
      if (marker.maxZoom && this.map.getZoom() > marker.maxZoom) {
        return;
      }

      const leafletMarker = L.marker([marker.lat, marker.long]).addTo(this.map);

      // Popup avec description ou lien
      let popupContent = '';
      if (marker.description) {
        popupContent = marker.description;
      }
      if (marker.link) {
        // Résoudre le lien wikilink en route Angular
        // Format: [[Page Name]] ou juste le nom de la page
        const cleanLink = marker.link.replaceAll('[[', '').replaceAll(']]', '').trim();
        const route = `/viewer/${encodeURIComponent(cleanLink)}`;
        const linkHtml = `<a href="${route}">${cleanLink}</a>`;
        popupContent = popupContent ? `${popupContent}<br>${linkHtml}` : linkHtml;
      }

      if (popupContent) {
        leafletMarker.bindPopup(popupContent);
      }
    });
  }
}
