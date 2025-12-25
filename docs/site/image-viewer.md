# Visualisation des Images

## Fonctionnalités

### 1. Overlay avec Zoom Interactif

Toutes les images dans le viewer sont désormais cliquables et s'ouvrent dans un overlay plein écran avec les fonctionnalités suivantes :

#### Contrôles Desktop

- **Clic sur image** : Ouvre l'overlay
- **Molette de souris** : Zoom in/out
- **Clic + Glisser** : Déplacer l'image (quand zoomée)
- **Boutons overlay** :
  - 🔍 Zoom avant
  - 🔍 Zoom arrière
  - ⬜ Réinitialiser le zoom
  - ✖️ Fermer
- **Touche Escape** : Fermer l'overlay
- **Clic sur le fond** : Fermer l'overlay

#### Contrôles Mobile/Tactile

- **Tap sur image** : Ouvre l'overlay
- **Pinch (2 doigts)** : Zoom in/out
- **Glisser (1 doigt)** : Déplacer l'image (quand zoomée)
- **Boutons overlay** : Mêmes fonctionnalités que desktop

#### Limites de Zoom

- **Minimum** : 0.5x (50% de la taille originale)
- **Maximum** : 5x (500% de la taille originale)

### 2. Ajustement Automatique du Contraste

Le contraste des images est automatiquement ajusté selon le thème actif pour améliorer la lisibilité :

#### Thème Dark

- **Brightness** : +12% (améliore la visibilité des images sombres)
- **Contrast** : +3% (renforce les détails)
- **Background** : Léger fond gris pour les PNG transparents
- **Padding** : 0.4rem pour créer un espace visuel

#### Thème Light

- **Brightness** : -1% (optimisation légère)
- **Contrast** : +1% (légère amélioration)

#### Exceptions

Les images suivantes ne sont **pas** affectées par le filtre automatique :

- Images avec `alt` contenant "logo" (insensible à la casse)
- Images avec `alt` contenant "icon" (insensible à la casse)
- Images avec la classe CSS `no-auto-contrast`

**Exemple** :

```html
<!-- Ces images NE seront PAS filtrées -->
<img src="logo.png" alt="Company Logo" />
<img src="icon.svg" alt="Menu Icon" />
<img src="diagram.png" class="no-auto-contrast" />

<!-- Ces images SERONT filtrées automatiquement -->
<img src="screenshot.png" alt="Application Screenshot" />
<img src="diagram.png" alt="Architecture Diagram" />
```

### 3. Interactivité Visuelle

Toutes les images dans le viewer ont des effets visuels pour indiquer qu'elles sont cliquables :

- **Cursor** : Pointer au survol
- **Hover** : Légère augmentation de taille (+1%) avec ombre portée
- **Active** : Légère réduction de taille (-1%) pour feedback tactile
- **Transition** : Animations fluides (150-200ms)
- **Border-radius** : 0.5rem pour des coins arrondis

## Architecture Technique

### Composant ImageOverlay

**Fichier** : `apps/site/src/presentation/components/image-overlay/`

**Structure** :

```
image-overlay/
├── image-overlay.component.ts    # Logique du composant
├── image-overlay.component.html  # Template
└── image-overlay.component.scss  # Styles
```

**Signals utilisés** :

- `isOpen` : État d'ouverture de l'overlay
- `imageSrc` : URL de l'image affichée
- `imageAlt` : Texte alternatif
- `scale` : Niveau de zoom (0.5 à 5)
- `translateX` / `translateY` : Position de l'image

**Méthodes principales** :

- `open(src, alt)` : Ouvre l'overlay avec une image
- `close()` : Ferme l'overlay
- `zoomIn()` / `zoomOut()` : Contrôle du zoom
- `resetZoom()` : Réinitialise la vue
- `onWheel()` : Gestion de la molette
- `onTouchStart/Move/End()` : Gestion tactile

### Intégration dans ViewerComponent

Le composant `ImageOverlayComponent` est importé et utilisé dans `ViewerComponent` :

**Modifications** :

1. Import du composant dans les dépendances
2. Ajout d'un `@ViewChild(ImageOverlayComponent)`
3. Méthode `decorateImages()` qui rend toutes les images cliquables
4. Méthode `openImageOverlay()` qui déclenche l'overlay
5. Ajout du tag `<app-image-overlay />` dans le template

### Styles Globaux

**Fichier** : `apps/site/src/styles.scss`

Les filtres de contraste automatique sont appliqués globalement pour toutes les images de l'application :

```scss
:root.theme-dark img {
  filter: brightness(1.12) contrast(1.03);
}

:root.theme-light img {
  filter: brightness(0.99) contrast(1.01);
}
```

## Performance

### Optimisations

- **Lazy Loading** : L'overlay n'est rendu que quand `isOpen === true`
- **Event Delegation** : Les événements sont attachés/détachés proprement
- **CSS Transitions** : Animations GPU-accélérées
- **Touch Action** : `touch-action: none` pour éviter les conflits de scroll

### Compatibilité

- ✅ Desktop (Chrome, Firefox, Safari, Edge)
- ✅ Mobile (iOS Safari, Chrome Android)
- ✅ Tablettes
- ✅ Support clavier (Escape pour fermer)
- ✅ Accessible (ARIA labels sur les boutons)

## Exemples d'Utilisation

### Utilisation Standard

Aucune action requise ! Toutes les images dans le contenu markdown sont automatiquement interactives.

### Désactiver le Filtre Automatique

Si une image spécifique ne doit pas être filtrée :

```markdown
![Diagram](diagram.png){.no-auto-contrast}
```

Ou dans le HTML généré :

```html
<img src="diagram.png" alt="Diagram" class="no-auto-contrast" />
```

### Logos et Icônes

Les logos sont automatiquement exclus :

```markdown
![Company Logo](logo.png)
![Settings Icon](icon-settings.svg)
```

## Améliorations Futures

### Possibilités d'Extension

1. **Rotation** : Ajouter des boutons pour faire pivoter l'image
2. **Diaporama** : Navigation entre images (précédent/suivant)
3. **Métadonnées** : Afficher EXIF, taille, dimensions
4. **Téléchargement** : Bouton pour télécharger l'image
5. **Partage** : Bouton de partage social
6. **Annotations** : Dessiner sur l'image
7. **Comparaison** : Afficher deux images côte à côte
8. **Détection Intelligente** : Analyser la luminosité réelle de l'image pour ajuster le filtre dynamiquement

### Détection de Luminosité Intelligente

Actuellement, le filtre est appliqué uniformément. Une amélioration serait d'analyser chaque image :

```typescript
private async analyzeImageBrightness(img: HTMLImageElement): Promise<number> {
  const canvas = document.createElement('canvas');
  const ctx = canvas.getContext('2d');
  canvas.width = img.width;
  canvas.height = img.height;
  ctx.drawImage(img, 0, 0);

  const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
  let brightness = 0;

  for (let i = 0; i < imageData.data.length; i += 4) {
    const r = imageData.data[i];
    const g = imageData.data[i + 1];
    const b = imageData.data[i + 2];
    brightness += (r + g + b) / 3;
  }

  return brightness / (imageData.data.length / 4);
}
```

Puis ajuster le filtre dynamiquement selon la luminosité détectée.
