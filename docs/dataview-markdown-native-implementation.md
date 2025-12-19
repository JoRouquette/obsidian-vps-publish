# Dataview → Markdown Native Implementation

**Date**: 2024-12-19  
**Status**: ✅ IMPLEMENTED  
**Branch**: feat/implement-dataview

## Objectif

Convertir les blocs Dataview (`dataview` et `dataviewjs`) en **Markdown Obsidian natif** (wikilinks `[[...]]`, inclusions `![[...]]`, tables MD, listes) **avant** l'upload au serveur, afin que la pipeline existante (indexation wikilinks, assets, routing) fonctionne correctement.

## Problème Résolu

### Ancien Système (HTML - ❌ PROBLÉMATIQUE)

```
Plugin Obsidian:
  notes → parseDataviewBlocks → DataviewRenderer
    ↓
  Retourne HTML: <table class="dataview">, <span class="wikilink" data-wikilink="...">
    ↓
  Upload au serveur (content contient du HTML Dataview)
    ↓
Serveur Node:
  MarkdownItRenderer → traite le HTML ❌
  Pipeline wikilinks/assets cassée ❌
```

**Problèmes**:

- HTML Dataview non compatible avec la pipeline d'indexation
- Wikilinks sous forme de `<span data-wikilink>` non détectés
- Inclusions non détectées
- Routing cassé

### Nouveau Système (Markdown Natif - ✅ SOLUTION)

```
Plugin Obsidian:
  notes → processDataviewBlocks → DataviewExecutor
    ↓
  Exécute via API Dataview → résultats structurés (objets, arrays)
    ↓
  DataviewToMarkdownConverter → convertit en Markdown natif
    ↓
  Remplace blocs par Markdown (wikilinks [[...]], tables |...|, listes -)
    ↓
  Upload au serveur (content = Markdown pur)
    ↓
Serveur Node:
  MarkdownItRenderer → traite markdown + wikilinks ✅
  Pipeline wikilinks/assets/routing fonctionne ✅
```

## Architecture

### Fichiers Créés

#### 1. `DataviewToMarkdownConverter` (Application Layer)

**Localisation**: `libs/core-application/src/lib/dataview/dataview-to-markdown.converter.ts`

**Responsabilité**: Convertir les résultats de l'API Dataview en Markdown Obsidian natif.

**Méthodes**:

- `convertQueryToMarkdown(result, queryType)`: Convertit LIST/TABLE/TASK/CALENDAR en Markdown
- `convertJsToMarkdown(jsResult)`: Convertit DOM DataviewJS en Markdown
- `formatValueAsMarkdown(value)`: Convertit objets Link Dataview en wikilinks

**Exemples de conversion**:

```typescript
// Link Dataview → Wikilink
{ path: 'Notes/Page1', display: 'Page 1' } → [[Notes/Page1|Page 1]]
{ path: 'Notes/Page2' } → [[Notes/Page2]]

// Embed → Inclusion
{ path: 'assets/img.png', embed: true } → ![[assets/img.png]]

// LIST query → Markdown list
values: ['Item 1', 'Item 2'] → - Item 1\n- Item 2

// TABLE query → Markdown table
headers: ['Name', 'Author'], values: [['Book A', 'John']]
→ | Name | Author |
  | --- | --- |
  | Book A | John |

// TASK query → Checkboxes
{ text: 'Task', completed: false } → - [ ] Task
{ text: 'Done', completed: true } → - [x] Done
```

#### 2. `DataviewExecutor` (Infrastructure Layer)

**Localisation**: `apps/obsidian-vps-publish/src/lib/dataview/dataview-executor.ts`

**Responsabilité**: Exécuter les requêtes Dataview via l'API Obsidian, retourner des **données structurées** (pas du HTML).

**Méthodes**:

- `executeBlock(block, filePath)`: Execute query ou JS
- `executeQuery(query, filePath)`: Execute DQL via `dataviewApi.query()`
- `executeJs(code, filePath)`: Execute JS via `dataviewApi.executeJs()`

