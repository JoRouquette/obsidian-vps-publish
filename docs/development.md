# Development

## Prerequisites

- Node.js `22+` and npm.
- Obsidian desktop for testing the plugin locally.

## Setup

```bash
npm install --no-audit --no-fund
```

Useful scripts:

- `npm run lint`
- `npm run test`
- `npm run build`
- `npm run build:node` / `npm run build:site` / `npm run build:plugin`
- `npm run package:plugin`
- `npm run start node` / `npm run start site`

## Local plugin workflow

1. `npm run package:plugin`
2. Copy or symlink `dist/vps-publish/` to `your-vault/.obsidian/plugins/vps-publish/`.
3. Reload plugins in Obsidian to test changes.

## Environment configuration

- Backend expects `API_KEY` plus `CONTENT_ROOT`, `ASSETS_ROOT`, and `UI_ROOT` (see `docs/architecture.md` for defaults).
- Populate `.env.dev` / `.env.prod` from the provided `.env.*.example` files before running Docker or compose.

## Notes for contributors

- Branch from `main`, keep changes scoped, and add tests where it makes sense (`npm test`).
- Keep `manifest.json` (root) and `apps/obsidian-vps-publish/versions.json` aligned with releases/tags.
