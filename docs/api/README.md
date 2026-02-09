# Documentation Backend Node.js (API)

> **English version:** [docs/en/api/](../en/api/)

Cette section contient la documentation relative au backend Node.js (`apps/node`) : l'API Express qui gère l'upload, le stockage, et le rendu du contenu publié.

## 🎯 Vue d'ensemble

Le backend Node.js/Express :

- Expose une API REST sécurisée (`/api/**`) avec authentification par `x-api-key`
- Gère le workflow de publication par session (start, upload notes/assets, finish/abort)
- Rend le Markdown en HTML avec support avancé (wikilinks, footnotes, Dataview)
- Sert le contenu statique (pages, assets, SPA Angular)
- Maintient un manifeste de contenu (`_manifest.json`)

## 📄 Documentation disponible

### Rendu de contenu

- **[Link Normalization](./link-normalization.md)** - Normalisation des liens pour uniformité du routing et du style

### Logging et observabilité

- **[Logging](./logging.md)** - Système de logging : niveaux, configuration, sortie console/fichier

### Performance et tests de charge

- **[Performance](./performance.md)** - Optimisations API, métriques, configuration, diagnostics
- **[Load Testing](./load-testing.md)** - Tests de charge Artillery : profils, configuration, interprétation des résultats

## 🚀 Démarrage rapide

### Prérequis

- Node.js 20+
- Variables d'environnement configurées (voir `.env.dev.example`)

### Lancement en dev

```bash
npm install
npm run start node
```

L'API démarre sur `http://localhost:3000`.

### Build de production

```bash
npm run build node
```

Les artefacts sont générés dans `dist/apps/node/`.

## 🛠️ Configuration

Le backend utilise des variables d'environnement :

### Variables obligatoires

- **`API_KEY`** : Clé d'authentification pour `/api/**`

### Variables de stockage

- **`CONTENT_ROOT`** (défaut `/content`) : Stockage du HTML rendu + `_manifest.json`
- **`ASSETS_ROOT`** (défaut `/assets`) : Stockage des fichiers binaires (images, PDFs, etc.)
- **`UI_ROOT`** (défaut `/ui`) : Fichiers statiques du SPA Angular

### Variables réseau

- **`PORT`** (défaut `3000`) : Port d'écoute HTTP
- **`ALLOWED_ORIGINS`** : Origines autorisées pour CORS (séparées par virgules)

### Variables de métadonnées

- **`SITE_NAME`** : Nom du site (exposé via `/public-config`)
- **`AUTHOR`** : Auteur du site
- **`REPO_URL`** : URL du dépôt GitHub
- **`REPORT_ISSUES_URL`** : URL pour signaler des bugs

### Variables de logging

- **`LOGGER_LEVEL`** (défaut `info`) : Niveau de log (`debug`, `info`, `warn`, `error`)
- **`NODE_ENV`** : Environnement (`development`, `production`)

Voir `.env.dev.example` et `.env.prod.example` pour les templates complets.

## 📡 API Endpoints

### Publics (sans authentification)

- **`GET /health`** : Healthcheck (retourne `{ status: 'ok' }`)
- **`GET /public-config`** : Configuration publique (siteName, author, repoUrl, reportIssuesUrl)

### Sécurisés (header `x-api-key` requis)

#### Workflow de session

1. **`POST /api/session/start`** : Créer une session de publication
   - Body : `{ noteCount, assetCount, calloutStyles? }`
   - Retour : `{ sessionId, uploadUrls }`

2. **`POST /api/session/:sessionId/notes/upload`** : Upload de notes (batch)
   - Body : `{ notes: Array<{ path, content, frontmatter }> }`

3. **`POST /api/session/:sessionId/assets/upload`** : Upload d'assets (batch)
   - Body : fichiers binaires (multipart/form-data)

4. **`POST /api/session/:sessionId/finish`** : Finaliser et publier
   - Commit le contenu stagé dans `CONTENT_ROOT`
   - Met à jour `_manifest.json`

5. **`POST /api/session/:sessionId/abort`** : Annuler et supprimer
   - Supprime le contenu stagé

#### Nettoyage

- **`POST /api/cleanup`** : Supprimer tout le contenu publié (⚠️ irréversible)

## 🔗 Liens utiles

- [Architecture générale](../architecture.md)
- [Development workflow](../development.md)
- [Docker](../docker.md)
- [Site Frontend](../site/)
- Code source : `apps/node/src/`

---

**Dernière mise à jour** : Février 2026
