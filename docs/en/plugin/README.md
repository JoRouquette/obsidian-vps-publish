# Obsidian Plugin Documentation

> **Version française :** [docs/plugin/](../../plugin/)

This section contains documentation for the Obsidian plugin (`apps/obsidian-vps-publish`): the extension that allows you to publish content from your Obsidian vault to your VPS.

## 🎯 Overview

The Obsidian plugin:

- Connects to a configured VPS (URL + API key)
- Collects notes and assets from the vault
- Uploads content via sessions (chunked upload for large files)
- Applies exclusion rules (publish: false, draft, ignored tags, etc.)
- Provides detailed internal help on supported syntaxes

## 📄 Available Documentation

See French documentation for chunked upload and supported syntaxes details.

## 🚀 Installation

### Via GitHub Release

1. Download `vps-publish.zip` from [Releases](https://github.com/JoRouquette/obsidian-vps-publish/releases)
2. Extract to `.obsidian/plugins/vps-publish/`
3. Enable plugin in Obsidian: Settings → Community plugins

### Manual Build

```bash
npm install
npm run build:plugin
npm run package:plugin
```

Files are generated in `dist/vps-publish/`.

## ⚙️ Configuration

### Required Settings

In plugin settings (Obsidian):

- **VPS URL**: `https://your-vps.com`
- **API Key**: Authentication key (encrypted locally)

### Publication Settings

- **Folders to publish**: List of vault folders to include
- **Exclusion rules**:
  - Frontmatter properties to exclude
  - Tags to filter (e.g., `#todo`, `#draft`)
  - Draft rules (e.g., `draft: true`)

### Advanced Settings

- **Assets folder**: Relative path in vault (e.g., `Assets/`)
- **Vault root fallback**: Search assets in entire vault if not found in folder
- **Callout styles**: Paths to custom CSS (e.g., `.obsidian/snippets/callouts.css`)
- **Log level**: `debug`, `info`, `warn`, `error`

## 🎨 Internal Help

The plugin includes interactive help accessible via:

- **Command**: `Open help & documentation`
- **Settings**: "Help & Documentation" button

Internal help documents:

- Publishing control (`publish: false`, `draft: true`)
- Section exclusion (`^no-publishing`)
- Frontmatter
- Wikilinks and anchors
- Assets and images
- Dataview
- Leaflet
- **Advanced Markdown**: wikilinks to headings, footnotes, tag filtering

**⚠️ CRITICAL RULE**: Any logic or syntax change in the plugin MUST update:

1. Internal help (`apps/obsidian-vps-publish/src/i18n/locales.ts` → `help` sections)
2. Documentation `docs/plugin/syntaxes.md`

## 🔗 Useful Links

- [General Architecture](../architecture.md)
- [Development Workflow](../development.md)
- [Backend API](../api/)
- [Release Process](../../release.md) (French)
- Source code: `apps/obsidian-vps-publish/src/`

---

**Last Updated**: 2025-12-25
