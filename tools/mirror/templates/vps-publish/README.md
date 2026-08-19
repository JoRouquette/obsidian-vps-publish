# Publish to VPS — Obsidian Plugin

Publish selected vault folders to your personal VPS with property-based filtering and remote upload.

## Features

- Property-based file filtering (include/exclude by frontmatter properties)
- Remote upload via configurable VPS endpoint
- Incremental sync — only changed files are uploaded
- Desktop-only (requires Node.js file system access)

## Network use disclosure

This plugin uploads the notes and assets you explicitly select for publication to **your own self-hosted VPS endpoint**, which you configure in the plugin settings. No other remote service is contacted: no third-party servers, no telemetry, no analytics, no ads. No account or payment is required. The plugin does not access files outside your vault.

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

## License

MIT — see [LICENSE](LICENSE)
