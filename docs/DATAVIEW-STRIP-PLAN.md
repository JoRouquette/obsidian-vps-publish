# Plan de Simplification Dataview

## Objectif

Réduire la fonctionnalité Dataview au strict minimum fonctionnel, sans impacter node/site et sans casser custom index.

## Analyse des Composants

### 🔴 À SUPPRIMER (Non essentiels)

#### Documentation excessive

- [ ] `docs/dataview-architecture.md` (758 lignes)
- [ ] `docs/dataview-html-integration-flow.md` (316 lignes)
- [ ] `docs/dataview-implementation-resume-fr.md` (280 lignes)
- [ ] `docs/dataview-logging-guide.md` (408 lignes)
- [ ] `docs/dataview-query-implementation.md` (255 lignes)
- [ ] `docs/dataview-quick-debug.md` (175 lignes)
- [ ] `docs/dataview-unified-architecture.md` (405 lignes)
- [ ] `docs/DATAVIEW-CONTEXT-FIX.md` (138 lignes)
- [ ] `docs/DATAVIEW-CLEANUP.md` (209 lignes)
- [ ] `docs/DATAVIEW-MARKDOWN-SUMMARY.md` (249 lignes)
- **Garder** : `docs/DATAVIEW-BUG-DIAGNOSIS.md`, `docs/DATAVIEW-FIX-SUMMARY.md` (essentiels)

#### Tests fixtures volumineuses

- [ ] `apps/obsidian-vps-publish/src/_tests/fixtures/dataview/*` (301 lignes de README seul)
  - Garder 1-2 fixtures simples, supprimer les autres

#### Services Backend non utilisés

- [ ] `libs/core-application/src/lib/vault-parsing/services/detect-dataview-links.service.ts` (215 lignes)
- [ ] `libs/core-application/src/lib/vault-parsing/services/dataview-html-sanitizer.service.ts` (375 lignes)
- [ ] Tests associés : `dataview-links-integration.test.ts`, `detect-dataview-links.service.test.ts`, `dataview-html-sanitizer.service.test.ts`
- **Raison** : Pipeline Markdown-native, pas de HTML Dataview côté backend

### 🟢 À GARDER (Essentiels)

#### Core Domain

- ✅ `libs/core-domain/src/lib/dataview/dataview-block.ts` - Entité
- ✅ `libs/core-domain/src/lib/ports/dataview-processor-port.ts` - Port

#### Core Application

- ✅ `libs/core-application/src/lib/dataview/dataview-to-markdown.converter.ts` - Conversion
- ✅ `libs/core-application/src/lib/dataview/markdown-link-normalizer.ts` - Normalisation
- ✅ Tests : `markdown-link-normalizer.test.ts`

#### Plugin Obsidian

- ✅ `apps/obsidian-vps-publish/src/lib/dataview/dataview-block.parser.ts` - Parse
- ✅ `apps/obsidian-vps-publish/src/lib/dataview/dataview-executor.ts` - Exécution
- ✅ `apps/obsidian-vps-publish/src/lib/dataview/process-dataview-blocks.service.ts` - Orchestration
- ✅ `apps/obsidian-vps-publish/src/main.ts` - Intégration
- ✅ Tests minimaux : `dataview-block.parser.test.ts`, `dataview-integration.test.ts`, `dataview-link-corruption.test.ts`

#### Backend (changement minimal)

- ✅ `apps/node/src/infra/markdown/markdown-it.renderer.ts` - linkify: false

### 🟡 Custom Index (NE PAS TOUCHER)

Ces fichiers sont indépendants de Dataview et doivent rester intacts :

- ✅ `libs/core-domain/src/lib/entities/custom-index-config.ts`
- ✅ `libs/core-domain/src/lib/ports/custom-index-resolver-port.ts`
- ✅ `libs/core-application/src/lib/vault-parsing/services/resolve-custom-index.service.ts`
- ✅ `apps/node/src/infra/sessions/session-finalizer.service.ts` (custom index injection)
- ✅ `apps/obsidian-vps-publish/src/lib/suggesters/file-suggester.ts`
- ✅ Settings UI (folders-section.ts, vps-section.ts)

## Actions à Réaliser

### 1. Supprimer documentation excessive

```bash
rm docs/dataview-architecture.md
rm docs/dataview-html-integration-flow.md
rm docs/dataview-implementation-resume-fr.md
rm docs/dataview-logging-guide.md
rm docs/dataview-query-implementation.md
rm docs/dataview-quick-debug.md
rm docs/dataview-unified-architecture.md
rm docs/DATAVIEW-CONTEXT-FIX.md
rm docs/DATAVIEW-CLEANUP.md
rm docs/DATAVIEW-MARKDOWN-SUMMARY.md
```

### 2. Supprimer services backend inutiles

```bash
rm libs/core-application/src/lib/vault-parsing/services/detect-dataview-links.service.ts
rm libs/core-application/src/lib/vault-parsing/services/dataview-html-sanitizer.service.ts
rm libs/core-application/src/lib/_tests/vault-parsing/detect-dataview-links.service.test.ts
rm libs/core-application/src/lib/_tests/vault-parsing/dataview-html-sanitizer.service.test.ts
rm libs/core-application/src/lib/_tests/vault-parsing/dataview-links-integration.test.ts
```

### 3. Nettoyer les fixtures de tests

```bash
rm -rf apps/obsidian-vps-publish/src/_tests/fixtures/dataview/
# Créer 1 fixture minimale si nécessaire pour tests
```

### 4. Simplifier tests plugin

- Garder `dataview-block.parser.test.ts` (essentiel)
- Garder `dataview-link-corruption.test.ts` (validation bug fix)
- Supprimer `dataview-block-detection.test.ts` (redondant)
- Supprimer `dataview-to-markdown.converter.test.ts` (déjà testé dans core-application)
- Simplifier `dataview-integration.test.ts` (réduire à 2-3 cas critiques)

### 5. Nettoyer exports

- Retirer exports inutiles de `libs/core-application/src/lib/vault-parsing/index.ts`
- Vérifier `libs/core-application/src/lib/core-application.ts`

## Impact Estimation

### Fichiers supprimés : ~25 fichiers

- 10 docs (~2500 lignes)
- 5 fixtures (~500 lignes)
- 3 services backend + tests (~1500 lignes)
- 2-3 tests redondants (~400 lignes)

### Code conservé : ~15 fichiers essentiels

- Domain : 2 fichiers
- Application : 2 fichiers + 1 test
- Plugin : 4 fichiers + 3 tests
- Backend : 1 modification minimale

### Custom Index : 0 impact

Aucun fichier custom index ne sera touché.

## Validation

Après nettoyage :

```bash
npm run build  # Doit passer
npm run lint   # Doit passer
npm run test   # Tests essentiels doivent passer
```

Tests à vérifier :

- `markdown-link-normalizer.test.ts` ✅
- `dataview-block.parser.test.ts` ✅
- `dataview-link-corruption.test.ts` ✅
- `dataview-integration.test.ts` ✅ (simplifié)
- `resolve-custom-index.service.test.ts` ✅ (custom index intact)
