# Performance Frontend (Site)

## Objectif

Optimiser les performances du frontend Angular pour améliorer le temps de chargement et la fluidité de navigation.

## Optimisations implémentées

### 1. Server-Side Rendering (SSR)

Le SSR pré-rend les pages côté serveur pour améliorer :

- **SEO** : Contenu visible par les crawlers
- **First Contentful Paint** : Affichage plus rapide
- **Time to Interactive** : Hydratation progressive

Voir [SSR Guide](./ssr.md) pour les détails.

### 2. Lazy loading des composants

Les composants lourds (Leaflet maps, Image Viewer, Dataview) sont chargés uniquement quand nécessaires.

**Exemple** :

```typescript
// apps/site/src/app/components/leaflet-map/
export class LeafletMapComponent {
  async ngAfterViewInit() {
    // Charge Leaflet uniquement si une map est présente
    if (this.hasMap) {
      const L = await import('leaflet');
      this.initMap(L);
    }
  }
}
```

### 3. Optimisation du design system

Migration vers CSS tokens normalisés :

- **Réduction de la taille CSS** : Suppression de tokens legacy `--its-*`
- **Architecture 60/30/10** : Couleurs primaires, secondaires, accent
- **Performance runtime** : Moins de re-calculs CSS

Voir [Design System](./design-system.md) pour les détails.

### 4. Scroll virtuel pour grandes listes

Le vault-explorer utilise le scroll virtuel pour afficher efficacement des milliers de pages sans saturer le DOM.

## Métriques de performance

### Lighthouse scores (production build)

```
Performance : 95+
Accessibility : 98+
Best Practices : 100
SEO : 100
```

### Core Web Vitals

- **LCP (Largest Contentful Paint)** : < 1.5s
- **FID (First Input Delay)** : < 50ms
- **CLS (Cumulative Layout Shift)** : < 0.05

## Configuration

### Build de production optimisé

```bash
npm run build site
```

Active automatiquement :

- Minification JS/CSS
- Tree-shaking
- Code splitting
- Compression gzip

### SSR en production

Le backend sert le HTML pré-rendu depuis `UI_ROOT`. Voir [SSR](./ssr.md).

## Diagnostics

### Analyser le bundle size

```bash
npx webpack-bundle-analyzer dist/apps/site/stats.json
```

### Profiler le runtime

1. Ouvrir DevTools → Performance
2. Enregistrer pendant navigation
3. Identifier les tâches longues (> 50ms)

### Vérifier le SSR

```bash
curl -I https://votre-vps.com/
```

Doit retourner du HTML complet (pas de `<app-root></app-root>` vide).

## Troubleshooting

### Chargement lent des pages

**Symptômes** : Navigation > 2s entre pages.

**Causes possibles** :

- SSR désactivé (hydratation complète à chaque page)
- Manifeste trop volumineux (> 1MB)
- Images non optimisées

**Solutions** :

1. Vérifier SSR actif (voir diagnostics ci-dessus)
2. Compresser le manifeste : activer gzip sur nginx/serveur
3. Optimiser les images : WebP, dimensions adaptées

### Vault-explorer laggy

**Symptômes** : Scroll saccadé avec > 500 pages.

**Causes possibles** :

- Scroll virtuel désactivé
- Trop de composants dans le DOM

**Solutions** :

1. Vérifier que `cdk-virtual-scroll-viewport` est utilisé
2. Réduire la hauteur des items de liste (moins de CSS)

### Images lentes à charger

**Symptômes** : Placeholder visible > 3s.

**Causes possibles** :

- Images servies depuis assets root sans cache
- Pas de lazy loading

**Solutions** :

1. Configurer cache HTTP sur assets (nginx: `expires 30d`)
2. Activer lazy loading : `<img loading="lazy">`
3. Utiliser des formats modernes (WebP, AVIF)

## Références

- Code source : `apps/site/src/`
- Design system : `apps/site/src/app/styles/`
- Tests E2E : [Testing E2E](./testing-e2e.md)
- SSR : [SSR Guide](./ssr.md)

---

**Dernière mise à jour** : 2025-12-25
