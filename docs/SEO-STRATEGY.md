# Stratégie SEO Dynamique - Plan d'implémentation

## 1. CARTOGRAPHIE DU FLUX DE DONNÉES & ROUTING

### 1.1 Architecture actuelle identifiée

```
[Obsidian Plugin]
    ↓ (upload via session API)
[Node/Express Backend]
    ↓ (MarkdownItRenderer + ComputeRoutingService)
[Content Storage: /content/*.html + _manifest.json]
    ↓ (static serving + Angular SSR)
[Angular Site (SSR + CSR)]
    ↓ (ViewerComponent + CatalogFacade)
[Utilisateur final]
```

#### **Flux détaillé actuel :**

1. **Plugin → Backend :**
   - `POST /api/session/:sessionId/notes/upload` : batch de notes Markdown avec frontmatter
   - `POST /api/session/:sessionId/assets/upload` : assets binaires
   - `POST /api/session/:sessionId/finish` : commit staging → CONTENT_ROOT

2. **Backend Processing (session finalization) :**
   - `ComputeRoutingService` : calcule `slug`, `path`, `routeBase`, `fullPath` depuis `relativePath` + `folderConfig`
   - `MarkdownItRenderer` : convertit Markdown → HTML (avec validation de liens via manifest)
   - `ManifestFileSystem` : écrit `_manifest.json` avec `pages[]` (id, title, slug, route, description, publishedAt, tags, leafletBlocks)
   - Stockage : `/content/{route}.html` et `/assets/*`

3. **Frontend (Angular SSR) :**
   - **Routes dynamiques** : `apps/site/src/presentation/routes/app.routes.ts`
     - `/` → `HomeComponent`
     - `/search` → `SearchContentComponent`
     - `/**` → `ViewerComponent` (catch-all pour toutes les pages de contenu)
   - **SSR** : `apps/site/src/server.ts` → `CommonEngine.render()` pour chaque route
   - **Data fetching** :
     - `HttpManifestRepository.load()` → GET `/content/_manifest.json` (avec cache localStorage)
     - `HttpContentRepository.fetch(path)` → GET `/content/{route}.html`
   - **ViewerComponent** : lit URL → extrait route → charge HTML + meta depuis manifest

#### **Points critiques pour SEO :**

- ✅ SSR déjà actif via `@angular/ssr/node` + `CommonEngine`
- ❌ **Aucune meta tag dynamique** (title/description/og/canonical) dans SSR
- ❌ **Pas de sitemap.xml** ni robots.txt dynamiques
- ❌ **Pas de structured data** (JSON-LD)
- ❌ **Pas de gestion de redirections** (slug history, URL legacy)
- ✅ Manifest contient déjà : `title`, `description`, `tags`, `publishedAt`, `route`

---

## 2. STRATÉGIE SEO DYNAMIQUE END-TO-END

### 2.1 Objectifs SEO

1. **Meta tags dynamiques par page** : title, description, canonical, robots, og:_, twitter:_
2. **Structured data JSON-LD** : Article/BlogPosting/TechArticle, BreadcrumbList, WebSite + SearchAction
3. **Sitemap.xml** généré dynamiquement depuis manifest (avec cache ETag/Last-Modified)
4. **Robots.txt** configuré dynamiquement (avec référence au sitemap)
5. **Canonicalisation** : gestion des slug history + redirections 301
6. **Pagination SEO** : rel="prev"/rel="next" pour /search (si nécessaire)
7. **Performance SEO** : Core Web Vitals (SSR rapide, cache agressif)

### 2.2 Architecture proposée

```
┌─────────────────────────────────────────────────────────────┐
│  Angular SSR (server.ts + CommonEngine)                     │
│  ┌───────────────────────────────────────────────────────┐  │
│  │  SEO Resolver (route guard/resolver)                  │  │
│  │    ↓                                                   │  │
│  │  SEO Service (génère meta tags)                       │  │
│  │    ↓                                                   │  │
│  │  TransferState (SSR → CSR hydration)                  │  │
│  │    ↓                                                   │  │
│  │  Meta/Title services (Angular platform)              │  │
│  └───────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────┘
                            ↕
┌─────────────────────────────────────────────────────────────┐
│  Node/Express Backend                                        │
│  ┌───────────────────────────────────────────────────────┐  │
│  │  SEO API Controller (/seo/*)                          │  │
│  │    - GET /seo/sitemap.xml   (ETag + Last-Modified)   │  │
│  │    - GET /seo/robots.txt    (static config)          │  │
│  │    - GET /seo/meta/:route   (JSON meta pour page)    │  │
│  └───────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────┘
                            ↕
┌─────────────────────────────────────────────────────────────┐
│  Manifest (_manifest.json)                                   │
│    - pages[] avec title, description, tags, publishedAt     │
│    - metadata: siteName, author, baseUrl                    │
│    - canonicalMap?: Record<string, string>  (slug history) │
└─────────────────────────────────────────────────────────────┘
```

---

## 3. RECOMMANDATIONS CONCRÈTES D'IMPLÉMENTATION

### 3.1 Backend (Node/Express) : Endpoints SEO

#### **Fichier à créer : `apps/node/src/infra/http/express/controllers/seo.controller.ts`**

**Responsabilités :**

- Générer `sitemap.xml` depuis manifest
- Servir `robots.txt` configuré
- Fournir metadata SEO par route (optionnel, peut être intégré dans Angular)

**Pseudocode :**

