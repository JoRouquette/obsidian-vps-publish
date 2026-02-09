# Guide de contribution

> **English version below**

Ce guide explique comment configurer l'environnement de développement, contribuer au projet, et respecter les conventions établies.

## Prérequis

### Logiciels requis

| Outil        | Version | Utilisation                                 |
| ------------ | ------- | ------------------------------------------- |
| **Node.js**  | 22+     | Runtime JavaScript                          |
| **npm**      | 10+     | Gestionnaire de paquets                     |
| **Git**      | 2.40+   | Contrôle de version                         |
| **Docker**   | 24+     | Conteneurisation (optionnel pour dev local) |
| **Obsidian** | 1.5.0+  | Tests du plugin                             |

### Vérification des prérequis

```bash
node --version    # v22.x.x ou supérieur
npm --version     # 10.x.x ou supérieur
git --version     # 2.40.x ou supérieur
docker --version  # 24.x.x ou supérieur (optionnel)
```

## Installation

### 1. Cloner le repository

```bash
git clone https://github.com/JoRouquette/obsidian-vps-publish.git
cd obsidian-vps-publish
```

### 2. Installer les dépendances

```bash
npm install --no-audit --no-fund
```

Cette commande :

- Installe toutes les dépendances du monorepo
- Configure Husky (hooks Git) pour le linting des commits

### 3. Configurer l'environnement

```bash
# Copier le fichier d'environnement de développement
cp .env.dev.example .env.dev

# Éditer si nécessaire (la plupart des valeurs par défaut fonctionnent)
# Les variables importantes :
# - API_KEY : clé d'authentification pour l'API
# - SITE_NAME : nom affiché sur le site
```

### 4. Lancer l'application en développement

**Backend seul :**

```bash
npm run start node
# API disponible sur http://localhost:3000
```

**Frontend seul :**

```bash
npm run start site
# SPA disponible sur http://localhost:4200
```

**Les deux en parallèle (via VS Code) :**

- Utiliser la tâche VS Code `Launch all` (Ctrl+Shift+B → sélectionner)

**Via Docker :**

```bash
# Construire et lancer avec Docker Compose
docker compose -f docker-compose.yml -f docker-compose.dev.yml up --build -d
# Application disponible sur http://localhost:3000
```

## Structure du projet

Ce monorepo utilise **Nx** et suit les principes de **Clean Architecture** + **CQRS**.

```
obsidian-vps-publish/
├── apps/
│   ├── node/               # Backend Express.js (API)
│   ├── site/               # Frontend Angular (SPA)
│   └── obsidian-vps-publish/  # Plugin Obsidian
├── libs/
│   ├── core-domain/        # Entités, ports, value objects (couche la plus interne)
│   └── core-application/   # Commands, queries, handlers, services
├── docs/                   # Documentation
├── tools/                  # Utilitaires (load tests, scripts)
└── scripts/                # Scripts de build et validation
```

### Règles de dépendances (Clean Architecture)

```
UI/Plugin (apps/) → Application (libs/core-application/) → Domain (libs/core-domain/)
```

- **Domain** : Ne peut dépendre d'aucune autre couche
- **Application** : Ne dépend que du Domain
- **Infra/UI** : Peut dépendre de Application et Domain

Ces règles sont **automatiquement vérifiées** par ESLint (`@nx/enforce-module-boundaries`).

## Scripts npm principaux

| Script                   | Description                                  |
| ------------------------ | -------------------------------------------- |
| `npm run build`          | Build complet (tous les projets)             |
| `npm run build:plugin`   | Build du plugin Obsidian                     |
| `npm run package:plugin` | Build + package du plugin (prêt à installer) |
| `npm run lint`           | Vérification ESLint de tous les projets      |
| `npm run lint:fix`       | Correction automatique des erreurs ESLint    |
| `npm run test`           | Exécution des tests unitaires                |
| `npm run test:e2e`       | Tests end-to-end (Playwright)                |
| `npm run format`         | Formatage Prettier de tous les fichiers      |
| `npm run docs:check`     | Validation de la structure de documentation  |
| `npm run start node`     | Lancer le backend en mode dev                |
| `npm run start site`     | Lancer le frontend en mode dev               |

## Workflow de développement

### Créer une branche

```bash
# Créer une branche depuis main
git checkout main
git pull origin main
git checkout -b feature/ma-fonctionnalite
```

### Conventions de nommage des branches

