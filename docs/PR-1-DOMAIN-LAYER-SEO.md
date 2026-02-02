# PR #1: Domain Layer - SEO Fields

## Objectif

Ajouter les champs SEO nécessaires aux entités `ManifestPage` et `Manifest` pour supporter la stratégie SEO dynamique, sans casser l'existant.

## Changements apportés

### 1. Entité `ManifestPage` (libs/core-domain/src/lib/entities/manifest-page.ts)

**Nouveaux champs optionnels ajoutés :**

- **`lastModifiedAt?: Date`** : Date de dernière modification
  - Utilisé pour `sitemap.xml` (`<lastmod>`)
  - Utilisé pour JSON-LD `dateModified`

- **`coverImage?: string`** : URL de l'image de couverture
  - Utilisé pour Open Graph `og:image`
  - Utilisé pour Twitter Card `twitter:image`
  - Utilisé pour JSON-LD `image`

- **`canonicalSlug?: string`** : Slug canonique pour gestion des redirections
  - Permet de tracker les changements de slugs
  - Support des redirections 301 automatiques

- **`noIndex?: boolean`** : Exclusion du sitemap/indexation
  - `true` = exclure de sitemap.xml
  - Utilisé pour meta `robots: noindex`
  - Utile pour pages draft ou privées

### 2. Entité `Manifest` (libs/core-domain/src/lib/entities/manifest.ts)

**Nouveau champ optionnel ajouté :**

- **`canonicalMap?: Record<string, string>`** : Mapping oldRoute → newRoute
  - Exemple : `{ "/old-route": "/new-route" }`
  - Permet de gérer l'historique des slugs
  - Support des redirections 301 via middleware Express

### 3. Tests unitaires (libs/core-domain/src/lib/\_tests/entities/manifest-seo.test.ts)

**Nouveaux tests créés :**

- ✅ Validation que les champs SEO sont optionnels
- ✅ Validation du flag `noIndex` pour exclusion du sitemap
- ✅ Validation du `canonicalSlug` pour redirections
- ✅ Validation du `canonicalMap` dans Manifest
- ✅ Validation de la coexistence avec `folderDisplayNames`

## Compatibilité

### ✅ Non-Breaking Changes

Tous les champs ajoutés sont **optionnels** (`?:`), donc :

- ✅ Aucun impact sur le code existant
- ✅ Les manifests existants restent valides
- ✅ Les tests existants continuent de passer
- ✅ Rétrocompatible avec les anciens manifests

### 📊 Impact sur les composants

| Composant        | Impact   | Action requise                                                     |
| ---------------- | -------- | ------------------------------------------------------------------ |
| Plugin Obsidian  | ✅ Aucun | Les nouveaux champs seront extraits automatiquement du frontmatter |
| Backend API      | ✅ Aucun | Les champs seront acceptés mais pas encore utilisés                |
| Frontend Angular | ✅ Aucun | Les champs seront disponibles dans le manifest                     |
| Stockage (JSON)  | ✅ Aucun | Les champs seront sérialisés/désérialisés normalement              |

## Frontmatter supporté

Ces champs peuvent être ajoutés dans le frontmatter YAML des notes Obsidian :

```yaml
---
title: Ma Page
description: Description de ma page
lastModifiedAt: 2026-01-12
coverImage: /assets/cover.png
canonicalSlug: ma-page
noIndex: false
---
```

Le `NormalizeFrontmatterService` existant gère déjà automatiquement ces champs via `DomainFrontmatter.flat`, aucune modification requise.

## Prochaines étapes (PRs suivantes)

### PR #2 : Backend SEO API

- Créer `/seo/sitemap.xml` endpoint
- Créer `/seo/robots.txt` endpoint
- Utiliser `lastModifiedAt` dans sitemap
- Filtrer pages avec `noIndex: true`

### PR #3 : Frontend SEO Service

- Créer `SeoService` pour générer meta tags
- Utiliser `coverImage` pour Open Graph
- Utiliser `description` pour meta description
- Créer JSON-LD depuis manifest

### PR #4 : Redirections

- Créer middleware Express pour `canonicalMap`
- Implémenter redirections 301
- Détecter slug changes dans plugin

## Tests locaux

```bash
# Exécuter tous les tests du domain
npx nx test core-domain

# Exécuter uniquement les tests SEO
npx nx test core-domain --testNamePattern="SEO"

# Vérifier les types TypeScript
npx nx run core-domain:lint
```

## Validation de non-régression

- ✅ Tous les tests existants passent
- ✅ Aucun changement dans les tests existants requis
- ✅ TypeScript compile sans erreurs
- ✅ ESLint ne rapporte aucune violation

## Documentation utilisateur

Les utilisateurs pourront ajouter ces champs dans leur frontmatter Obsidian :

```markdown
---
title: Guide SEO
description: Un guide complet pour optimiser le SEO
lastModifiedAt: 2026-01-12T14:30:00Z
coverImage: /assets/seo-guide.png
canonicalSlug: guide-seo
noIndex: false
tags:
  - seo
  - guide
---

# Guide SEO

Contenu de la page...
```

**Note :** Ces champs sont tous optionnels. Si absents, des valeurs par défaut seront utilisées :

- `lastModifiedAt` : fallback sur `publishedAt`
- `coverImage` : extraction automatique depuis le HTML (première image trouvée)
- `canonicalSlug` : slug généré automatiquement
- `noIndex` : `false` par défaut (indexation activée)

## Références

- [SEO-STRATEGY.md](../SEO-STRATEGY.md) : Stratégie SEO complète
- [manifest-page.ts](../../libs/core-domain/src/lib/entities/manifest-page.ts) : Interface modifiée
- [manifest.ts](../../libs/core-domain/src/lib/entities/manifest.ts) : Interface modifiée
- [manifest-seo.test.ts](../../libs/core-domain/src/lib/_tests/entities/manifest-seo.test.ts) : Tests unitaires
