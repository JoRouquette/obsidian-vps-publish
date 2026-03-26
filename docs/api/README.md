# Documentation Backend Node.js (API)

> Version anglaise : [docs/en/api/](../en/api/)

Cette section couvre le backend Node.js (`apps/node`) qui orchestre la publication, reconstruit le rendu final, maintient le manifeste et sert le contenu publiÃ©.

## Vue d'ensemble

Le backend Node.js/Express :

- expose une API REST sÃ©curisÃ©e (`/api/**`) avec authentification par `x-api-key`
- gÃ¨re le workflow de publication par session
- reÃ§oit un package source de notes et d'assets, puis reconstruit le rendu final pendant la finalisation
- expose l'avancement de finalisation via SSE et polling
- sert le contenu statique (pages, assets, SPA Angular)
- maintient `_manifest.json` comme source de vÃ©ritÃ©

## Workflow de publication

1. **`POST /api/session/start`**
   - CrÃ©e une session de publication
   - ReÃ§oit les compteurs planifiÃ©s, la signature de pipeline, les ignore rules et les mÃ©tadonnÃ©es de dossiers
   - Retourne `sessionId` et les informations de dÃ©duplication autoritatives

2. **`POST /api/session/:sessionId/notes/upload`**
   - ReÃ§oit un batch de notes sous forme de package source
   - Le payload contient le Markdown brut, le frontmatter normalisÃ© et les enrichissements strictement liÃ©s au runtime Obsidian
   - Le rendu HTML final n'est pas construit ici

3. **`POST /api/session/:sessionId/assets/upload`**
   - Upload batch des fichiers binaires

4. **`POST /api/session/:sessionId/finish`**
   - Marque la session prÃªte pour publication
   - DÃ©clenche la finalisation backend : reconstruction des notes, rendu HTML, promotion, rebuild des index et validation des liens

5. **`POST /api/session/:sessionId/abort`**
   - Annule la session et supprime le staging

## Phases de finalisation

Les phases backend stables exposÃ©es via SSE et polling sont :

- `queued`
- `rebuilding_notes`
- `rendering_html`
- `promoting_content`
- `rebuilding_indexes`
- `validating_links`
- `completing_publication`
- `completed`
- `failed`

## Documentation liÃ©e

- [Architecture](../architecture.md)
- [Performance](./performance.md)
- [Publication Trace Benchmark](./publication-trace-benchmark.md)
- [Asset Deduplication](./asset-deduplication.md)
- [Asset Security](./asset-security.md)
- [Link Normalization](./link-normalization.md)
- [CDN Deployment](./cdn-deployment.md)
- [Load Testing](./load-testing.md)
- [Streaming Refactor Guide](./streaming-refactor-guide.md)
- [Thumbnail Generation Guide](./thumbnail-generation-guide.md)