```typescript
import express from 'express';
import type { Manifest, ManifestPage } from '@core-domain';

export function createSeoController(
  manifestLoader: () => Promise<Manifest>,
  logger?: LoggerPort
): express.Router {
  const router = express.Router();

  // GET /seo/sitemap.xml
  router.get('/sitemap.xml', async (req, res) => {
    try {
      const manifest = await manifestLoader();
      const baseUrl = process.env.BASE_URL || 'https://example.com';

      // ETag basé sur lastUpdatedAt du manifest
      const etag = `W/"${manifest.lastUpdatedAt.getTime()}"`;
      if (req.headers['if-none-match'] === etag) {
        return res.status(304).end();
      }

      const xml = generateSitemap(manifest.pages, baseUrl);

      res.set({
        'Content-Type': 'application/xml',
        ETag: etag,
        'Last-Modified': manifest.lastUpdatedAt.toUTCString(),
        'Cache-Control': 'public, max-age=3600, s-maxage=86400',
      });
      res.send(xml);
    } catch (err) {
      logger?.error('Failed to generate sitemap', err);
      res.status(500).send('Internal server error');
    }
  });

  // GET /seo/robots.txt
  router.get('/robots.txt', (req, res) => {
    const baseUrl = process.env.BASE_URL || 'https://example.com';
    const robots = `User-agent: *
Allow: /
Disallow: /api/
Disallow: /search?*

Sitemap: ${baseUrl}/seo/sitemap.xml
`;
    res.set('Content-Type', 'text/plain');
    res.send(robots);
  });

  return router;
}

function generateSitemap(pages: ManifestPage[], baseUrl: string): string {
  const urls = pages
    .filter((p) => !p.isCustomIndex) // exclure les index customs
    .map((p) => {
      const loc = `${baseUrl}${p.route}`;
      const lastmod = p.publishedAt.toISOString().split('T')[0];
      const priority = p.route === '/' ? '1.0' : '0.8';
      return `  <url>
    <loc>${escapeXml(loc)}</loc>
    <lastmod>${lastmod}</lastmod>
    <changefreq>weekly</changefreq>
    <priority>${priority}</priority>
  </url>`;
    })
    .join('\n');

  return `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${urls}
</urlset>`;
}

function escapeXml(str: string): string {
  return str.replace(
    /[<>&'"]/g,
    (c) =>
      ({
        '<': '&lt;',
        '>': '&gt;',
        '&': '&amp;',
        "'": '&apos;',
        '"': '&quot;',
      })[c] || c
  );
}
```

**Intégration dans `apps/node/src/infra/http/express/app.ts` :**

```typescript
// Après les routes API existantes (ligne ~200)
import { createSeoController } from './controllers/seo.controller';

const manifestLoader = async () => {
  const fs = await import('fs/promises');
  const manifestPath = path.join(EnvConfig.contentRoot(), '_manifest.json');
  const raw = await fs.readFile(manifestPath, 'utf-8');
  return JSON.parse(raw);
};

const seoRouter = createSeoController(manifestLoader, rootLogger);
app.use('/seo', seoRouter);
```

**Variables d'environnement à ajouter :**

- `BASE_URL` : URL publique du site (ex: `https://example.com`)

#### **Fichier à créer : `apps/node/src/infra/config/env-config.ts` (ajout)**

```typescript
// Dans la classe EnvConfig existante, ajouter :
static baseUrl(): string {
  return process.env['BASE_URL'] || 'http://localhost:4200';
}
```

---

### 3.2 Frontend (Angular SSR) : Meta Tags Dynamiques

#### **Architecture proposée côté Angular :**

1. **Service central** : `SeoService` (génère meta tags depuis ManifestPage)
2. **Resolver/Guard** : `SeoResolver` (injecté sur routes `/**`)
3. **TransferState** : transfert SSR → CSR pour éviter double-fetch
4. **Structured Data** : composant ou service pour injecter `<script type="application/ld+json">`

#### **Fichier à créer : `apps/site/src/application/services/seo.service.ts`**

