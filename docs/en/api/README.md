# Node.js Backend Documentation (API)

> French version: [docs/api/](../../api/)

This section covers the Node.js backend (`apps/node`) that receives publish sessions, stores staged source packages, rebuilds the final site, and serves the published output.

## Overview

The Node.js/Express backend:

- exposes a secure REST API (`/api/**`) with `x-api-key` authentication
- manages publication through sessions
- accepts note source packages and binary assets
- performs the authoritative deterministic transforms and HTML rendering during finalization
- exposes finalization progress over SSE and polling
- maintains `_manifest.json` as the canonical publication state

## Session workflow

1. **`POST /api/session/start`**
   - Creates a publication session
   - Accepts planned counts, ignore rules, folder metadata, and the current pipeline signature
   - Returns `sessionId` plus authoritative deduplication metadata

2. **`POST /api/session/:sessionId/notes/upload`**
   - Uploads note source packages
   - Each note carries raw Markdown, normalized frontmatter, and Obsidian-only enrichments

3. **`POST /api/session/:sessionId/assets/upload`**
   - Uploads binary assets

4. **`POST /api/session/:sessionId/finish`**
   - Marks the session ready
   - Enqueues backend finalization: note rebuild, HTML rendering, promotion, index rebuilds, and validation

5. **`POST /api/session/:sessionId/abort`**
   - Cancels the session and removes staging state

## Finalization phases

The backend exposes these stable phases over SSE and polling:

- `queued`
- `rebuilding_notes`
- `rendering_html`
- `promoting_content`
- `rebuilding_indexes`
- `validating_links`
- `completing_publication`
- `completed`
- `failed`

## Useful links

- [Architecture](../architecture.md)
- [Publication trace benchmark](../../api/publication-trace-benchmark.md)
- [Performance](../../api/performance.md)
- [Asset deduplication](../../api/asset-deduplication.md)
- [CDN deployment](../../api/cdn-deployment.md)
- [Load testing](../../api/load-testing.md)
- [Streaming refactor guide](../../api/streaming-refactor-guide.md)
- [Thumbnail generation guide](../../api/thumbnail-generation-guide.md)
