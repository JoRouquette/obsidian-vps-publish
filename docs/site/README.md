# Documentation Frontend Angular (Site)

> **English version:** [docs/en/site/](../en/site/)

Cette section contient la documentation relative au frontend Angular (`apps/site`) : l'interface utilisateur qui affiche le contenu publié.

## 🎯 Vue d'ensemble

Le frontend Angular est une Single Page Application (SPA) qui :

- Lit le manifeste de contenu (`/content/_manifest.json`)
- Affiche les pages publiées avec navigation, recherche et visualiseurs
- Supporte le Server-Side Rendering (SSR) pour améliorer SEO et performance
- Utilise un design system cohérent (ITS Theme tokens)

## 📄 Documentation disponible

### Rendu et fonctionnalités

- **[Markdown Rendering](./markdown-rendering.md)** - Rendu Markdown avancé : wikilinks, footnotes, filtrage de tags
- **[Dataview](./dataview.md)** - Implémentation Dataview/DataviewJS côté client
- **[Dataview Assets Pipeline](./dataview-assets-pipeline.md)** - Pipeline assets et icônes pour DataviewJS : détection, canonicalisation, upload
- **[Leaflet](./leaflet.md)** - Intégration des cartes interactives Leaflet
- **[Image Viewer](./image-viewer.md)** - Visualiseur d'images avec zoom et navigation

### SEO et optimisation

- **[SEO](./seo.md)** - Stratégie SEO complète : meta tags, sitemap, redirections 301, cache HTTP (106 tests)
- **[PWA](./pwa.md)** - Progressive Web App : service worker, cache offline, installation

### Design et thème

- **[Design System](./design-system.md)** - Système de tokens CSS (ITS Theme), composants, accessibilité

### Architecture technique

- **[SSR](./ssr.md)** - Server-Side Rendering : configuration, hydratation, performance
- **[Testing E2E](./testing-e2e.md)** - Tests end-to-end avec Playwright
- **[Performance](./performance.md)** - Optimisations frontend, métriques, diagnostics

## 🚀 Démarrage rapide

### Prérequis

- Node.js 20+
- npm installé

### Lancement en dev

```bash
npm install
npm run start site
```

L'application démarre sur `http://localhost:4200`.

### Build de production

```bash
npm run build site
```

Les artefacts sont générés dans `dist/apps/site/browser/`.

## 🛠️ Configuration

Le frontend utilise des variables d'environnement injectées par le backend :

- **`/public-config`** : expose `siteName`, `author`, `repoUrl`, `reportIssuesUrl`
- **Manifeste** : `/content/_manifest.json` contient la liste des pages, tags, et métadonnées

Voir [Architecture](../architecture.md) pour plus de détails.

## 🧪 Tests

### Tests unitaires

```bash
npm run test site
```

### Tests E2E (Playwright)

```bash
npm run e2e site
```

Voir [Testing E2E](./testing-e2e.md) pour plus de détails.

## 🔗 Liens utiles

- [Architecture générale](../architecture.md)
- [Development workflow](../development.md)
- [API Backend](../api/)
- Code source : `apps/site/src/`

---

**Dernière mise à jour** : Février 2026
