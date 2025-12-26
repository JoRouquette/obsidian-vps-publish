# Documentation Obsidian VPS Publish

> **English documentation:** [docs/en/](./en/)

## 📜 Charte de Documentation

### Principes fondamentaux

1. **La documentation sert l'usage, pas l'historique**
   - Documenter l'état actuel du système, pas les migrations passées
   - Pas de journaux de refactoring, changelogs détaillés, ou narrations de développement
   - Focus sur : comprendre, diagnostiquer, maintenir, contribuer

2. **Clarté et pertinence**
   - Une page = un sujet clairement défini
   - Audience explicite (dev/ops/user) pour chaque document
   - Pas de documentation "pour faire joli" sans besoin réel

3. **Obligation de mise à jour cohérente**
   - **CRITIQUE** : Tout changement de logique ou syntaxe du plugin DOIT mettre à jour :
     - Le composant d'aide interne du plugin (`apps/obsidian-vps-publish/src/i18n/locales.ts` → sections `help`)
     - La documentation correspondante dans `docs/plugin/`
   - Les fichiers de doc doivent rester synchronisés avec le code

4. **Pas de redondance**
   - Si un document existe déjà, l'étendre plutôt que créer un nouveau fichier
   - Pas de doublons FR/EN inutiles : traduire uniquement si pertinent pour l'audience internationale

### Structure documentaire

```
docs/
├── README.md                 # Ce fichier - Charte + index principal (FR)
├── architecture.md           # Clean Architecture, CQRS, monorepo (transverse)
├── development.md            # Setup local, workflows, conventions (transverse)
├── docker.md                 # Container, déploiement (transverse)
├── release.md                # Process de release, versioning (transverse)
│
├── site/                     # Documentation Frontend Angular
│   ├── README.md             # Index + Getting started Site
│   ├── markdown-rendering.md
│   ├── dataview.md
│   ├── leaflet.md
│   ├── image-viewer.md
│   ├── design-system.md
│   ├── ssr.md
│   ├── testing-e2e.md
│   └── performance.md
│
├── api/                      # Documentation Backend Node.js
│   ├── README.md             # Index + Getting started API
│   ├── logging.md
│   └── performance.md
│
├── plugin/                   # Documentation Plugin Obsidian
│   ├── README.md             # Index + Getting started Plugin
│   ├── chunked-upload.md
│   └── syntaxes.md           # Syntaxes supportées (sync avec help interne)
│
├── en/                       # Documentation anglaise (structure miroir)
│   ├── README.md
│   ├── architecture.md
│   ├── development.md
│   ├── site/
│   ├── api/
│   └── plugin/
│
└── _archive/                 # Archives non indexées (historique interne uniquement)
```

### Format standard d'un document

Chaque document de fonctionnalité doit suivre cette structure :

```markdown
# Titre de la fonctionnalité

## Objectif

Pourquoi cette fonctionnalité existe, quel problème elle résout.

## Quand l'utiliser

Cas d'usage concrets, scénarios typiques.

## Concepts clés

Définitions, architecture, composants impliqués (rester concis).

## Configuration

Variables d'environnement, settings, options disponibles.

## Utilisation

Exemples pratiques, commandes, workflows.

## Troubleshooting

Problèmes fréquents et solutions.

## Références

Liens vers code source, issues, PRs pertinentes.
```

### Ce qu'on NE documente PAS

- ❌ Journaux de migration (ex: "On a migré de X vers Y le...")
- ❌ Summaries de refactoring (ex: "performance-overhaul-summary")
- ❌ Checklists temporaires de non-régression
- ❌ Détails d'implémentation obsolètes remplacés par de nouvelles versions
- ❌ Catalogues exhaustifs de tous les composants internes (documenter ce qui est utilisé/configurable)

### Règles de liens et références

- Utiliser des liens relatifs : `[Architecture](../architecture.md)`
- Référencer les fichiers source avec chemins absolus depuis la racine du repo : `apps/node/src/main.ts`
- Chaque README de sous-dossier doit indexer tous les documents qu'il contient
- Aucun document orphelin (non référencé par un index)

### Validation automatique

Un script `npm run docs:check` vérifie :

- Arborescence respectée (docs hors `site/`, `api/`, `plugin/`, `en/`, `_archive/` sont rejetés)
- Tous les fichiers .md sont référencés dans un README d'index
- Les changements dans `apps/obsidian-vps-publish/src/` touchant la logique de parsing/rendu sont accompagnés d'une mise à jour du composant d'aide interne

Ce script est exécuté en CI pour garantir le respect des règles.

---

## 📚 Index de la Documentation

### Documents transverses (racine)

- **[Architecture](./architecture.md)** - Clean Architecture, CQRS, structure du monorepo
- **[Development](./development.md)** - Configuration locale, scripts npm, workflows Git
- **[Docker](./docker.md)** - Image container, volumes, healthcheck, déploiement
- **[Release](./release.md)** - Processus de release, semantic-release, versioning

### Frontend Angular (`site/`)

➡️ **[Documentation Site](./site/)** - Composants UI, rendu Markdown, SSR, tests E2E

### Backend Node.js (`api/`)

➡️ **[Documentation API](./api/)** - Endpoints, logging, performance, configuration

### Plugin Obsidian (`plugin/`)

➡️ **[Documentation Plugin](./plugin/)** - Upload, syntaxes supportées, aide interne

---

## 🚀 Quick Start

### Pour les développeurs

1. Lire [Architecture](./architecture.md) pour comprendre le monorepo
2. Suivre [Development](./development.md) pour le setup local
3. Consulter la doc spécifique à votre zone de travail (site/api/plugin)

### Pour le déploiement

1. Lire [Docker](./docker.md) pour comprendre l'image et les volumes
2. Consulter [API](./api/) pour la configuration des variables d'environnement

### Pour contribuer

1. Lire [Development](./development.md) - section Contributing
2. **Respecter la charte de documentation** (ce README)
3. Mettre à jour l'aide interne du plugin si modification de logique/syntaxe

---

## 🌍 Navigation par rôle

**Je suis développeur frontend**

- [Site - README](./site/)
- [Markdown Rendering](./site/markdown-rendering.md)
- [Design System](./site/design-system.md)

**Je suis développeur backend**

- [API - README](./api/)
- [Logging](./api/logging.md)
- [Performance](./api/performance.md)

**Je suis développeur du plugin**

- [Plugin - README](./plugin/)
- [Chunked Upload](./plugin/chunked-upload.md)
- [Syntaxes supportées](./plugin/syntaxes.md)

**Je déploie l'application**

- [Docker](./docker.md)
- [Release](./release.md)

---

## 📝 Maintenance de la documentation

### Règle d'or

> **Avant de créer un nouveau fichier de doc, demande-toi : est-ce qu'une section dans un fichier existant ne suffirait pas ?**

### Processus de mise à jour

1. Identifier le document concerné (site/api/plugin)
2. Mettre à jour le contenu (éliminer l'historique, focus sur l'état actuel)
3. Si changement plugin : **obligatoire** → MAJ `apps/obsidian-vps-publish/src/i18n/locales.ts` (section help) + `docs/plugin/syntaxes.md`
4. Vérifier les liens internes
5. Exécuter `npm run docs:check` avant commit

### Suppression d'une documentation

Si un document n'a plus de raison d'être :

1. Le supprimer du dossier docs/
2. Retirer toutes les références dans les index (README)
3. Vérifier qu'aucun lien mort ne subsiste (`npm run docs:check`)

---

**Version de cette charte** : Décembre 2025  
**Dernière mise à jour** : 2025-12-25
