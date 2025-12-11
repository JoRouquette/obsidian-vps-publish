# Support des blocs Leaflet dans obsidian-vps-publish

## Vue d'ensemble

Ce document décrit l'implémentation complète du support des blocs Leaflet dans le système de publication Obsidian. Les blocs Leaflet permettent d'afficher des cartes interactives dans les notes publiées, en mode lecture seule.

## Architecture

L'implémentation suit strictement la **Clean Architecture** du projet :

### 1. Couche Domain (`libs/core-domain`)

Entités pures sans dépendances externes :

- **`LeafletBlock`** : Représente un bloc de carte complet avec toutes ses options
- **`LeafletMarker`** : Marqueur avec coordonnées, type, lien et description
- **`LeafletImageOverlay`** : Image superposée sur la carte avec coordonnées
- **`LeafletTileServer`** : Configuration d'un serveur de tuiles personnalisé

Ces entités sont ajoutées à `PublishableNote` et `ManifestPage` via le champ optionnel `leafletBlocks?: LeafletBlock[]`.

### 2. Couche Application (`libs/core-application`)

Service de détection et parsing :

- **`DetectLeafletBlocksService`** : Parse les blocs ```leaflet du contenu markdown
  - Supporte la syntaxe `clé: valeur` simple
  - Gère les propriétés multiples (markers, images)
  - Extrait les wikilinks et références d'assets
  - S'intègre dans le pipeline de parsing **AVANT** la sanitization

**Position dans le pipeline** (ordre critique) :

1. `NormalizeFrontmatterService`
2. `EvaluateIgnoreRulesHandler`
3. `RenderInlineDataviewService` ← plugins/add-ons
4. **`DetectLeafletBlocksService`** ← plugins/add-ons
5. `ContentSanitizerService` ← sanitization APRÈS les plugins
6. `EnsureTitleHeaderService`
7. `DetectAssetsService`
8. `ResolveWikilinksService`
9. `ComputeRoutingService`

### 3. Couche Infrastructure

#### Plugin Obsidian (`apps/obsidian-vps-publish`)

Le service `DetectLeafletBlocksService` est instancié dans `buildParseContentHandler()` et injecté dans `ParseContentHandler`.

Les blocs Leaflet sont automatiquement détectés lors de la collecte des notes et transmis à l'API Node via les DTOs existants.

#### API Node (`apps/node`)

Les `leafletBlocks` sont propagés depuis `PublishableNote` vers `ManifestPage` dans `UploadNotesHandler.handle()` :

```typescript
const pages: ManifestPage[] = succeeded.map((n) => ({
  // ... autres champs
  leafletBlocks: n.leafletBlocks,
}));
```

Le manifest JSON exposé via l'API contient désormais les blocs Leaflet pour chaque page.

#### Site Angular (`apps/site`)

**Composant `LeafletMapComponent`** :

- Standalone, SSR-safe (utilise `isPlatformBrowser`)
- Import dynamique de Leaflet uniquement côté navigateur
- Mode lecture seule (pan/zoom autorisés, pas d'édition)
- Support des marqueurs, images overlays, serveurs de tuiles, mode sombre

**Intégration dans `ViewerComponent`** :

- Signal `leafletBlocks` mis à jour depuis le manifest
- Affichage des cartes dans une section dédiée après le contenu HTML
- Style cohérent avec le thème du site

## Syntaxe des blocs Leaflet

### Format simple

```leaflet
id: my-map
lat: 48.8566
long: 2.3522
defaultZoom: 13
height: 500px
width: 100%
darkMode: true
```

### Avec marqueurs

```leaflet
id: city-map
lat: 48.8566
long: 2.3522
marker: default, 48.8566, 2.3522, [[Paris Note]]
marker: custom, 51.5074, -0.1278, [[London Note]]
```

### Avec images overlay

```leaflet
id: custom-map
image: [[MyMap.png]]
lat: 0
long: 0
defaultZoom: 5
```

### Propriétés supportées

| Propriété      | Type    | Description                                  |
| -------------- | ------- | -------------------------------------------- |
| `id`           | string  | **Obligatoire** - Identifiant unique         |
| `lat`          | number  | Latitude du centre                           |
| `long` / `lon` | number  | Longitude du centre                          |
| `height`       | string  | Hauteur (ex: "500px", "100%")                |
| `width`        | string  | Largeur (ex: "100%", "800px")                |
| `defaultZoom`  | number  | Zoom initial                                 |
| `minZoom`      | number  | Zoom minimum                                 |
| `maxZoom`      | number  | Zoom maximum                                 |
| `darkMode`     | boolean | Mode sombre (true/false)                     |
| `unit`         | string  | Unité de mesure                              |
| `marker`       | string  | Marqueur (format: type, lat, long, [[lien]]) |
| `image`        | string  | Image overlay ([[image.png]])                |
| `tileServer`   | string  | URL du serveur de tuiles                     |

## Tests

### Tests unitaires

- **`detect-leaflet-blocks.service.test.ts`** : Parsing et détection
  - Blocs simples et multiples
  - Marqueurs et images overlays
  - Validation de la propriété `id` obligatoire
  - Gestion des commentaires et lignes vides

- **`leaflet-map.component.spec.ts`** : Composant Angular
  - Rendu SSR vs browser
  - Dimensions et styles
  - Support des différentes options
  - Cleanup correct

### Tests e2e

- **`leaflet.spec.ts`** : Intégration complète
  - Rendu du conteneur de carte
  - Absence d'erreurs JavaScript
  - SSR sans crash
  - Multiples cartes sur une même page

## Sécurité et performance

### SSR-safe

Le composant Angular détecte l'environnement avec `isPlatformBrowser()` et n'initialise Leaflet que côté navigateur, évitant les erreurs `window is not defined` en SSR.

### Mode lecture seule

Les cartes sont configurées en lecture seule :

- Pan et zoom activés pour la navigation
- Pas d'édition de marqueurs ou de polygones
- Pas de sauvegarde d'état côté client

### Sanitization

Les blocs Leaflet sont traités **AVANT** `ContentSanitizerService` pour garantir que le contenu n'est pas tronqué ou modifié de manière incorrecte.

## Extension future

Pour ajouter le support d'autres plugins Obsidian (dataview tables, mermaid, excalidraw, etc.), suivre le même pattern :

1. Créer les entités de domaine dans `libs/core-domain`
2. Créer un service de détection dans `libs/core-application/vault-parsing/services`
3. Intégrer le service dans `ParseContentHandler` **AVANT** la sanitization
4. Propager les données vers le manifest via `ManifestPage`
5. Créer un composant Angular SSR-safe pour le rendu
6. Intégrer dans le viewer
7. Ajouter les tests unitaires et e2e

## Dépendances ajoutées

```json
{
  "dependencies": {
    "leaflet": "^1.9.4"
  },
  "devDependencies": {
    "@types/leaflet": "^1.9.x"
  }
}
```

CSS Leaflet importé dans `apps/site/src/styles.scss` :

```scss
@import 'leaflet/dist/leaflet.css';
```

## Documentation officielle

- Plugin Obsidian Leaflet : https://github.com/javalent/obsidian-leaflet
- Leaflet.js : https://leafletjs.com/
- Angular SSR : https://angular.dev/guide/ssr