```typescript
import { Injectable, inject, PLATFORM_ID } from '@angular/core';
import { Meta, Title } from '@angular/platform-browser';
import { isPlatformServer } from '@angular/common';
import type { ManifestPage } from '@core-domain';

export interface SeoMetadata {
  title: string;
  description: string;
  canonical: string;
  ogTitle?: string;
  ogDescription?: string;
  ogImage?: string;
  ogType?: 'website' | 'article';
  twitterCard?: 'summary' | 'summary_large_image';
  jsonLd?: object[];
  robots?: string;
}

@Injectable({ providedIn: 'root' })
export class SeoService {
  private readonly meta = inject(Meta);
  private readonly title = inject(Title);
  private readonly platformId = inject(PLATFORM_ID);
  private readonly isServer = isPlatformServer(this.platformId);

  // Configuration par défaut (à charger depuis config repository)
  private readonly baseUrl = 'https://example.com'; // TODO: inject depuis CONFIG_REPOSITORY
  private readonly siteName = 'Mon Site Obsidian';
  private readonly defaultDescription = 'Knowledge base publié depuis Obsidian';
  private readonly defaultImage = '/assets/og-default.png';

  /**
   * Met à jour les meta tags pour une page depuis le manifest
   */
  updateForPage(page: ManifestPage, baseUrl = this.baseUrl): void {
    const metadata = this.buildMetadata(page, baseUrl);
    this.applyMetadata(metadata);
  }

  /**
   * Met à jour les meta tags pour la home page
   */
  updateForHome(baseUrl = this.baseUrl): void {
    const metadata: SeoMetadata = {
      title: this.siteName,
      description: this.defaultDescription,
      canonical: baseUrl,
      ogTitle: this.siteName,
      ogDescription: this.defaultDescription,
      ogImage: `${baseUrl}${this.defaultImage}`,
      ogType: 'website',
      twitterCard: 'summary_large_image',
      robots: 'index, follow',
      jsonLd: [this.generateWebSiteJsonLd(baseUrl)],
    };
    this.applyMetadata(metadata);
  }

  /**
   * Met à jour les meta tags pour la page de recherche
   */
  updateForSearch(baseUrl = this.baseUrl): void {
    const metadata: SeoMetadata = {
      title: `Recherche - ${this.siteName}`,
      description: 'Rechercher dans le knowledge base',
      canonical: `${baseUrl}/search`,
      robots: 'noindex, follow', // Pas d'indexation des résultats de recherche
    };
    this.applyMetadata(metadata);
  }

  /**
   * Construit les metadata depuis une ManifestPage
   */
  private buildMetadata(page: ManifestPage, baseUrl: string): SeoMetadata {
    const title = `${page.title} - ${this.siteName}`;
    const description = page.description || this.defaultDescription;
    const canonical = `${baseUrl}${page.route}`;
    const ogImage = this.findCoverImage(page) || `${baseUrl}${this.defaultImage}`;

    // Déterminer le type d'article depuis tags ou frontmatter
    const articleType = this.determineArticleType(page);

    const jsonLd: object[] = [
      this.generateArticleJsonLd(page, baseUrl, articleType),
      this.generateBreadcrumbJsonLd(page, baseUrl),
    ];

    return {
      title,
      description,
      canonical,
      ogTitle: page.title,
      ogDescription: description,
      ogImage,
      ogType: 'article',
      twitterCard: 'summary_large_image',
      robots: 'index, follow',
      jsonLd,
    };
  }

  /**
   * Applique les metadata au DOM (SSR + CSR)
   */
  private applyMetadata(metadata: SeoMetadata): void {
    // Title
    this.title.setTitle(metadata.title);

    // Description
    this.meta.updateTag({ name: 'description', content: metadata.description });

    // Canonical
    this.updateLinkTag('canonical', metadata.canonical);

    // Robots
    if (metadata.robots) {
      this.meta.updateTag({ name: 'robots', content: metadata.robots });
    }

    // Open Graph
    this.meta.updateTag({ property: 'og:title', content: metadata.ogTitle || metadata.title });
    this.meta.updateTag({
      property: 'og:description',
      content: metadata.ogDescription || metadata.description,
    });
    this.meta.updateTag({ property: 'og:url', content: metadata.canonical });
    this.meta.updateTag({ property: 'og:type', content: metadata.ogType || 'website' });
    if (metadata.ogImage) {
      this.meta.updateTag({ property: 'og:image', content: metadata.ogImage });
    }

    // Twitter Card
    this.meta.updateTag({ name: 'twitter:card', content: metadata.twitterCard || 'summary' });
    this.meta.updateTag({ name: 'twitter:title', content: metadata.ogTitle || metadata.title });
    this.meta.updateTag({
      name: 'twitter:description',
      content: metadata.ogDescription || metadata.description,
    });
    if (metadata.ogImage) {
      this.meta.updateTag({ name: 'twitter:image', content: metadata.ogImage });
    }

    // JSON-LD
    if (metadata.jsonLd && metadata.jsonLd.length > 0) {
      this.injectJsonLd(metadata.jsonLd);
    }
  }

  /**
   * Met à jour ou crée une balise <link> (ex: canonical)
   */
  private updateLinkTag(rel: string, href: string): void {
    if (this.isServer) {
      // Côté serveur, utiliser DOCUMENT injection si nécessaire
      // Pour l'instant, on laisse Angular gérer
    }

    // Chercher la balise existante
    const existing = document.querySelector(`link[rel="${rel}"]`);
    if (existing) {
      existing.setAttribute('href', href);
    } else {
      const link = document.createElement('link');
      link.rel = rel;
      link.href = href;
      document.head.appendChild(link);
    }
  }

  /**
   * Injecte les balises JSON-LD dans le <head>
   */
  private injectJsonLd(jsonLdArray: object[]): void {
    // Supprimer les anciens scripts JSON-LD
    document.querySelectorAll('script[type="application/ld+json"]').forEach((el) => el.remove());

    // Injecter les nouveaux
    jsonLdArray.forEach((jsonLd) => {
      const script = document.createElement('script');
      script.type = 'application/ld+json';
      script.textContent = JSON.stringify(jsonLd);
      document.head.appendChild(script);
    });
  }

  /**
   * Génère JSON-LD Article/BlogPosting/TechArticle
   */
  private generateArticleJsonLd(page: ManifestPage, baseUrl: string, type: string): object {
    return {
      '@context': 'https://schema.org',
      '@type': type,
      headline: page.title,
      description: page.description || '',
      url: `${baseUrl}${page.route}`,
      datePublished: page.publishedAt.toISOString(),
      dateModified: page.publishedAt.toISOString(), // TODO: ajouter lastModified dans manifest
      author: {
        '@type': 'Person',
        name: 'Auteur', // TODO: récupérer depuis config
      },
      publisher: {
        '@type': 'Organization',
        name: this.siteName,
        logo: {
          '@type': 'ImageObject',
          url: `${baseUrl}/assets/logo.png`, // TODO: configurable
        },
      },
      image: this.findCoverImage(page) || `${baseUrl}${this.defaultImage}`,
      keywords: page.tags?.join(', ') || '',
    };
  }

  /**
   * Génère JSON-LD BreadcrumbList depuis le path de la page
   */
  private generateBreadcrumbJsonLd(page: ManifestPage, baseUrl: string): object {
    const segments = page.route.split('/').filter(Boolean);
    const items = [
      { name: 'Home', url: baseUrl },
      ...segments.map((seg, idx) => ({
        name: this.capitalize(seg.replace(/-/g, ' ')),
        url: `${baseUrl}/${segments.slice(0, idx + 1).join('/')}`,
      })),
    ];

    return {
      '@context': 'https://schema.org',
      '@type': 'BreadcrumbList',
      itemListElement: items.map((item, idx) => ({
        '@type': 'ListItem',
        position: idx + 1,
        name: item.name,
        item: item.url,
      })),
    };
  }

  /**
   * Génère JSON-LD WebSite + SearchAction
   */
  private generateWebSiteJsonLd(baseUrl: string): object {
    return {
      '@context': 'https://schema.org',
      '@type': 'WebSite',
      name: this.siteName,
      url: baseUrl,
      potentialAction: {
        '@type': 'SearchAction',
        target: {
          '@type': 'EntryPoint',
          urlTemplate: `${baseUrl}/search?q={search_term_string}`,
        },
        'query-input': 'required name=search_term_string',
      },
    };
  }

  /**
   * Détermine le type d'article JSON-LD depuis les tags
   */
  private determineArticleType(page: ManifestPage): string {
    if (!page.tags || page.tags.length === 0) return 'Article';

    if (page.tags.some((t) => /tech|code|dev|programming/i.test(t))) {
      return 'TechArticle';
    }
    if (page.tags.some((t) => /blog|post/i.test(t))) {
      return 'BlogPosting';
    }
    return 'Article';
  }

  /**
   * Recherche une image de couverture dans les assets de la page
   */
  private findCoverImage(page: ManifestPage): string | null {
    // TODO: implémenter recherche depuis frontmatter.coverImage ou premier asset
    // Pour l'instant, retourne null
    return null;
  }

  private capitalize(str: string): string {
    return str.charAt(0).toUpperCase() + str.slice(1);
  }
}
```

