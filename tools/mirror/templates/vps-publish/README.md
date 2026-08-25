# Publish to VPS — Obsidian Plugin

Publish selected vault folders to your personal VPS with property-based filtering and remote upload.

## Features

- Property-based file filtering (include/exclude by frontmatter properties)
- Remote upload via configurable VPS endpoint
- Incremental sync — only changed files are uploaded
- Desktop-only (requires Node.js file system access)

## Network use disclosure

This plugin uploads the notes and assets you explicitly select for publication to **your own self-hosted VPS endpoint**, which you configure in the plugin settings. No other remote service is contacted: no third-party servers, no telemetry, no analytics, no ads. No account or payment is required. The plugin does not access files outside your vault.

## Self-hosted server (required)

The plugin publishes to a server **you** host. A single Docker image ships everything (Node API + Angular site):

```bash
docker run -d --name obsidian-vps-publish \
  -p 127.0.0.1:3000:3000 \
  -e API_KEY=change-me \
  -v $(pwd)/content:/content \
  -v $(pwd)/assets:/assets \
  jorouquette/obsidian-vps-publish:latest
```

Then point the plugin at your endpoint (Base URL + API key). Full production guide (nginx TLS front, firewall, auto-updates): [VPS setup guide](https://github.com/JoRouquette/obsidian-vps-publish/blob/main/docs/en/vps-setup.md) ([version française](https://github.com/JoRouquette/obsidian-vps-publish/blob/main/docs/vps-setup.md)).

The image and the plugin are versioned in lockstep: image `X.Y.Z` pairs with plugin `X.Y.Z`.

## Installation

### From Obsidian Community Plugins

Search for **"Publish to VPS"** in Obsidian's community plugin browser.

### Manual

1. Download `main.js`, `manifest.json`, and `styles.css` from the [latest release](../../releases/latest)
2. Copy them into `<your-vault>/.obsidian/plugins/vps-publish/`
3. Enable the plugin in Obsidian settings

## Development

### Prerequisites

- Node.js 22+
- npm

### Setup

```bash
git clone https://github.com/JoRouquette/vps-publish.git
cd vps-publish
npm install
```

### Commands

```bash
npm run dev          # Watch mode (incremental build)
npm run build        # Production build → main.js
npm run lint         # ESLint
npm run lint:fix     # ESLint with auto-fix
npm run test         # Jest
npm run test:coverage  # Jest with coverage report
```

### Project structure

```
src/                  # Plugin source (Obsidian entry point, settings, UI)
libs/
  core-domain/        # Domain model (entities, value objects, interfaces)
  core-application/   # Application services (use cases, orchestration)
```

## Release

Releases are automated via [semantic-release](https://semantic-release.gitbook.io/) on every push to `main`.
Commit messages follow the [Conventional Commits](https://www.conventionalcommits.org/) spec.

## Related repositories

This repository is a **read-only mirror** generated from the monorepo on every stable release. Please open issues and pull requests on the monorepo.

- Monorepo (source of truth, issues, full docs): <https://github.com/JoRouquette/obsidian-vps-publish>
- Docker image (server: API + site): <https://hub.docker.com/r/jorouquette/obsidian-vps-publish>
- Domain library mirror: <https://github.com/JoRouquette/vps-publish-core-domain>
- Application library mirror: <https://github.com/JoRouquette/vps-publish-core-application>

## License

MIT — see [LICENSE](LICENSE)
