# Thème Leaflet - Adaptation automatique

## Comportement

Les cartes Leaflet s'adaptent **automatiquement** au thème sélectionné sur le site (light/dark).

### Thème Light (par défaut)

```scss
:root.theme-light .leaflet-map-container {
  // Contrôles blancs avec texte sombre
  // Popups fond blanc
  // Attribution transparente claire
}
```

**Rendu** : Carte avec fond clair, contrôles blancs, texte sombre.

### Thème Dark (automatique)

```scss
:root.theme-dark .leaflet-map-container {
  // Contrôles sombres avec texte clair
  // Popups fond sombre
  // Tuiles OSM inversées (si pas d'image overlay)
}
```

**Rendu** : Carte avec fond sombre, contrôles adaptés, **tuiles OpenStreetMap inversées** pour meilleur contraste.

### Override manuel avec `darkMode`

Si le bloc Leaflet définit `darkMode: true`, il **force** le mode sombre indépendamment du thème du site :

```leaflet
id: my-map
lat: 48.8566
long: 2.3522
darkMode: true  ← Force le mode sombre
```

**Résultat** : La carte sera en mode sombre **même si le site est en thème light**.

## Styles adaptés

### Éléments Leaflet stylisés

| Élément            | Light                  | Dark                                |
| ------------------ | ---------------------- | ----------------------------------- |
| **Contrôles zoom** | Blanc `#fff`           | Gris sombre `--its-surface-variant` |
| **Fond carte**     | Blanc                  | Noir `--its-background`             |
| **Popups**         | Fond blanc, texte noir | Fond sombre, texte clair            |
| **Attribution**    | Transparente claire    | Transparente sombre                 |
| **Tuiles OSM**     | Normal                 | Inversées (filtre CSS)              |

### Filtre CSS sur tuiles OSM (mode dark)

```scss
.leaflet-tile-pane {
  filter: invert(1) hue-rotate(180deg) brightness(0.9) contrast(0.9);
}
```

**Effet** : Inverse les couleurs de la carte OpenStreetMap pour un rendu sombre naturel.

**Important** : Le filtre est **désactivé** si la carte a des `imageOverlays` (cartes fantasy custom), car on ne veut pas inverser les images personnalisées.

## Classes CSS appliquées

| Classe               | Quand                            | Effet                                 |
| -------------------- | -------------------------------- | ------------------------------------- |
| `.leaflet-dark-mode` | `block.darkMode === true`        | Force styles sombres                  |
| `.has-image-overlay` | `block.imageOverlays.length > 0` | Désactive le filtre sombre sur tuiles |

## Variables CSS utilisées

Le composant Leaflet utilise les variables de thème ITS :

```scss
--its-surface          // Fond des contrôles/popups
--its-on-surface       // Texte sur fond de surface
--its-surface-variant  // Contrôles hover
--its-outline          // Bordures
--its-background       // Fond de carte
--its-primary          // Accents (hover close button)
--its-secondary        // Liens dans attribution
```

Ces variables changent automatiquement quand l'utilisateur toggle le thème du site.

## Cas d'usage

### 1. Carte géographique standard (OSM)

```leaflet
id: world-map
lat: 48.8566
long: 2.3522
```

- **Light** : Carte normale avec fond clair
- **Dark** : Carte inversée avec contrôles sombres ✨

### 2. Carte fantasy avec image

```leaflet
id: fantasy-map
image: [[Ektaron.png]]
scale: 5000
```

- **Light** : Image normale, contrôles clairs
- **Dark** : Image normale (pas inversée), contrôles sombres ✨

### 3. Force mode sombre

```leaflet
id: night-map
lat: 0
long: 0
darkMode: true
```

- **Light site** : Carte en mode sombre quand même
- **Dark site** : Carte en mode sombre (redondant mais ok)

## Avantages

✅ **Pas de code supplémentaire** dans les notes Obsidian  
✅ **Adaptation automatique** au thème préféré de l'utilisateur  
✅ **Cohérence visuelle** avec le reste du site  
✅ **Override possible** via `darkMode` si besoin  
✅ **Images préservées** (pas d'inversion sur les overlays custom)

## Notes techniques

- Le filtre CSS sur les tuiles OSM est une solution élégante mais **approximative**
- Pour un vrai dark mode Leaflet, il faudrait des tuiles OSM dark natives (ex: CartoDB Dark Matter)
- Les images overlay sont **préservées** car la classe `.has-image-overlay` désactive le filtre
- Le `::ng-deep` est nécessaire car les éléments Leaflet sont injectés dynamiquement (hors portée du ViewEncapsulation)