#### **Fichier à créer : `apps/site/src/application/resolvers/seo.resolver.ts`**

```typescript
import { inject } from '@angular/core';
import { ResolveFn, Router } from '@angular/router';
import { CatalogFacade } from '../facades/catalog-facade';
import { SeoService } from '../services/seo.service';

/**
 * Resolver qui configure les meta tags SEO avant le rendu de la page
 */
export const seoResolver: ResolveFn<void> = async (route, state) => {
  const router = inject(Router);
  const catalog = inject(CatalogFacade);
  const seo = inject(SeoService);

  const routePath = state.url.split('?')[0].split('#')[0];
  const normalized = routePath.replace(/\/+$/, '') || '/';

  // Home page
  if (normalized === '/') {
    seo.updateForHome();
    return;
  }

  // Search page
  if (normalized === '/search') {
    seo.updateForSearch();
    return;
  }

  // Content page
  await catalog.ensureManifestLoaded();
  const manifest = catalog.manifest();
  const page = manifest.pages.find((p) => p.route === normalized);

  if (page) {
    seo.updateForPage(page);
  } else {
    // Page 404 : pas de meta spéciale (ou meta 404 custom)
    seo.updateForHome(); // Fallback
  }
};
```

#### **Modification : `apps/site/src/presentation/routes/app.routes.ts`**

```typescript
import { type Routes } from '@angular/router';
import { seoResolver } from '../../application/resolvers/seo.resolver';
import { ShellComponent } from '../shell/shell.component';

export const APP_ROUTES: Routes = [
  {
    path: '',
    component: ShellComponent,
    children: [
      {
        path: '',
        pathMatch: 'full',
        loadComponent: () => import('../pages/home/home.component').then((m) => m.HomeComponent),
        resolve: { seo: seoResolver }, // Inject resolver
      },
      {
        path: 'search',
        loadComponent: () =>
          import('../pages/search/search-content.component').then((m) => m.SearchContentComponent),
        resolve: { seo: seoResolver },
      },
      {
        path: '**',
        loadComponent: () =>
          import('../pages/viewer/viewer.component').then((m) => m.ViewerComponent),
        resolve: { seo: seoResolver },
      },
    ],
  },
];
```

---

### 3.3 Entités & Frontmatter : Extensions nécessaires

#### **Fichier à modifier : `libs/core-domain/src/lib/entities/manifest-page.ts`**

**Ajouts proposés :**

```typescript
export interface ManifestPage {
  id: string;
  title: string;
  slug: Slug;
  route: string;
  description?: string;
  publishedAt: Date;
  lastModifiedAt?: Date; // NOUVEAU : pour sitemap + JSON-LD dateModified

  vaultPath?: string;
  relativePath?: string;
  tags?: string[];
  leafletBlocks?: LeafletBlock[];

  isCustomIndex?: boolean;

  // NOUVEAU : SEO-specific fields
  coverImage?: string; // URL relative ou absolue vers image de couverture
  canonicalSlug?: string; // Pour gérer les slug history (redirections)
  noIndex?: boolean; // Pour exclure du sitemap (pages draft ou privées)
}
```

#### **Fichier à modifier : `libs/core-application/src/lib/vault-parsing/handlers/normalize-frontmatter.handler.ts`**

**Ajout de la normalisation :**

```typescript
// Ajouter dans la fonction normalize() :
lastModifiedAt: raw.lastModifiedAt ? new Date(raw.lastModifiedAt) : undefined,
coverImage: raw.coverImage || raw.cover || undefined,
canonicalSlug: raw.canonicalSlug || undefined,
noIndex: raw.noIndex === true || raw['no-index'] === true,
```

#### **Fichier à modifier : `apps/node/src/infra/markdown/markdown-it.renderer.ts`**

**Ajouter extraction de coverImage depuis le HTML :**

