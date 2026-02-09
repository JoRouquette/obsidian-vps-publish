# Documentation Obsidian VPS Publish

> **Documentation française :** [docs/](../)

## 📜 Documentation Charter

### Core Principles

1. **Documentation serves usage, not history**
   - Document the current state of the system, not past migrations
   - No refactoring journals, detailed changelogs, or development narratives
   - Focus on: understanding, diagnosing, maintaining, contributing

2. **Clarity and relevance**
   - One page = one clearly defined topic
   - Explicit audience (dev/ops/user) for each document
   - No "nice-to-have" documentation without real need

3. **Mandatory consistent updates**
   - **CRITICAL**: Any logic or syntax change in the plugin MUST update:
     - The plugin's internal help component (`apps/obsidian-vps-publish/src/i18n/locales.ts` → `help` sections)
     - The corresponding documentation in `docs/plugin/`
   - Documentation files must stay synchronized with code

4. **No redundancy**
   - If a document already exists, extend it rather than creating a new file
   - No unnecessary FR/EN duplicates: translate only if relevant for international audience

### Documentation Structure

```
docs/
├── en/
│   ├── README.md             # This file - Charter + main index (EN)
│   ├── architecture.md       # Clean Architecture, CQRS, monorepo (cross-cutting)
│   ├── development.md        # Local setup, workflows, conventions (cross-cutting)
│   │
│   ├── site/                 # Angular Frontend Documentation
│   │   ├── README.md         # Site index + Getting started
│   │   └── ...
│   │
│   ├── api/                  # Node.js Backend Documentation
│   │   ├── README.md         # API index + Getting started
│   │   └── ...
│   │
│   └── plugin/               # Obsidian Plugin Documentation
│       ├── README.md         # Plugin index + Getting started
│       └── ...
```

### Standard Document Format

Each feature document should follow this structure:

```markdown
# Feature Title

## Purpose

Why this feature exists, what problem it solves.

## When to Use

Concrete use cases, typical scenarios.

## Key Concepts

Definitions, architecture, involved components (keep concise).

## Configuration

Environment variables, settings, available options.

## Usage

Practical examples, commands, workflows.

## Troubleshooting

Common issues and solutions.

## References

Links to source code, relevant issues, PRs.
```

### What We DON'T Document

- ❌ Migration journals (e.g., "We migrated from X to Y on...")
- ❌ Refactoring summaries (e.g., "performance-overhaul-summary")
- ❌ Temporary non-regression checklists
- ❌ Obsolete implementation details replaced by newer versions
- ❌ Exhaustive catalogs of all internal components (document what's used/configurable)

### Link and Reference Rules

- Use relative links: `[Architecture](../architecture.md)`
- Reference source files with absolute paths from repo root: `apps/node/src/main.ts`
- Each sub-folder README must index all documents it contains
- No orphaned documents (not referenced by an index)

### Automated Validation

An `npm run docs:check` script verifies:

- Structure compliance (docs outside `site/`, `api/`, `plugin/`, `en/`, `_archive/` are rejected)
- All .md files are referenced in an index README
- Changes in `apps/obsidian-vps-publish/src/` affecting parsing/rendering logic are accompanied by internal help component updates

This script runs in CI to enforce compliance.

---

## 📚 Documentation Index

### Cross-cutting Documents (root)

- **[Contributing Guide](../CONTRIBUTING.md)** - Prerequisites, installation, workflow, conventions (FR + EN)
- **[Architecture](./architecture.md)** - Clean Architecture, CQRS, monorepo structure
- **[Development](./development.md)** - Local setup, npm scripts, Git workflows

### Angular Frontend (`site/`)

➡️ **[Site Documentation](./site/)** - UI components, Markdown rendering, SSR, E2E tests

### Node.js Backend (`api/`)

➡️ **[API Documentation](./api/)** - Endpoints, logging, performance, load testing

### Obsidian Plugin (`plugin/`)

➡️ **[Plugin Documentation](./plugin/)** - Upload system, supported syntaxes, configuration

---

## 🚀 Quick Start

### For Developers

1. Read the **[Contributing Guide](../CONTRIBUTING.md)** for installation and prerequisites
2. Read [Architecture](./architecture.md) to understand the monorepo
3. Consult specific documentation for your work area (site/api/plugin)

### For Deployment

1. Read [Docker](../docker.md) (French) to understand the image and volumes
2. Consult [API](./api/) for environment variable configuration

### To Contribute

1. Read the **[Contributing Guide](../CONTRIBUTING.md)** - prerequisites, installation, workflow
2. **Respect the documentation charter** (this README)
3. Update plugin internal help if modifying logic/syntax

---

## 🌍 Navigation by Role

**I'm a frontend developer**

- [Site - README](./site/)
- [Markdown Rendering](./site/markdown-rendering.md)

**I'm a backend developer**

- [API - README](./api/)

**I'm a plugin developer**

- [Plugin - README](./plugin/)

**I'm deploying the application**

- [Docker](../docker.md) (French)
- [Release](../release.md) (French)

---

## 📝 Documentation Maintenance

### Golden Rule

> **Before creating a new documentation file, ask yourself: wouldn't a section in an existing file suffice?**

### Update Process

1. Identify the relevant document (site/api/plugin)
2. Update the content (eliminate history, focus on current state)
3. If plugin change: **mandatory** → update `apps/obsidian-vps-publish/src/i18n/locales.ts` (help section) + `docs/plugin/syntaxes.md`
4. Check internal links
5. Run `npm run docs:check` before commit

### Deleting Documentation

If a document is no longer needed:

1. Delete it from docs/
2. Remove all references in indexes (README)
3. Verify no dead links remain (`npm run docs:check`)

---

**Charter Version**: February 2026  
**Last Updated**: February 2026