**Retour**:

- Query: `{ success: true, data: { values: [...], headers: [...] } }`
- JS: `{ success: true, container: HTMLElement }` (DOM à convertir)
- Erreur: `{ success: false, error: string }`

#### 3. `processDataviewBlocks` (Service)

**Localisation**: `apps/obsidian-vps-publish/src/lib/dataview/process-dataview-blocks.service.ts`

**Responsabilité**: Orchestrer la pipeline complète : parse → execute → convert → replace.

**Flux**:

```typescript
1. parseDataviewBlocks(content) → détecte tous les blocs
2. Pour chaque bloc:
   a. executor.executeBlock() → résultats structurés
   b. converter.convert*ToMarkdown() → Markdown natif
3. Remplace blocs dans content (ordre inverse pour préserver indices)
4. Retourne content modifié + metadata
```

### Intégration dans ParseContentHandler

**Fichier**: `apps/obsidian-vps-publish/src/main.ts`

````typescript
const dataviewProcessor = async (notes: PublishableNote[]): Promise<PublishableNote[]> => {
  const executor = dataviewApi ? new DataviewExecutor(dataviewApi, this.app) : undefined;

  return Promise.all(
    notes.map(async (note) => {
      const result = await processDataviewBlocks(note.content, executor, note.vaultPath);

      return {
        ...note,
        content: result.content, // Markdown natif, plus de blocs ```dataview
      };
    })
  );
};
````

**Résultat**: Les notes uploadées au serveur contiennent uniquement du Markdown natif, sans aucun bloc `dataview` ou `dataviewjs`.

## Gestion des Erreurs

### Sans Plugin Dataview

Si le plugin Dataview n'est pas installé/activé :

```markdown
> [!warning] Dataview Plugin Required
> This Dataview query could not be rendered because the Dataview plugin is not enabled.
> Please install and enable the Dataview plugin in Obsidian.
```

### Erreur d'Exécution

Si une requête échoue :

```markdown
> [!warning] Dataview Query Error
> Invalid query syntax
```

### Erreur Inattendue

Si une exception est levée :

```markdown
> [!error] Unexpected Error
> TypeError: cannot read property 'values' of undefined
```

## Tests

### Tests Unitaires

**Fichier**: `apps/obsidian-vps-publish/src/_tests/dataview-to-markdown.converter.test.ts`

- Conversion LIST → Markdown list
- Conversion TABLE → Markdown table
- Conversion TASK → Checkboxes
- Conversion DataviewJS DOM → Markdown
- Wikilinks, inclusions, erreurs

### Tests d'Intégration

**Fichier**: `apps/obsidian-vps-publish/src/_tests/dataview-integration.test.ts`

- Pipeline complète avec mock executor
- Scénarios réels (notes avec multiples blocs)
- Fallback sans executor
- Préservation du contenu non-Dataview

## Fichiers Obsolètes (À Supprimer)

Les fichiers suivants ne sont **plus utilisés** et peuvent être supprimés :

### 1. `dataview-renderer.ts` (ancien)

**Raison**: Rendait en HTML au lieu de Markdown natif.  
**Remplacé par**: `DataviewExecutor` + `DataviewToMarkdownConverter`

### 2. `dataview-blocks-processor.service.ts` (ancien)

**Raison**: Utilisait le renderer HTML.  
**Remplacé par**: `process-dataview-blocks.service.ts` (nouveau)

### 3. `dataview-block.serializer.ts`

**Raison**: Créait des placeholders HTML `<div class="dv-block" data-dv-encoded>`.  
**Remplacé par**: Conversion directe en Markdown natif.

### 4. `dataview-block.replacer.ts`

**Raison**: Remplaçait par HTML.  
**Remplacé par**: Remplacement intégré dans `processDataviewBlocks` (Markdown).

### 5. `normalize-dataview-links.ts` (côté serveur)

**Localisation**: `apps/node/src/infra/markdown/normalize-dataview-links.ts`