```typescript
// Dans la méthode render(), après la conversion HTML :
private extractCoverImage(html: string): string | null {
  const imgMatch = html.match(/<img[^>]+src="([^"]+)"/);
  return imgMatch ? imgMatch[1] : null;
}

// Dans buildManifestPage() :
const coverImage = note.frontmatter?.coverImage || this.extractCoverImage(html);

return {
  // ... existing fields
  coverImage,
  lastModifiedAt: note.frontmatter?.lastModifiedAt,
  noIndex: note.frontmatter?.noIndex,
};
```

---

### 3.4 Gestion des Redirections (Slug History)

#### **Problème :**

Si un utilisateur change le titre d'une note Obsidian, le slug change → URL cassée → 404

#### **Solution : Canonical Mapping + Redirections 301**

##### **Fichier à créer : `libs/core-domain/src/lib/entities/manifest.ts` (extension)**

```typescript
export interface Manifest {
  sessionId: string;
  createdAt: Date;
  lastUpdatedAt: Date;
  pages: ManifestPage[];
  folderDisplayNames?: Record<string, string>;

  // NOUVEAU : mapping oldSlug → newSlug pour redirections
  canonicalMap?: Record<string, string>; // { "/old-route": "/new-route" }
}
```

##### **Fichier à créer : `apps/node/src/infra/http/express/middleware/redirect.middleware.ts`**

```typescript
import type { Request, Response, NextFunction } from 'express';
import type { Manifest } from '@core-domain';

export function createRedirectMiddleware(manifestLoader: () => Promise<Manifest>) {
  return async (req: Request, res: Response, next: NextFunction) => {
    try {
      const manifest = await manifestLoader();
      if (!manifest.canonicalMap) return next();

      const normalized = req.path.replace(/\/+$/, '') || '/';
      const newRoute = manifest.canonicalMap[normalized];

      if (newRoute && newRoute !== normalized) {
        return res.redirect(301, newRoute);
      }

      next();
    } catch (err) {
      next(); // En cas d'erreur, laisser passer
    }
  };
}
```

##### **Intégration dans `apps/node/src/infra/http/express/app.ts` :**

```typescript
// Avant le routing Angular (ligne ~130)
import { createRedirectMiddleware } from './middleware/redirect.middleware';

app.use(createRedirectMiddleware(manifestLoader));
```

##### **Logique de détection des slug changes (Plugin) :**

```typescript
// Dans le plugin, avant upload :
// 1. Télécharger le manifest actuel
// 2. Pour chaque note, vérifier si noteId existe avec un slug différent
// 3. Si oui, ajouter mapping dans manifest.canonicalMap
// 4. Uploader avec le nouveau manifest

// Exemple dans UploadNotesHandler :
const oldManifest = await manifestLoader();
const canonicalMap: Record<string, string> = { ...(oldManifest.canonicalMap || {}) };

for (const note of notes) {
  const oldPage = oldManifest.pages.find((p) => p.id === note.noteId);
  if (oldPage && oldPage.route !== note.routing.fullPath) {
    canonicalMap[oldPage.route] = note.routing.fullPath;
  }
}

newManifest.canonicalMap = canonicalMap;
```

---

### 3.5 Cache & Invalidation

#### **Stratégie proposée :**

1. **Sitemap.xml** :
   - Cache : `max-age=3600` (1h client), `s-maxage=86400` (24h CDN)
   - ETag : `W/"${manifest.lastUpdatedAt.getTime()}"`
   - Invalidation : automatique via ETag check

2. **Manifest** :
   - Cache existant (localStorage + in-memory) conservé
   - Ajout d'un header `Last-Modified` côté backend

3. **Content HTML** :
   - Cache actuel : `no-cache` (correct pour du contenu dynamique)
   - Alternative : `max-age=300` (5min) avec ETag si les pages ne changent pas souvent

#### **Modification : `apps/node/src/infra/http/express/app.ts`**

```typescript
// Remplacer le middleware disableCache par un cache conditionnel :
const contentCache = (req: express.Request, res: express.Response, next: express.NextFunction) => {
  // Pour _manifest.json : cache court avec ETag
  if (req.path.endsWith('_manifest.json')) {
    res.setHeader('Cache-Control', 'public, max-age=300, must-revalidate');
    return next();
  }

  // Pour le HTML : cache court avec revalidation
  if (req.path.endsWith('.html')) {
    res.setHeader('Cache-Control', 'public, max-age=300, must-revalidate');
    return next();
  }

  // Autres fichiers content : no-cache
  res.setHeader('Cache-Control', 'no-store, no-cache');
  next();
};

app.use('/content', contentCache, express.static(EnvConfig.contentRoot(), { etag: true }));
```

---

### 3.6 Tests (Unit + E2E)

#### **Tests unitaires à ajouter :**

1. **Backend (apps/node/src/\_tests/) :**
   - `seo.controller.test.ts` : test génération sitemap.xml + robots.txt + ETags
   - `redirect.middleware.test.ts` : test redirections 301 depuis canonicalMap

2. **Frontend (apps/site/src/\_tests/) :**
   - `seo.service.test.ts` : test génération meta tags + JSON-LD
   - `seo.resolver.test.ts` : test injection resolver sur routes

#### **Tests E2E (apps/site/e2e/) :**

**Fichier à créer : `apps/site/e2e/seo.spec.ts`**

