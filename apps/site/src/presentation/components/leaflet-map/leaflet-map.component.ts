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

      // Extraire L depuis le module (support ESM avec .default)
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const L = (leafletModule as any).default || leafletModule;

      // Importer le plugin fullscreen (side-effect: ajoute L.Control.Fullscreen)
      await import('leaflet.fullscreen');

      if (L.Icon && L.Icon.Default) {
        L.Icon.Default.mergeOptions({
          iconRetinaUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
          iconUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
          shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
        });
      }

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      this.initializeMap(L as any);
    } catch {
      // Failed to load Leaflet, component will not initialize
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
    // Vérifier si on a des images overlays
    const hasImageOverlays = this.block.imageOverlays && this.block.imageOverlays.length > 0;

    // Pour les images overlays, utiliser un CRS simple (coordonnées pixels)
    // pour préserver les proportions de l'image
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
      minZoom: this.block.minZoom ?? (hasImageOverlays ? -5 : undefined),
      maxZoom: this.block.maxZoom ?? (hasImageOverlays ? 2 : undefined),
      zoomControl: true,
      attributionControl: false, // Désactiver l'attribution Leaflet par défaut
      scrollWheelZoom: true,
      doubleClickZoom: true,
      boxZoom: true,
      keyboard: true,
      dragging: true,
      // Désactiver les animations pour une navigation plus fluide
      zoomAnimation: false,
      fadeAnimation: false,
      markerZoomAnimation: false,
      // Activer le contrôle fullscreen (le plugin est maintenant chargé)
      fullscreenControl: true,
    };

    // Si on a une image overlay, utiliser CRS.Simple pour coordonnées pixels
    if (hasImageOverlays && !this.block.tileServer) {
      mapOptions.crs = L.CRS.Simple;
      mapOptions.center = [0, 0];
      mapOptions.zoom = this.block.defaultZoom ?? 0;
    } else {
      // Sinon, utiliser les coordonnées géographiques normales
      mapOptions.center = [this.block.lat ?? 0, this.block.long ?? 0];
      mapOptions.zoom = this.block.defaultZoom ?? 13;
    }

    // Création de la carte
    this.map = L.map(this.mapContainer.nativeElement, mapOptions);

    // Forcer le recalcul de la taille après initialisation
    // pour éviter les problèmes d'affichage
    setTimeout(() => {
      if (this.map) {
        this.map.invalidateSize();
      }
    }, 100);

    // N'ajouter la couche de tuiles OSM QUE si on n'a pas d'image overlay
    // (pour éviter d'afficher une carte du monde réel derrière une carte fantasy)
    if (!hasImageOverlays || this.block.tileServer) {
      this.addTileLayer(L);
    }

    // Ajout des images overlays si présentes
    if (hasImageOverlays) {
      this.addImageOverlays(L);
      // Marquer comme ayant des images pour désactiver le filtre sombre sur les tuiles
      this.mapContainer.nativeElement.classList.add('has-image-overlay');
    }

    // Ajout des marqueurs si présents
    if (this.block.markers && this.block.markers.length > 0) {
      this.addMarkers(L);
    }

    // Application du mode sombre si spécifié dans le bloc
    // (force le mode sombre indépendamment du thème du site)
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
    this.totalOverlays = this.block.imageOverlays?.length ?? 0;
    this.overlaysLoaded = 0;

    // Stocker tous les bounds pour calculer la vue globale
    const allBounds: [[number, number], [number, number]][] = [];

    this.block.imageOverlays?.forEach((overlay) => {
      // Construire l'URL de l'image via l'API d'assets
      const imageUrl = `/assets/${overlay.path}`;

      // Charger l'image pour obtenir ses dimensions réelles
      const img = new Image();
      img.onload = () => {
        const width = img.naturalWidth;
        const height = img.naturalHeight;

        // Utiliser les dimensions réelles de l'image comme bounds
        // Dans CRS.Simple, les coordonnées sont des pixels
        // On centre l'image à [0, 0]
        const bounds: [[number, number], [number, number]] = [
          [0, 0], // coin supérieur gauche
          [height, width], // coin inférieur droit (attention: [y, x] en Leaflet)
        ];

        try {
          const overlay = L.imageOverlay(imageUrl, bounds, {
            interactive: false, // Désactiver les interactions sur l'image
            className: 'leaflet-image-overlay-no-animation', // Classe pour CSS custom
          });
          overlay.addTo(this.map);
          allBounds.push(bounds);

          this.overlaysLoaded++;

          // Ajuster la vue UNE SEULE FOIS après que TOUTES les images sont chargées
          if (
            this.overlaysLoaded === this.totalOverlays &&
            allBounds.length > 0 &&
            !this.viewAdjusted
          ) {
            this.viewAdjusted = true; // Marquer pour ne jamais refaire le fit
            // Utiliser le premier bounds (ou on pourrait calculer l'union de tous)
            const finalBounds = allBounds[0];

            // Attendre un peu pour laisser les overlays se positionner
            setTimeout(() => {
              if (this.map) {
                // Désactiver temporairement les interactions pendant le fit
                this.map.dragging.disable();
                this.map.scrollWheelZoom.disable();

                this.map.fitBounds(finalBounds, {
                  padding: [20, 20],
                  animate: false,
                  duration: 0, // Pas d'animation du tout
                });

                // Réactiver les interactions après un court délai
                setTimeout(() => {
                  if (this.map) {
                    this.map.dragging.enable();
                    this.map.scrollWheelZoom.enable();
                  }
                }, 50);
              }
            }, 150);
          }
        } catch {
          // Ignore errors silently in production
        }
      };

      img.src = imageUrl;
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
        // Résoudre le lien wikilink en route Angular
        // Format: [[Page Name]] ou juste le nom de la page
        const cleanLink = marker.link.replace(/^\[\[|\]\]$/g, '').trim();
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
