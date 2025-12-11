import { isPlatformBrowser } from '@angular/common';
import {
  AfterViewInit,
  Component,
  ElementRef,
  inject,
  Input,
  OnDestroy,
  PLATFORM_ID,
  ViewChild,
} from '@angular/core';
import type { LeafletBlock } from '@core-domain/entities/leaflet-block';

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
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  private map: any = null; // Type 'any' pour éviter l'import de Leaflet côté serveur
  private isBrowser = false;

  ngAfterViewInit(): void {
    this.isBrowser = isPlatformBrowser(this.platformId);

    if (!this.isBrowser) {
      // En mode SSR, on ne fait rien
      return;
    }

    // Import dynamique de Leaflet uniquement côté navigateur
    void this.loadLeafletAndInitializeMap();
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
      const L = await import('leaflet');

      // Fix du problème d'icônes par défaut de Leaflet avec Webpack/Angular
      // Les icônes ne s'affichent pas correctement sans cette configuration
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (L as any).Icon.Default.mergeOptions({
        iconRetinaUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
        iconUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
        shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
      });

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      this.initializeMap(L as any);
    } catch (error) {
      // eslint-disable-next-line no-console
      console.error('Failed to load Leaflet:', error);
    }
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  private initializeMap(L: any): void {
    if (!this.mapContainer?.nativeElement) {
      return;
    }

    // Configuration de base
    const lat = this.block.lat ?? 0;
    const long = this.block.long ?? 0;
    const zoom = this.block.defaultZoom ?? 13;

    // Création de la carte
    this.map = L.map(this.mapContainer.nativeElement, {
      center: [lat, long],
      zoom: zoom,
      minZoom: this.block.minZoom,
      maxZoom: this.block.maxZoom,
      // Mode lecture seule : pas d'interaction de modification
      // mais pan/zoom restent autorisés pour la navigation
      zoomControl: true,
      scrollWheelZoom: true,
      doubleClickZoom: true,
      boxZoom: true,
      keyboard: true,
      dragging: true,
    });

    // Ajout de la couche de tuiles
    this.addTileLayer(L);

    // Ajout des images overlays si présentes
    if (this.block.imageOverlays && this.block.imageOverlays.length > 0) {
      this.addImageOverlays(L);
    }

    // Ajout des marqueurs si présents
    if (this.block.markers && this.block.markers.length > 0) {
      this.addMarkers(L);
    }

    // Application du mode sombre si nécessaire
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
  private addImageOverlays(L: any): void {
    // Pour l'instant, on ne gère que les overlays basiques
    // Les images devront être résolues côté serveur via l'API
    // TODO: Intégrer avec le système d'assets existant
    this.block.imageOverlays?.forEach((overlay) => {
      if (overlay.topLeft && overlay.bottomRight) {
        // Construire l'URL de l'image via l'API d'assets
        const imageUrl = `/assets/${overlay.path}`;

        try {
          L.imageOverlay(imageUrl, [overlay.topLeft, overlay.bottomRight]).addTo(this.map);
        } catch (error) {
          // eslint-disable-next-line no-console
          console.warn('Failed to add image overlay:', overlay.path, error);
        }
      }
    });
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
        // TODO: Résoudre le lien via le système de routing
        const linkHtml = `<a href="${marker.link}" target="_blank">${marker.link}</a>`;
        popupContent = popupContent ? `${popupContent}<br>${linkHtml}` : linkHtml;
      }

      if (popupContent) {
        leafletMarker.bindPopup(popupContent);
      }
    });
  }
}