```typescript
import { test, expect } from '@playwright/test';

test.describe('SEO Meta Tags', () => {
  test('home page has correct meta tags', async ({ page }) => {
    await page.goto('/');

    // Title
    await expect(page).toHaveTitle(/Mon Site Obsidian/);

    // Meta description
    const desc = await page.locator('meta[name="description"]').getAttribute('content');
    expect(desc).toContain('Knowledge base');

    // Canonical
    const canonical = await page.locator('link[rel="canonical"]').getAttribute('href');
    expect(canonical).toBe('https://example.com/');

    // Open Graph
    const ogTitle = await page.locator('meta[property="og:title"]').getAttribute('content');
    expect(ogTitle).toBeTruthy();

    // JSON-LD WebSite
    const jsonLd = await page.locator('script[type="application/ld+json"]').first().textContent();
    const data = JSON.parse(jsonLd!);
    expect(data['@type']).toBe('WebSite');
  });

  test('content page has article structured data', async ({ page }) => {
    // Supposons qu'une page /docs/test existe
    await page.goto('/docs/test');

    const jsonLd = await page.locator('script[type="application/ld+json"]').allTextContents();
    const articles = jsonLd.map((t) => JSON.parse(t)).filter((d) => d['@type'].includes('Article'));

    expect(articles.length).toBeGreaterThan(0);
    expect(articles[0]).toHaveProperty('headline');
    expect(articles[0]).toHaveProperty('datePublished');
  });

  test('search page has noindex', async ({ page }) => {
    await page.goto('/search');

    const robots = await page.locator('meta[name="robots"]').getAttribute('content');
    expect(robots).toContain('noindex');
  });
});

test.describe('Sitemap & Robots', () => {
  test('sitemap.xml is accessible and valid', async ({ page }) => {
    const response = await page.goto('/seo/sitemap.xml');
    expect(response?.status()).toBe(200);
    expect(response?.headers()['content-type']).toContain('application/xml');

    const xml = await response?.text();
    expect(xml).toContain('<?xml version');
    expect(xml).toContain('<urlset');
  });

  test('robots.txt is accessible', async ({ page }) => {
    const response = await page.goto('/seo/robots.txt');
    expect(response?.status()).toBe(200);

    const txt = await response?.text();
    expect(txt).toContain('User-agent: *');
    expect(txt).toContain('Sitemap:');
  });
});

test.describe('Redirections', () => {
  test('old slug redirects to new slug (301)', async ({ page, context }) => {
    // Supposons qu'un mapping /old-route → /new-route existe
    const response = await page.goto('/old-route', { waitUntil: 'commit' });

    expect(response?.status()).toBe(301);
    expect(response?.url()).toContain('/new-route');
  });
});
```

---

## 4. PLAN DE MODIFICATIONS PR-READY

### 4.1 Fichiers à créer

#### Backend (Node/Express)

1. ✅ `apps/node/src/infra/http/express/controllers/seo.controller.ts`
2. ✅ `apps/node/src/infra/http/express/middleware/redirect.middleware.ts`
3. ✅ `apps/node/src/_tests/seo.controller.test.ts`
4. ✅ `apps/node/src/_tests/redirect.middleware.test.ts`

#### Frontend (Angular)

5. ✅ `apps/site/src/application/services/seo.service.ts`
6. ✅ `apps/site/src/application/resolvers/seo.resolver.ts`
7. ✅ `apps/site/src/_tests/seo.service.test.ts`
8. ✅ `apps/site/src/_tests/seo.resolver.test.ts`
9. ✅ `apps/site/e2e/seo.spec.ts`

#### Documentation

10. ✅ `docs/SEO-STRATEGY.md` (ce fichier)
11. ✅ `docs/site/seo.md` (guide utilisateur)

### 4.2 Fichiers à modifier

#### Domain Layer

1. ✅ `libs/core-domain/src/lib/entities/manifest-page.ts` (ajout champs SEO)
2. ✅ `libs/core-domain/src/lib/entities/manifest.ts` (ajout canonicalMap)

#### Application Layer

3. ✅ `libs/core-application/src/lib/vault-parsing/handlers/normalize-frontmatter.handler.ts`

#### Backend

4. ✅ `apps/node/src/infra/http/express/app.ts` (intégration SEO router + redirect middleware)
5. ✅ `apps/node/src/infra/config/env-config.ts` (ajout BASE_URL)
6. ✅ `apps/node/src/infra/markdown/markdown-it.renderer.ts` (extraction coverImage)

#### Frontend

7. ✅ `apps/site/src/presentation/routes/app.routes.ts` (ajout resolver)
8. ✅ `apps/site/src/presentation/app.config.ts` (potentiel : config BASE_URL)

#### Config/Env

9. ✅ `.env.dev.example` et `.env.prod.example` (ajout BASE_URL)
10. ✅ `docker-compose.yml` (ajout variable BASE_URL)

### 4.3 Ordre d'implémentation recommandé (PRs séparées)

#### **PR #1 : Domain + Application Layer (SEO fields)**

- Modifier `manifest-page.ts` + `manifest.ts`
- Modifier `normalize-frontmatter.handler.ts`
- Ajouter tests unitaires
- **Objectif :** Préparer les entités domain sans casser l'existant

#### **PR #2 : Backend SEO API**

- Créer `seo.controller.ts`
- Intégrer dans `app.ts`
- Ajouter `BASE_URL` dans env-config
- Tests unitaires + intégration
- **Objectif :** Exposer `/seo/sitemap.xml` et `/seo/robots.txt`

#### **PR #3 : Frontend SEO Service + Resolver**

- Créer `seo.service.ts` + `seo.resolver.ts`
- Intégrer dans `app.routes.ts`
- Tests unitaires
- **Objectif :** Meta tags dynamiques en SSR

#### **PR #4 : Redirections (Canonical Mapping)**

- Créer `redirect.middleware.ts`
- Modifier plugin pour détecter slug changes
- Tests E2E redirections
- **Objectif :** Gestion des slug history

#### **PR #5 : Optimisations Cache**

- Modifier cache headers dans `app.ts`
- Ajouter ETags conditionnels
- Tests de performance
- **Objectif :** Core Web Vitals

#### **PR #6 : Tests E2E + Documentation**

- Créer `seo.spec.ts`
- Compléter `docs/site/seo.md`
- Validation finale
- **Objectif :** Garantir la non-régression