- `feature/description` - Nouvelle fonctionnalité
- `fix/description` - Correction de bug
- `refactor/description` - Refactoring sans changement fonctionnel
- `docs/description` - Documentation uniquement
- `chore/description` - Maintenance (dépendances, config)

### Convention de commits (Conventional Commits)

Les messages de commit **doivent** suivre le format [Conventional Commits](https://www.conventionalcommits.org/) :

```
type(scope): description courte

[corps optionnel]

[footer optionnel]
```

**Types autorisés :**

- `feat` : Nouvelle fonctionnalité (génère une version MINOR)
- `fix` : Correction de bug (génère une version PATCH)
- `docs` : Documentation uniquement
- `style` : Formatage, pas de changement de logique
- `refactor` : Refactoring sans changement fonctionnel
- `perf` : Amélioration de performance
- `test` : Ajout ou modification de tests
- `chore` : Maintenance, build, CI
- `revert` : Annulation d'un commit précédent

**Scopes suggérés :**

- `plugin` : Plugin Obsidian
- `api` : Backend Node.js
- `site` : Frontend Angular
- `domain` : libs/core-domain
- `application` : libs/core-application
- `docs` : Documentation

**Exemples :**

```bash
git commit -m "feat(plugin): add support for nested tags"
git commit -m "fix(api): handle empty frontmatter gracefully"
git commit -m "docs: update contribution guide"
git commit -m "refactor(site): simplify markdown rendering pipeline"
```

### Avant de pusher

```bash
# Vérifier le linting
npm run lint

# Corriger automatiquement si possible
npm run lint:fix

# Exécuter les tests
npm run test

# Build complet
npm run build

# Vérifier la documentation
npm run docs:check
```

### Pull Request

1. Pusher votre branche
2. Créer une PR vers `main`
3. Attendre la validation CI (lint, test, build)
4. Demander une review si nécessaire
5. Merger une fois approuvé

## Développement du plugin

### Build et installation locale

```bash
# Build + package le plugin
npm run package:plugin

# Les fichiers sont dans dist/vps-publish/
# Copier ou symlink vers votre vault de test
```

### Symlink vers un vault de test (recommandé)

**Linux/macOS :**

```bash
ln -s $(pwd)/dist/vps-publish ~/.obsidian/plugins/vps-publish
```

**Windows (PowerShell en admin) :**

```powershell
New-Item -ItemType Junction -Path "$env:USERPROFILE\.obsidian\plugins\vps-publish" -Target "$(Get-Location)\dist\vps-publish"
```

### Mode watch

```bash
# Rebuild automatique à chaque changement
npx nx run obsidian-vps-publish:dev
```

Après chaque rebuild, recharger les plugins dans Obsidian : `Ctrl+R` ou Settings → Community plugins → Reload.

### Règle critique pour le plugin

**Toute modification de logique ou syntaxe de parsing DOIT mettre à jour :**

1. L'aide interne : `apps/obsidian-vps-publish/src/i18n/locales.ts` (sections `help`)
2. La documentation : `docs/plugin/syntaxes.md`

## Tests de charge (Artillery)

### Configuration

```bash
cp .env.artillery.example .env.artillery
# Éditer .env.artillery et définir API_KEY
```

### Exécution

```bash
# Test rapide (10 notes, 30s)
npm run loadtest

# Avec rapport HTML
npm run loadtest:report

# Profils prédéfinis
npm run load:api:50       # 50 notes
npm run load:api:200      # 200 notes
npm run load:api:500      # 500 notes
npm run load:api:1000     # 1000 notes (stress test)
```

## Documentation

### Structure

La documentation suit une charte stricte. Voir [docs/README.md](./README.md) pour les détails.

**Points clés :**

- Une page = un sujet
- Focus sur l'état actuel, pas l'historique
- Pas de journaux de migration ou summaries d'implémentation
- Tous les fichiers .md doivent être indexés dans un README

### Validation

```bash
npm run docs:check
```

Ce script vérifie :

- Structure des dossiers conforme
- Tous les fichiers indexés
- Synchronisation aide interne plugin / documentation

## Troubleshooting

### "Cannot find module" après npm install

```bash
rm -rf node_modules
npm cache clean --force
npm install --no-audit --no-fund
```

### Erreurs ESLint sur les imports

```bash
npm run lint:fix  # Corrige automatiquement l'ordre des imports
```

### Plugin ne charge pas dans Obsidian

1. Vérifier que `manifest.json` existe dans le dossier du plugin
2. Vérifier que `minAppVersion` dans manifest.json correspond à votre version d'Obsidian
3. Ouvrir la console développeur d'Obsidian (Ctrl+Shift+I) et chercher les erreurs

### Build Docker échoue

1. Vérifier que le build Nx passe localement :
   ```bash
   npm run build
   ```
2. Vérifier que Docker a assez de mémoire allouée (4GB minimum recommandé)

### 401 Unauthorized sur l'API

- Vérifier que `API_KEY` est défini dans `.env.dev` et `.env.artillery`
- Vérifier que le header `x-api-key` est envoyé avec les requêtes

## Ressources

- [Architecture du projet](./architecture.md)
- [Configuration Docker](./docker.md)
- [Process de release](./release.md)
- [Documentation API](./api/README.md)
- [Documentation Site](./site/README.md)
- [Documentation Plugin](./plugin/README.md)

---

# Contributing Guide

> **French version above**

This guide explains how to set up the development environment, contribute to the project, and follow established conventions.

## Prerequisites

### Required Software

| Tool         | Version | Use                                       |
| ------------ | ------- | ----------------------------------------- |
| **Node.js**  | 22+     | JavaScript runtime                        |
| **npm**      | 10+     | Package manager                           |
| **Git**      | 2.40+   | Version control                           |
| **Docker**   | 24+     | Containerization (optional for local dev) |
| **Obsidian** | 1.5.0+  | Plugin testing                            |

### Check Prerequisites

```bash
node --version    # v22.x.x or higher
npm --version     # 10.x.x or higher
git --version     # 2.40.x or higher
docker --version  # 24.x.x or higher (optional)
```

## Installation

### 1. Clone the Repository

```bash
git clone https://github.com/JoRouquette/obsidian-vps-publish.git
cd obsidian-vps-publish
```

### 2. Install Dependencies

```bash
npm install --no-audit --no-fund
```

This command:

- Installs all monorepo dependencies
- Configures Husky (Git hooks) for commit linting

### 3. Configure Environment

```bash
# Copy the development environment file
cp .env.dev.example .env.dev

# Edit if needed (most defaults work fine)
# Important variables:
# - API_KEY: authentication key for the API
# - SITE_NAME: name displayed on the site
```

### 4. Run in Development Mode

**Backend only:**

```bash
npm run start node
# API available at http://localhost:3000
```

**Frontend only:**

```bash
npm run start site
# SPA available at http://localhost:4200
```

**Both in parallel (via VS Code):**

- Use the VS Code task `Launch all` (Ctrl+Shift+B → select)

**Via Docker:**

```bash
docker compose -f docker-compose.yml -f docker-compose.dev.yml up --build -d
# Application available at http://localhost:3000
```

## Project Structure

This monorepo uses **Nx** and follows **Clean Architecture** + **CQRS** principles.

```
obsidian-vps-publish/
├── apps/
│   ├── node/               # Express.js backend (API)
│   ├── site/               # Angular frontend (SPA)
│   └── obsidian-vps-publish/  # Obsidian plugin
├── libs/
│   ├── core-domain/        # Entities, ports, value objects (innermost layer)
│   └── core-application/   # Commands, queries, handlers, services
├── docs/                   # Documentation
├── tools/                  # Utilities (load tests, scripts)
└── scripts/                # Build and validation scripts
```

### Dependency Rules (Clean Architecture)

```
UI/Plugin (apps/) → Application (libs/core-application/) → Domain (libs/core-domain/)
```

- **Domain**: Cannot depend on any other layer
- **Application**: Only depends on Domain
- **Infra/UI**: Can depend on Application and Domain

These rules are **automatically enforced** by ESLint (`@nx/enforce-module-boundaries`).

## Main npm Scripts

| Script                   | Description                                   |
| ------------------------ | --------------------------------------------- |
| `npm run build`          | Full build (all projects)                     |
| `npm run build:plugin`   | Build the Obsidian plugin                     |
| `npm run package:plugin` | Build + package the plugin (ready to install) |
| `npm run lint`           | ESLint check for all projects                 |
| `npm run lint:fix`       | Auto-fix ESLint errors                        |
| `npm run test`           | Run unit tests                                |
| `npm run test:e2e`       | End-to-end tests (Playwright)                 |
| `npm run format`         | Prettier formatting for all files             |
| `npm run docs:check`     | Validate documentation structure              |
| `npm run start node`     | Start backend in dev mode                     |
| `npm run start site`     | Start frontend in dev mode                    |

## Development Workflow

### Create a Branch

```bash
git checkout main
git pull origin main
git checkout -b feature/my-feature
```

### Branch Naming Conventions

- `feature/description` - New feature
- `fix/description` - Bug fix
- `refactor/description` - Refactoring without functional change
- `docs/description` - Documentation only
- `chore/description` - Maintenance (dependencies, config)

### Commit Convention (Conventional Commits)

Commit messages **must** follow the [Conventional Commits](https://www.conventionalcommits.org/) format:

```
type(scope): short description

[optional body]

[optional footer]
```

**Allowed types:**

- `feat`: New feature (generates MINOR version)
- `fix`: Bug fix (generates PATCH version)
- `docs`: Documentation only
- `style`: Formatting, no logic change
- `refactor`: Refactoring without functional change
- `perf`: Performance improvement
- `test`: Add or modify tests
- `chore`: Maintenance, build, CI
- `revert`: Revert a previous commit

**Suggested scopes:**

- `plugin`: Obsidian plugin
- `api`: Node.js backend
- `site`: Angular frontend
- `domain`: libs/core-domain
- `application`: libs/core-application
- `docs`: Documentation

**Examples:**

```bash
git commit -m "feat(plugin): add support for nested tags"
git commit -m "fix(api): handle empty frontmatter gracefully"
git commit -m "docs: update contribution guide"
git commit -m "refactor(site): simplify markdown rendering pipeline"
```

### Before Pushing

```bash
npm run lint
npm run lint:fix
npm run test
npm run build
npm run docs:check
```

### Pull Request

1. Push your branch
2. Create a PR to `main`
3. Wait for CI validation (lint, test, build)
4. Request review if needed
5. Merge once approved

## Plugin Development

### Build and Local Installation

```bash
npm run package:plugin
# Files are in dist/vps-publish/
# Copy or symlink to your test vault
```

### Symlink to Test Vault (recommended)

**Linux/macOS:**

```bash
ln -s $(pwd)/dist/vps-publish ~/.obsidian/plugins/vps-publish
```

**Windows (PowerShell as admin):**

```powershell
New-Item -ItemType Junction -Path "$env:USERPROFILE\.obsidian\plugins\vps-publish" -Target "$(Get-Location)\dist\vps-publish"
```

### Watch Mode

```bash
npx nx run obsidian-vps-publish:dev
```

After each rebuild, reload plugins in Obsidian: `Ctrl+R` or Settings → Community plugins → Reload.

### Critical Rule for Plugin

**Any change to parsing logic or syntax MUST update:**

1. Internal help: `apps/obsidian-vps-publish/src/i18n/locales.ts` (`help` sections)
2. Documentation: `docs/plugin/syntaxes.md`

## Load Testing (Artillery)

### Configuration

```bash
cp .env.artillery.example .env.artillery
# Edit .env.artillery and set API_KEY
```

### Execution

```bash
npm run loadtest           # Quick test (10 notes, 30s)
npm run loadtest:report    # With HTML report
npm run load:api:50        # 50 notes
npm run load:api:200       # 200 notes
npm run load:api:500       # 500 notes
npm run load:api:1000      # 1000 notes (stress test)
```

## Documentation

### Structure

Documentation follows a strict charter. See [docs/README.md](./README.md) for details.

**Key points:**

- One page = one topic
- Focus on current state, not history
- No migration journals or implementation summaries
- All .md files must be indexed in a README

### Validation

```bash
npm run docs:check
```

This script checks:

- Directory structure compliance
- All files indexed
- Plugin internal help / documentation sync

## Troubleshooting

### "Cannot find module" after npm install

```bash
rm -rf node_modules
npm cache clean --force
npm install --no-audit --no-fund
```

### ESLint import errors

```bash
npm run lint:fix  # Auto-fixes import order
```

### Plugin doesn't load in Obsidian

1. Verify `manifest.json` exists in the plugin folder
2. Check that `minAppVersion` in manifest.json matches your Obsidian version
3. Open Obsidian developer console (Ctrl+Shift+I) and look for errors

### Docker build fails

1. Verify Nx build passes locally:
   ```bash
   npm run build
   ```
2. Ensure Docker has enough allocated memory (4GB minimum recommended)

### 401 Unauthorized on API

- Verify `API_KEY` is set in `.env.dev` and `.env.artillery`
- Verify the `x-api-key` header is sent with requests

## Resources

- [Project Architecture](./architecture.md)
- [Docker Configuration](./docker.md)
- [Release Process](./release.md)
- [API Documentation](./api/README.md)
- [Site Documentation](./site/README.md)
- [Plugin Documentation](./plugin/README.md)

---

**Last updated**: February 2026
