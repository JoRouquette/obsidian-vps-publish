# Angular Frontend Documentation (Site)

> **Version française :** [docs/site/](../../site/)

This section contains documentation for the Angular frontend (`apps/site`): the user interface that displays published content.

## 🎯 Overview

The Angular frontend is a Single Page Application (SPA) that:

- Reads the content manifest (`/content/_manifest.json`)
- Displays published pages with navigation, search, and viewers
- Supports Server-Side Rendering (SSR) for improved SEO and performance
- Uses a consistent design system (ITS Theme tokens)

## 📄 Available Documentation

### Rendering and Features

- **[Markdown Rendering](./markdown-rendering.md)** - Advanced Markdown rendering: wikilinks, footnotes, tag filtering
- **[Dataview](./dataview.md)** - Client-side Dataview/DataviewJS implementation

### Design and Theme

See French documentation for complete design system documentation.

### Technical Architecture

See French documentation for SSR, E2E testing, and performance details.

## 🚀 Quick Start

### Prerequisites

- Node.js 20+
- npm installed

### Dev Mode

```bash
npm install
npm run start site
```

The application starts at `http://localhost:4200`.

### Production Build

```bash
npm run build site
```

Artifacts are generated in `dist/apps/site/browser/`.

## 🛠️ Configuration

The frontend uses environment variables injected by the backend:

- **`/public-config`**: exposes `siteName`, `author`, `repoUrl`, `reportIssuesUrl`
- **Manifest**: `/content/_manifest.json` contains page list, tags, and metadata

See [Architecture](../architecture.md) for more details.

## 🔗 Useful Links

- [General Architecture](../architecture.md)
- [Development Workflow](../development.md)
- [Backend API](../api/)
- Source code: `apps/site/src/`

---

**Last Updated**: 2025-12-25