---

## 5. EXEMPLES DE RENDU FINAL

### 5.1 HTML Head SSR pour une page de contenu

```html
<!DOCTYPE html>
<html lang="fr">
  <head>
    <meta charset="utf-8" />
    <title>Guide de Démarrage - Mon Site Obsidian</title>
    <meta
      name="description"
      content="Ce guide explique comment installer et configurer le plugin Obsidian VPS Publish."
    />
    <meta name="viewport" content="width=device-width, initial-scale=1" />

    <!-- Canonical -->
    <link rel="canonical" href="https://example.com/docs/guide-demarrage" />

    <!-- Robots -->
    <meta name="robots" content="index, follow" />

    <!-- Open Graph -->
    <meta property="og:title" content="Guide de Démarrage" />
    <meta
      property="og:description"
      content="Ce guide explique comment installer et configurer le plugin Obsidian VPS Publish."
    />
    <meta property="og:url" content="https://example.com/docs/guide-demarrage" />
    <meta property="og:type" content="article" />
    <meta property="og:image" content="https://example.com/assets/covers/guide.png" />

    <!-- Twitter Card -->
    <meta name="twitter:card" content="summary_large_image" />
    <meta name="twitter:title" content="Guide de Démarrage" />
    <meta
      name="twitter:description"
      content="Ce guide explique comment installer et configurer le plugin Obsidian VPS Publish."
    />
    <meta name="twitter:image" content="https://example.com/assets/covers/guide.png" />

    <!-- JSON-LD: Article -->
    <script type="application/ld+json">
      {
        "@context": "https://schema.org",
        "@type": "TechArticle",
        "headline": "Guide de Démarrage",
        "description": "Ce guide explique comment installer et configurer le plugin Obsidian VPS Publish.",
        "url": "https://example.com/docs/guide-demarrage",
        "datePublished": "2026-01-10T10:00:00.000Z",
        "dateModified": "2026-01-12T14:30:00.000Z",
        "author": {
          "@type": "Person",
          "name": "Jonathan Rouquette"
        },
        "publisher": {
          "@type": "Organization",
          "name": "Mon Site Obsidian",
          "logo": {
            "@type": "ImageObject",
            "url": "https://example.com/assets/logo.png"
          }
        },
        "image": "https://example.com/assets/covers/guide.png",
        "keywords": "obsidian, vps, publish, guide, installation"
      }
    </script>

    <!-- JSON-LD: BreadcrumbList -->
    <script type="application/ld+json">
      {
        "@context": "https://schema.org",
        "@type": "BreadcrumbList",
        "itemListElement": [
          {
            "@type": "ListItem",
            "position": 1,
            "name": "Home",
            "item": "https://example.com"
          },
          {
            "@type": "ListItem",
            "position": 2,
            "name": "Docs",
            "item": "https://example.com/docs"
          },
          {
            "@type": "ListItem",
            "position": 3,
            "name": "Guide demarrage",
            "item": "https://example.com/docs/guide-demarrage"
          }
        ]
      }
    </script>

    <base href="/" />
    <!-- ... rest of head ... -->
  </head>
  <body>
    <!-- ... Angular app ... -->
  </body>
</html>
```

### 5.2 HTML Head SSR pour la home page

```html
<!DOCTYPE html>
<html lang="fr">
  <head>
    <meta charset="utf-8" />
    <title>Mon Site Obsidian</title>
    <meta
      name="description"
      content="Knowledge base publié depuis Obsidian - Guides, tutoriels et documentation technique."
    />
    <meta name="viewport" content="width=device-width, initial-scale=1" />

    <link rel="canonical" href="https://example.com/" />
    <meta name="robots" content="index, follow" />

    <meta property="og:title" content="Mon Site Obsidian" />
    <meta
      property="og:description"
      content="Knowledge base publié depuis Obsidian - Guides, tutoriels et documentation technique."
    />
    <meta property="og:url" content="https://example.com/" />
    <meta property="og:type" content="website" />
    <meta property="og:image" content="https://example.com/assets/og-default.png" />

    <meta name="twitter:card" content="summary_large_image" />
    <meta name="twitter:title" content="Mon Site Obsidian" />
    <meta
      name="twitter:description"
      content="Knowledge base publié depuis Obsidian - Guides, tutoriels et documentation technique."
    />
    <meta name="twitter:image" content="https://example.com/assets/og-default.png" />

    <script type="application/ld+json">
      {
        "@context": "https://schema.org",
        "@type": "WebSite",
        "name": "Mon Site Obsidian",
        "url": "https://example.com",
        "potentialAction": {
          "@type": "SearchAction",
          "target": {
            "@type": "EntryPoint",
            "urlTemplate": "https://example.com/search?q={search_term_string}"
          },
          "query-input": "required name=search_term_string"
        }
      }
    </script>

    <base href="/" />
  </head>
  <body>
    <!-- ... Angular app ... -->
  </body>
</html>
```

### 5.3 HTML Head SSR pour la page de recherche

```html
<!DOCTYPE html>
<html lang="fr">
  <head>
    <meta charset="utf-8" />
    <title>Recherche - Mon Site Obsidian</title>
    <meta name="description" content="Rechercher dans le knowledge base" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />

    <link rel="canonical" href="https://example.com/search" />
    <meta name="robots" content="noindex, follow" />

    <base href="/" />
  </head>
  <body>
    <!-- ... Angular app ... -->
  </body>
</html>
```

### 5.4 Exemple de sitemap.xml généré

