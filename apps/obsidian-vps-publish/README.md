# Publish to VPS — Obsidian Plugin

Publish selected vault folders to your personal VPS with property-based filtering and remote upload.

## Features

- Property-based file filtering (include/exclude by frontmatter properties)
- Remote upload via configurable VPS endpoint
- Incremental sync — only changed files are uploaded
- Desktop-only (requires Node.js file system access)

## Vault access disclosure

The plugin lists the files of your vault (`vault.getFiles`, `getMarkdownFiles`, `getAllLoadedFiles`) in four places. Every listing is local, read-only and held in memory only:

- **Folder and file pickers** in the settings suggest paths while you type.
- **Property picker** in the ignore rules reads the frontmatter keys of your notes to suggest property names. Only the key names and their counts are kept, never the values.
- **Publication summary** counts the notes and assets of the folders you configured, to fill the confirmation dialog.
- **Asset lookup** builds an index of file names to match the images and attachments embedded in the notes you publish. Outside your assets folder, it only searches the rest of the vault when you turn on the vault fallback option.

Nothing from these listings is sent anywhere. Only the notes of the folders you configured (minus your ignore rules) and the assets those notes embed are uploaded, to your own server.

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
