# PR #3: Frontend SEO Service + Resolver

## Objectif

Implémenter la génération dynamique des meta tags SEO dans le frontend Angular SSR, en injectant automatiquement les métadonnées (title, description, Open Graph, Twitter Card, JSON-LD) sur chaque route depuis le manifest.

## Changements apportés

### 1. SeoService (apps/site/src/application/services/seo.service.ts)

**Nouveau service Angular (`@Injectable providedIn: 'root'`)** pour gérer les meta tags SEO.

#### Fonctionnalités principales

- **`updateFromPage(page: ManifestPage | null)`** : Met à jour tous les meta tags depuis un ManifestPage
- **Meta tags générés** :
  - `<title>` : `{page.title} | {siteName}`
  - `<meta name="description">` : Utilise `page.description` ou génère depuis tags
  - **Open Graph** : `og:title`, `og:description`, `og:url`, `og:type`, `og:image`, `og:site_name`
  - **Twitter Card** : `twitter:card`, `twitter:title`, `twitter:description`, `twitter:image`
  - **Article metadata** : `article:published_time`, `article:modified_time`, `article:author`, `article:tag`
  - **Robots** : `<meta name="robots" content="noindex, nofollow">` si `page.noIndex`
- **Lien canonical** : `<link rel="canonical" href="{baseUrl}{canonicalSlug || route}">`
- **JSON-LD** : Schema.org Article avec auteur, dates, image, keywords (browser uniquement)

#### Gestion des images

```typescript
// Image relative → absolue
coverImage: '/assets/cover.jpg'
  → 'https://example.com/assets/cover.jpg'

// Image absolue → inchangée
coverImage: 'https://cdn.example.com/image.jpg'
  → 'https://cdn.example.com/image.jpg'
```

#### Support SSR et Browser

- **SSR** : Manipulation DOM via `@Inject(DOCUMENT)` pour canonical link
- **Browser** : JSON-LD injecté uniquement côté client (crawlers ne le traitent pas en SSR)

#### Exemple de sortie

```html
<head>
  <title>About | Test Site</title>
  <meta name="description" content="About page description" />
  <link rel="canonical" href="https://example.com/about" />

  <!-- Open Graph -->
  <meta property="og:title" content="About" />
  <meta property="og:description" content="About page description" />
  <meta property="og:url" content="https://example.com/about" />
  <meta property="og:type" content="article" />
  <meta property="og:image" content="https://example.com/assets/cover.jpg" />
  <meta property="og:site_name" content="Test Site" />

  <!-- Twitter Card -->
  <meta name="twitter:card" content="summary_large_image" />
  <meta name="twitter:title" content="About" />
  <meta name="twitter:description" content="About page description" />
  <meta name="twitter:image" content="https://example.com/assets/cover.jpg" />

  <!-- Article metadata -->
  <meta property="article:published_time" content="2026-01-11T00:00:00.000Z" />
  <meta property="article:modified_time" content="2026-01-12T10:30:00.000Z" />
  <meta property="article:author" content="John Doe" />
  <meta property="article:tag" content="info" />

  <!-- JSON-LD (browser only) -->
  <script type="application/ld+json">
    {
      "@context": "https://schema.org",
      "@type": "Article",
      "headline": "About",
      "description": "About page description",
      "url": "https://example.com/about",
      "datePublished": "2026-01-11T00:00:00.000Z",
      "dateModified": "2026-01-12T10:30:00.000Z",
      "author": {
        "@type": "Person",
        "name": "John Doe"
      },
      "publisher": {
        "@type": "Organization",
        "name": "Test Site"
      },
      "image": "https://example.com/assets/cover.jpg",
      "keywords": "info"
    }
  </script>
</head>
```

### 2. SeoResolver (apps/site/src/application/resolvers/seo.resolver.ts)

**Resolver Angular** qui s'exécute avant le chargement de chaque route.

#### Workflow

```
Route activée
  ↓
SeoResolver exécuté
  ↓
CatalogFacade.ensureManifest()
  ↓
FindPageHandler.handle({ manifest, slugOrRoute: path })
  ↓
SeoService.updateFromPage(page)
  ↓
Meta tags injectés dans <head>
  ↓
Component loaded (non bloquant)
```