**Raison**: Tentait de post-traiter le HTML Dataview en regex.  
**Solution**: Plus nécessaire car le Markdown est déjà natif à l'upload.

### 6. Tests obsolètes

- `dataview-block-detection.test.ts` → Le parser existe toujours, test OK
- `dataview-replacement.test.ts` → Remplacé par `dataview-integration.test.ts`
- `dataview-blocks-processor.test.ts` → Obsolète (ancien processor HTML)
- `dataview-block.serializer.test.ts` → Obsolète (plus de serialization HTML)
- `dataview-block.parser.test.ts` → **À CONSERVER** (parser toujours utilisé)

## Validation

### Critères de Succès

✅ **Export d'une note contenant des blocs Dataview** :

- Les blocs sont remplacés par du Markdown natif
- Les wikilinks sont sous forme `[[...]]` ou `[[...|label]]`
- Les tables sont au format Markdown `| ... |`
- Les listes sont au format `- ...` ou `- [ ] ...`
- Pas de HTML Dataview dans le contenu final
- La pipeline serveur indexe/résout/route les wikilinks correctement

### Test Manuel

1. Créer une note dans Obsidian :

```markdown
# Test Dataview

\`\`\`dataview
LIST
where type="Book"
\`\`\`

\`\`\`dataview
TABLE title, author
where type="Book"
\`\`\`

\`\`\`dataviewjs
dv.list(dv.pages().file.link)
\`\`\`
```

2. Exporter via le plugin
3. Vérifier le contenu uploadé :
   - Pas de blocs ``dataview` ou ``dataviewjs`
   - Présence de wikilinks `[[...]]`
   - Présence de tables MD `| ... |`
   - Présence de listes MD `- ...`

## Migration

### Suppression du Code Obsolète

```bash
# Fichiers à supprimer
rm apps/obsidian-vps-publish/src/lib/dataview/dataview-renderer.ts
rm apps/obsidian-vps-publish/src/lib/dataview/dataview-blocks-processor.service.ts
rm apps/obsidian-vps-publish/src/lib/dataview/dataview-block.serializer.ts
rm apps/obsidian-vps-publish/src/lib/dataview/dataview-block.replacer.ts
rm apps/node/src/infra/markdown/normalize-dataview-links.ts

# Tests obsolètes
rm apps/obsidian-vps-publish/src/_tests/dataview-replacement.test.ts
rm apps/obsidian-vps-publish/src/_tests/dataview-blocks-processor.test.ts
rm apps/obsidian-vps-publish/src/_tests/dataview-block.serializer.test.ts
```

### Conserver

- `dataview-block.parser.ts` → Toujours utilisé pour détecter les blocs
- `dataview-block-detection.test.ts` → Test du parser
- `dataview-block.parser.test.ts` → Test du parser

## Compatibilité

### Rétrocompatibilité

**AUCUNE** : C'est une refonte complète. Le système précédent n'était pas en production.

### Dépendances

- **Plugin Dataview** : Optionnel (si absent, callout d'erreur)
- **Obsidian API** : Standard (Document DOM pour DataviewJS)
- **Clean Architecture** : Respectée (Domain → Application → Infrastructure)

## Performance

### Impact

- **Temps d'exécution** : Similaire à l'ancien système (exécution Dataview identique)
- **Taille du contenu** : Markdown natif généralement plus compact que HTML
- **Parsing côté serveur** : Plus simple (Markdown standard au lieu de HTML custom)

### Optimisations Futures

- Mettre en cache les résultats Dataview (si note non modifiée)
- Paralléliser l'exécution des blocs (actuellement séquentiel)

## Documentation Connexe

- [dataview-unified-architecture.md](./dataview-unified-architecture.md) - Architecture de l'ancien système
- [DATAVIEW-CONTEXT-FIX.md](./DATAVIEW-CONTEXT-FIX.md) - Fix du contexte sourcePath
- [dataview-html-integration-flow.md](./dataview-html-integration-flow.md) - Ancien flow HTML