```xml
<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
  <url>
    <loc>https://example.com/</loc>
    <lastmod>2026-01-12</lastmod>
    <changefreq>weekly</changefreq>
    <priority>1.0</priority>
  </url>
  <url>
    <loc>https://example.com/docs/guide-demarrage</loc>
    <lastmod>2026-01-10</lastmod>
    <changefreq>weekly</changefreq>
    <priority>0.8</priority>
  </url>
  <url>
    <loc>https://example.com/docs/architecture</loc>
    <lastmod>2026-01-08</lastmod>
    <changefreq>weekly</changefreq>
    <priority>0.8</priority>
  </url>
  <!-- ... autres pages ... -->
</urlset>
```

### 5.5 Exemple de robots.txt généré

```txt
User-agent: *
Allow: /
Disallow: /api/
Disallow: /search?*

Sitemap: https://example.com/seo/sitemap.xml
```

---

## 6. HYPOTHÈSES & ALTERNATIVES

### Hypothèses faites

1. **BASE_URL est configurable via env variable**
   - Alternative : hardcodé temporairement, puis extrait depuis `CONFIG_REPOSITORY`

2. **Le manifest contient déjà publishedAt (Date)**
   - Alternative : si absent, générer depuis `createdAt` ou timestamp actuel

3. **Les pages ont des descriptions dans le frontmatter**
   - Alternative : générer description depuis les 160 premiers caractères du HTML

4. **Pas d'i18n (hreflang) actuellement**
   - Alternative : si i18n nécessaire, ajouter `locale: string` dans ManifestPage + générer hreflang

5. **Pas de pagination dans /search**
   - Alternative : si pagination ajoutée, implémenter `rel="prev"` / `rel="next"` dans SeoService

6. **Les redirections 301 sont gérées côté Node (middleware Express)**
   - Alternative : si CDN/proxy utilisé, générer un fichier `_redirects` (Netlify/Vercel style)

7. **Les assets ont des URLs stables (pas de cache busting)**
   - Alternative : si cache busting via hash, inclure dans coverImage URL

### Robustesse si hypothèses fausses

- **Si BASE_URL manquant** : utiliser un détecteur côté SSR (`req.protocol + req.headers.host`)
- **Si description manquante** : tronquer le HTML brut (strip tags + 160 chars)
- **Si publishedAt manquant** : fallback sur `lastUpdatedAt` ou `new Date(0)`
- **Si manifest.canonicalMap absent** : les redirections sont simplement désactivées (pas de 404)

---

## 7. IMPACTS SUR L'ARCHITECTURE EXISTANTE

### ✅ Impacts positifs

1. **Aucune rupture d'URL** : les routes existantes restent identiques
2. **Aucun impact sur le plugin** : le frontmatter est déjà extensible
3. **Aucun impact sur le rendering Markdown** : le HTML reste inchangé
4. **Performance améliorée** : cache sitemap + ETag → moins de calculs
5. **Observabilité** : les logs existants (LoggerPort) couvrent déjà le SEO controller

### ⚠️ Points d'attention

1. **Taille du manifest** : si >1000 pages, considérer un sitemap index (multiple sitemaps)
2. **Invalidation du cache** : si manifest change souvent, ajuster `max-age` du sitemap
3. **Hydration** : vérifier que les meta tags SSR ne sont pas dupliqués en CSR (Angular gère bien normalement)
4. **Compatibilité crawlers** : tester avec Google Search Console + Bing Webmaster Tools

---

## 8. CHECKLIST DE VALIDATION FINALE

### Avant merge en production :

- [ ] Tous les tests unitaires passent (backend + frontend)
- [ ] Tous les tests E2E passent (meta tags + sitemap + redirections)
- [ ] Validation manuelle :
  - [ ] `curl -I https://example.com/seo/sitemap.xml` → 200 + ETag
  - [ ] `curl https://example.com/seo/robots.txt` → contenu valide
  - [ ] Inspecter `<head>` d'une page de contenu → meta tags présents
  - [ ] Tester redirection : `curl -I https://example.com/old-route` → 301
- [ ] Performance :
  - [ ] Lighthouse SEO score ≥ 95
  - [ ] Core Web Vitals : LCP < 2.5s, FID < 100ms, CLS < 0.1
- [ ] Documentation :
  - [ ] `docs/site/seo.md` à jour
  - [ ] `docs/README.md` référence le nouveau doc
  - [ ] Variables d'env documentées dans `.env.*.example`
- [ ] Soumission :
  - [ ] Soumettre sitemap.xml à Google Search Console
  - [ ] Soumettre sitemap.xml à Bing Webmaster Tools
  - [ ] Vérifier indexation après 48h

---

## 9. CONCLUSION & NEXT STEPS

Cette stratégie SEO propose une **approche dynamique et évolutive**, respectant strictement :

- L'architecture Clean Architecture existante (domain → application → infra)
- Les routes dynamiques basées sur le manifest
- La performance SSR (pas de double-fetch)
- La maintenabilité (pas de hardcode, configuration centralisée)

### Bénéfices attendus :

1. **Indexation optimale** : Google/Bing peuvent crawler et indexer toutes les pages
2. **Rich snippets** : structured data → affichage amélioré dans les SERP
3. **Expérience utilisateur** : partages sociaux avec previews (Open Graph)
4. **Résilience** : redirections automatiques lors de changements de routes
5. **Observabilité** : logs + tests garantissent la stabilité

### Mesures de succès (KPIs) :

- Lighthouse SEO score : passer de ~65 à ≥ 95
- Pages indexed : vérifier via Google Search Console (toutes les pages du manifest)
- Click-through rate (CTR) : amélioration de 10-20% avec meta descriptions optimisées
- Core Web Vitals : conserver LCP < 2.5s avec SSR

**Prochaine étape recommandée : implémenter PR #1 (Domain Layer) pour valider l'approche sans risque.**