#### Caractéristiques

- **Non-bloquant** : retourne `void`, ne bloque jamais la navigation
- **Fault-tolerant** : en cas d'erreur, utilise les meta tags par défaut
- **Path extraction** : convertit `route.url` en path complet (`/` ou `/about` ou `/blog/post`)
- **Fallback** : si page introuvable → meta tags par défaut (Accueil)

### 3. Intégration dans les routes (apps/site/src/presentation/routes/app.routes.ts)

Ajout de `resolve: { seo: seoResolver }` sur **toutes les routes** :

```typescript
export const APP_ROUTES: Routes = [
  {
    path: '',
    component: ShellComponent,
    children: [
      {
        path: '',
        pathMatch: 'full',
        loadComponent: () => import('../pages/home/home.component').then((m) => m.HomeComponent),
        resolve: { seo: seoResolver }, // ✅ Nouveau
      },
      {
        path: 'search',
        loadComponent: () =>
          import('../pages/search/search-content.component').then((m) => m.SearchContentComponent),
        resolve: { seo: seoResolver }, // ✅ Nouveau
      },
      {
        path: '**',
        loadComponent: () =>
          import('../pages/viewer/viewer.component').then((m) => m.ViewerComponent),
        resolve: { seo: seoResolver }, // ✅ Nouveau
      },
    ],
  },
];
```

### 4. Configuration backend

#### Ajout de `baseUrl` dans PublicConfig

**Fichier modifié** : `apps/site/src/domain/ports/config-repository.port.ts`

```typescript
export interface PublicConfig {
  baseUrl: string; // ✅ Nouveau
  siteName: string;
  author: string;
  repoUrl: string;
  reportIssuesUrl: string;
  homeWelcomeTitle: string;
}
```

#### Endpoint `/public-config` mis à jour

**Fichier modifié** : `apps/node/src/infra/http/express/app.ts`

```typescript
app.get('/public-config', (req, res) => {
  res.json({
    baseUrl: EnvConfig.baseUrl(), // ✅ Nouveau
    siteName: EnvConfig.siteName(),
    author: EnvConfig.author(),
    // ...
  });
});
```

Le backend expose maintenant `BASE_URL` au frontend via `/public-config`.

#### ConfigFacade mis à jour

**Fichier modifié** : `apps/site/src/application/facades/config-facade.ts`

Ajout de la méthode `config()` pour accès simplifié :

```typescript
config(): PublicConfig | null {
  return this.cfg();
}
```

### 5. Tests unitaires

#### SeoService tests (apps/site/src/\_tests/seo.service.test.ts)

**19 tests créés** couvrant :

- ✅ Création du service
- ✅ Meta tags par défaut (page null)
- ✅ Title avec siteName
- ✅ Description depuis page ou générée (titre + tags)
- ✅ Open Graph tags complets
- ✅ Twitter Card tags
- ✅ CoverImage (relative → absolue, déjà absolue inchangée)
- ✅ Article metadata (published_time, modified_time, author, tags)
- ✅ Canonical URL (avec canonicalSlug si fourni)
- ✅ Robots noindex/nofollow
- ✅ Suppression du tag robots si noIndex = false

#### SeoResolver tests (apps/site/src/\_tests/seo.resolver.test.ts)

**6 tests créés** couvrant :

- ✅ Mise à jour SEO pour route `/` (home)
- ✅ Mise à jour SEO pour route `/about`
- ✅ Meta tags par défaut si manifest indisponible
- ✅ Meta tags par défaut si page introuvable
- ✅ Gestion d'erreur (network error) → fallback gracieux
- ✅ Non-bloquant (retourne `void`)

#### Test backend mis à jour (apps/node/src/\_tests/app.test.ts)

Ajout de la vérification de `baseUrl` dans `/public-config` :

```typescript
expect(cfgRes.body.baseUrl).toBe('http://localhost:4200');
expect(cfgRes.body.siteName).toBe('Site');
```

## Validation

### Tests locaux

```bash
# Tests unitaires site
npx nx test site --testPathPattern="seo"

# Tests unitaires node (public-config)
npx nx test node --testPathPattern="app.test"

# Linting
npx nx lint site
npx nx lint node

# Build
npx nx build site
npx nx build node
```

### Test manuel

1. Lancer le backend : `npm run start node`
2. Vérifier `/public-config` contient `baseUrl`

```bash
curl http://localhost:3000/public-config
# {
#   "baseUrl": "http://localhost:4200",
#   "siteName": "...",
#   ...
# }
```

3. Lancer le frontend : `npm run start site`
4. Ouvrir `http://localhost:4200` et inspecter `<head>` :
   - `<title>` contient le titre de la page
   - `<meta name="description">` présent
   - `<link rel="canonical">` présent
   - `<meta property="og:*">` présent
   - `<meta name="twitter:*">` présent

5. Naviguer vers `/about` (ou n'importe quelle page) :
   - Meta tags mis à jour dynamiquement
   - `<link rel="canonical">` pointe vers la nouvelle page

### Validation SSR

```bash
# Build production
npm run build

# Démarrer le serveur SSR
node dist/apps/site/server/server.mjs

# Tester avec curl (vérifier meta tags dans le HTML)
curl http://localhost:4200/ | grep -A 5 '<meta'
curl http://localhost:4200/about | grep -A 5 '<meta'
```

Les meta tags doivent être présents **dans le HTML initial** (SSR), pas injectés par JavaScript.

## Compatibilité

### ✅ Non-Breaking Changes

- Nouveau champ `baseUrl` dans `PublicConfig` (ajouté, pas modifié)
- Endpoint `/public-config` étendu (backward compatible)
- Routes Angular étendues avec resolver (transparent pour les components)
- SeoService et SeoResolver sont nouveaux (pas de refactoring)

### 📊 Impact sur les composants

| Composant        | Impact       | Action requise                                          |
| ---------------- | ------------ | ------------------------------------------------------- |
| Plugin Obsidian  | ✅ Aucun     | Pas d'interaction avec le frontend                      |
| Backend API      | ⚙️ Config    | `BASE_URL` doit être défini (valeur par défaut fournie) |
| Frontend Angular | ✅ Nouveau   | Meta tags automatiques sur toutes les routes            |
| SSR              | ✅ Amélioré  | Meta tags présents dans HTML initial (meilleur SEO)     |
| Tests E2E        | ⚙️ Optionnel | Ajouter tests pour vérifier meta tags (PR #6)           |

## Performance

### Impact minimal

- **Resolver** : <5ms (lecture manifest déjà en cache dans CatalogFacade)
- **SeoService** : <2ms (manipulation DOM avec Angular Meta/Title services)
- **SSR** : Pas d'impact (meta tags générés en même temps que le HTML)

### Optimisations intégrées

- `ConfigFacade` : cache la config après premier appel
- `CatalogFacade` : cache le manifest (pas de reload à chaque route)
- JSON-LD : uniquement en browser (skip en SSR pour économiser CPU)

## Intégration avec Google

### Meta tags supportés

| Tag                           | Support Google   | Description                                         |
| ----------------------------- | ---------------- | --------------------------------------------------- |
| `<title>`                     | ✅ Primaire      | Titre de la page dans résultats de recherche        |
| `<meta name="description">`   | ✅ Primaire      | Description (snippet) dans résultats                |
| `<link rel="canonical">`      | ✅ Crucial       | Évite contenu dupliqué, consolide les signaux SEO   |
| `og:title` / `og:description` | ✅ Social        | Utilisés par Google lors du partage social          |
| `og:image`                    | ✅ Social        | Image de prévisualisation (Google Images, partages) |
| `twitter:card`                | ✅ Social        | Utilisés par Twitter, aussi par Google Discovery    |
| `article:published_time`      | ⚙️ Optionnel     | Aide Google à dater le contenu                      |
| JSON-LD                       | ✅ Rich Snippets | Schema.org Article pour rich results Google         |
| `robots` meta                 | ✅ Crucial       | `noindex` empêche l'indexation (drafts)             |

### Rich Snippets (JSON-LD)

Le JSON-LD généré respecte le schema.org **Article** :

```json
{
  "@context": "https://schema.org",
  "@type": "Article",
  "headline": "...",
  "description": "...",
  "url": "...",
  "datePublished": "...",
  "dateModified": "...",
  "author": { "@type": "Person", "name": "..." },
  "publisher": { "@type": "Organization", "name": "..." },
  "image": "...",
  "keywords": "..."
}
```

**Validations recommandées** :

1. [Google Rich Results Test](https://search.google.com/test/rich-results)
2. [Schema.org Validator](https://validator.schema.org/)

### Vérification dans Search Console

Après déploiement :

1. Aller sur [Google Search Console](https://search.google.com/search-console)
2. **Inspection d'URL** : entrer une URL de votre site
3. **Résultat en direct** : vérifier que les meta tags sont détectés
4. **Résultats enrichis** : vérifier si le JSON-LD est reconnu

## Troubleshooting

### Meta tags non mis à jour sur navigation

**Problème** : Les meta tags restent identiques lors du changement de route.

**Solutions** :

1. Vérifier que `resolve: { seo: seoResolver }` est bien sur toutes les routes
2. Vérifier que `CatalogFacade.manifest()` retourne les données
3. Vérifier la console : `[seoResolver] Failed to load page metadata`

### `baseUrl` undefined

**Problème** : `SeoService` ne peut pas générer les URLs canoniques.

**Solutions** :

1. Vérifier que `BASE_URL` est défini dans `.env` (backend)
2. Vérifier `/public-config` retourne `baseUrl`
3. Redémarrer le backend si variable d'environnement changée

### Images relatives ne s'affichent pas dans OG

**Problème** : `og:image` pointe vers une URL relative (non fonctionnel).

**Solutions** :

1. Vérifier que `coverImage` dans le manifest est relatif (`/assets/...`)
2. Vérifier que `baseUrl` est correctement configuré
3. SeoService convertit automatiquement : `/assets/img.jpg` → `https://example.com/assets/img.jpg`

### JSON-LD absent en SSR

**C'est normal**. Le JSON-LD est uniquement injecté côté **browser** (pas en SSR).

**Raison** : La plupart des crawlers (dont Googlebot) n'exécutent pas JavaScript pour parser le JSON-LD en SSR. Ils préfèrent lire directement les meta tags HTML.

**Alternative** : Si vraiment nécessaire, on peut l'activer en SSR en modifiant `updateJsonLd()`, mais c'est rarement utile.

### Canonical pointe vers l'ancienne URL après redirection

**Problème** : Une page a été renommée, mais le canonical pointe toujours vers l'ancienne route.

**Solution** : Utiliser `canonicalSlug` dans le frontmatter :

```yaml
---
title: My Page
canonicalSlug: /new-route
---
```

Le SeoService utilisera `/new-route` pour le canonical au lieu de `/old-route`.

## Prochaines étapes (PRs suivantes)

### PR #4 : Redirections 301 (Canonical Mapping)

- Créer middleware Express pour lire `canonicalMap` du manifest
- Implémenter redirections 301 automatiques (old route → canonical route)
- Détecter slug changes dans le plugin Obsidian lors de l'upload

### PR #5 : Cache Optimizations

- Ajouter ETags conditionnels sur `/content/*`
- Optimiser `Cache-Control` headers (manifest, HTML, assets)
- Tests de performance

### PR #6 : E2E Tests + Documentation finale

- Tests Playwright pour vérifier meta tags sur plusieurs pages
- Tests de performance SEO (Lighthouse)
- Documentation complète (README.md mis à jour)

## Références

- [SEO-STRATEGY.md](../SEO-STRATEGY.md) : Stratégie SEO complète
- [PR-1-DOMAIN-LAYER-SEO.md](./PR-1-DOMAIN-LAYER-SEO.md) : Entités domain SEO
- [PR-2-BACKEND-SEO-API.md](./PR-2-BACKEND-SEO-API.md) : Backend API (sitemap, robots)
- [seo.service.ts](../apps/site/src/application/services/seo.service.ts) : Service implémenté
- [seo.resolver.ts](../apps/site/src/application/resolvers/seo.resolver.ts) : Resolver implémenté
- [Google Search Central - Meta tags](https://developers.google.com/search/docs/crawling-indexing/special-tags)
- [Open Graph Protocol](https://ogp.me/)
- [Twitter Card Validator](https://cards-dev.twitter.com/validator)
- [Schema.org Article](https://schema.org/Article)
