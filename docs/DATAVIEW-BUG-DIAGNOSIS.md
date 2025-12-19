# Diagnostic du Bug Dataview: Liens Corrompus et HTML Invalide

**Date**: 2024-12-19  
**Problème**: Sortie HTML finale contient un mélange invalide de `<a class="wikilink">`, `[[...|...]]` en texte brut, `<span class="wikilink wikilink-unresolved">`, et URLs externes corrompues comme `<a href="http://Maladram.md">`.

---

## 🔍 Pipeline Actuel (Analyse Complète)

### Plugin Obsidian (Upload)

1. **Collecte** (`CollectNotesCommand`) → Raw Markdown
2. **Parse** (`ParseContentHandler`) → applique plusieurs transformations:
   - `normalizeFrontmatterService`
   - `evaluateIgnoreRulesHandler`
   - `inlineDataviewRenderer` (process `= dv.pages(...)` inline)
   - **`dataviewProcessor`** ✅ **Point d'injection Dataview blocks**
     - Appelle `processDataviewBlocks()`
     - Exécute Dataview → Convertit en Markdown
     - Remplace blocs `dataview`/`dataviewjs`
   - `leafletBlocksDetector`
   - `ensureTitleHeaderService`
   - `assetsDetector` (détecte `![[...]]`)
   - `wikilinkResolver` (détecte `[[...]]` et résout)
   - `computeRoutingService`

3. **Upload** → Envoie Markdown à Backend

### Backend Node (Rendu)

1. **Stockage** → Markdown stocké tel quel
2. **Rendu** (`MarkdownItRenderer`):
   - `injectAssets()` → Remplace `![[...]]` par HTML `<img>`, `<video>`, etc.
   - `injectWikilinks()` → Remplace `[[...]]` par:
     - `<a class="wikilink">` si résolu
     - `<span class="wikilink wikilink-unresolved">` si non résolu
   - `md.render()` → **markdown-it avec `linkify: true`**
     - ⚠️ **PROBLÈME IDENTIFIÉ**: `linkify` auto-link les patterns domain-like
     - Si texte contient `Something.md`, devient `<a href="http://Something.md">`

---

## 🐛 Bugs Identifiés

### Bug #1: `.md` dans le texte visible des wikilinks

**Code actuel** (`DataviewToMarkdownConverter.formatValueAsMarkdown()`):

```typescript
// Dataview Link object → wikilink
if (link.path && typeof link.path === 'string') {
  if (link.embed) {
    return `![[${link.path}]]`; // ❌ GARDE .md dans le path
  }

  if (link.display && link.display !== link.path) {
    return `[[${link.path}|${link.display}]]`; // ❌ path contient .md
  } else {
    return `[[${link.path}]]`; // ❌ path contient .md
  }
}
```

**Problème**:

- `link.path` de Dataview inclut `.md` → Ex: `Ektaron/Personnages/Héléna.md`
- Généré: `[[Ektaron/Personnages/Héléna.md]]` ou `[[Ektaron/Personnages/Héléna.md|Display]]`
- Attendu: `[[Ektaron/Personnages/Héléna|Héléna]]` (sans .md, alias = basename)

### Bug #2: Auto-linking markdown-it transforme `.md` en URL externe

**Code actuel** (`MarkdownItRenderer` constructor):

```typescript
this.md = new MarkdownIt({
  html: true,
  linkify: true, // ⚠️ PROBLÈME
  typographer: true,
});
```

**Chaîne causale**:

1. Dataview retourne un objet non-link (string ou object sans `.path`)
2. `formatValueAsMarkdown()` retourne texte brut contenant `.md`
   - Ex: dans un tableau: `"Dr Théodoric Maladram.md"`
3. Texte brut injecté dans Markdown → Uploadé
4. Backend: `md.render()` avec `linkify: true`
5. **markdown-it détecte `Maladram.md` comme domaine → `<a href="http://Maladram.md">`**

**Exemple concret**:

```markdown
| Personnage   | Lien        |
| ------------ | ----------- |
| Dr Théodoric | Maladram.md |
```

Devient:

```html
<td>Dr Théodoric <a href="http://Maladram.md">Maladram.md</a></td>
```

### Bug #3: Wikilinks non résolus restent en texte brut dans HTML

**Situation**:

- Plugin génère `[[Page Non Existante]]`
- Backend: `injectWikilinks()` ne trouve pas dans manifest
- `renderWikilink()` génère `<span class="wikilink wikilink-unresolved">`
- Mais si `[[...]]` pas détecté/résolu côté plugin, reste en texte → markdown-it le laisse brut

**Résultat**: HTML contient `[[Page]]` en texte → invalide

---

## 🎯 Objectifs de Correction (Non Négociables)

### 1. Normalisation des Liens Dataview

**Règle stricte**: Tout objet link Dataview doit être converti en:

```markdown
[[<vaultPathSansExtension>|<displayTitle>]]
```

- `vaultPathSansExtension`: Ex: `Ektaron/Personnages/Héléna` (sans `.md`)
- `displayTitle`: Basename sans extension, ou `link.display` si fourni
  - Ex: `Héléna` (pas `Héléna.md`, pas `Ektaron/Personnages/Héléna.md`)

**Exemples**:

| Dataview Link Input                   | Markdown Output              | ❌ Incorrect                  |
| ------------------------------------- | ---------------------------- | ----------------------------- |
| `{path: "Ektaron/Héléna.md"}`         | `[[Ektaron/Héléna\|Héléna]]` | `[[Ektaron/Héléna.md]]`       |
| `{path: "Page.md", display: "Alias"}` | `[[Page\|Alias]]`            | `[[Page.md\|Alias]]`          |
| `{path: "Img.png", embed: true}`      | `![[Img.png]]`               | OK (assets gardent extension) |

### 2. Suppression Auto-Linking Backend

**Action**: Désactiver `linkify: true` dans `MarkdownItRenderer`

**Raison**:

- Le Markdown uploadé contient déjà tous les liens sous forme wikilinks
- `linkify` ne doit PAS intervenir (crée faux positifs `.md` → URL externe)
- Les wikilinks sont transformés en `<a>` via `injectWikilinks()` **avant** `md.render()`

### 3. Protection Stricte Anti-HTML

**Règle**: `formatValueAsMarkdown()` ne doit **JAMAIS** retourner:

- Balises HTML (`<a>`, `<span>`, `<table>`, etc.)
- Attributs HTML (`class=`, `href=`, `data-*`)

**Seuls formats autorisés**:

- Wikilinks: `[[...]]` ou `[[...|...]]`
- Inclusions: `![[...]]`
- Texte brut
- Markdown natif (listes `-`, tables `|`)

---

## 🔧 Plan de Correction

### Phase 1: Créer `MarkdownLinkNormalizer` (Application Layer)

**Localisation**: `libs/core-application/src/lib/dataview/markdown-link-normalizer.ts`

**Responsabilité**:

- Convertir objets `DataviewLink` en wikilinks Obsidian normalisés
- Supprimer `.md` du path
- Générer alias = basename (sans extension, sans chemin)
- Gérer accents, espaces, apostrophes typographiques

**Interface**:

```typescript
export interface DataviewLink {
  path: string;
  display?: string;
  type?: string;
  embed?: boolean;
}

export class MarkdownLinkNormalizer {
  normalize(link: DataviewLink): string {
    // Retourne [[path|title]] avec path sans .md, title = basename
  }

  normalizeValue(value: unknown): string {
    // Détecte si value est un link, array de links, ou texte
    // Applique normalize() récursivement
  }
}
```

**Tests unitaires requis**:

- Accents: `Héléna.md` → `[[Héléna|Héléna]]`
- Espaces: `Dr Théodoric.md` → `[[Dr Théodoric|Dr Théodoric]]`
- Apostrophes: `L'Étoile.md` → `[[L'Étoile|L'Étoile]]`
- Chemins: `Ektaron/Personnages/Héléna.md` → `[[Ektaron/Personnages/Héléna|Héléna]]`
- Embeds: `{path: "Image.png", embed: true}` → `![[Image.png]]` (garde extension)

### Phase 2: Refondre `DataviewToMarkdownConverter`

**Modifications**:

1. **Injecter `MarkdownLinkNormalizer`** dans le constructeur
2. **Remplacer `formatValueAsMarkdown()`** par appel à `normalizer.normalizeValue()`
3. **Garantir zéro HTML** dans tous les renderers

**Fichiers impactés**:

- `libs/core-application/src/lib/dataview/dataview-to-markdown.converter.ts`
- Tests: `apps/obsidian-vps-publish/src/_tests/dataview-to-markdown.converter.test.ts`

### Phase 3: Désactiver `linkify` Backend

**Modification**:

```diff
// apps/node/src/infra/markdown/markdown-it.renderer.ts
this.md = new MarkdownIt({
  html: true,
- linkify: true,
+ linkify: false,  // Wikilinks already injected before render
  typographer: true,
});
```

**Tests à ajuster**:

- `apps/node/src/_tests/markdown-it-renderer.test.ts`
- Vérifier qu'aucun auto-linking ne se produit

### Phase 4: Tests d'Intégration

**Créer**: `apps/obsidian-vps-publish/src/_tests/dataview-link-corruption.test.ts`

**Cas de test "Dr Théodoric Maladram"**:

```typescript
it('should NOT generate external URLs from .md text in Dataview tables', async () => {
  const content = `
\`\`\`dataview
TABLE file.link AS Personnage
WHERE type = "NPC"
\`\`\`
`;

  const mockResult = {
    successful: true,
    value: {
      headers: ['Personnage'],
      values: [[{ path: 'Ektaron/Personnages/Maladram.md', display: 'Dr Théodoric Maladram' }]],
    },
  };

  const markdown = converter.convertQueryToMarkdown(mockResult, 'table');

  // ✅ Doit contenir wikilink avec alias
  expect(markdown).toContain('[[Ektaron/Personnages/Maladram|Dr Théodoric Maladram]]');

  // ❌ Ne doit PAS contenir .md dans le texte
  expect(markdown).not.toContain('Maladram.md');

  // ❌ Ne doit PAS contenir HTML
  expect(markdown).not.toMatch(/<a href=/);
  expect(markdown).not.toMatch(/<span class=/);

  // ❌ Ne doit PAS contenir http://
  expect(markdown).not.toContain('http://');
});
```

### Phase 5: Validation

**Checklist**:

- [ ] `npm run build` → ✅ Compile sans erreur
- [ ] `npm run lint` → ✅ Passe
- [ ] `npm run test` → ✅ Tous tests unitaires passent
- [ ] Test intégration "Dr Théodoric" → ✅ Aucun `http://Maladram.md`
- [ ] Test E2E manuel: créer note avec tableau Dataview → exporter → vérifier HTML final

---

## 📊 Impact Analysis

### Fichiers à Créer (1)

1. `libs/core-application/src/lib/dataview/markdown-link-normalizer.ts` (+ test)

### Fichiers à Modifier (3)

1. `libs/core-application/src/lib/dataview/dataview-to-markdown.converter.ts`
   - Inject normalizer
   - Replace `formatValueAsMarkdown()` logic

2. `apps/node/src/infra/markdown/markdown-it.renderer.ts`
   - Change `linkify: true` → `linkify: false`

3. `libs/core-application/src/lib/core-application.ts`
   - Export `MarkdownLinkNormalizer`

### Tests à Ajouter/Modifier (4)

1. **Nouveau**: `libs/core-application/src/lib/dataview/markdown-link-normalizer.test.ts`
2. **Nouveau**: `apps/obsidian-vps-publish/src/_tests/dataview-link-corruption.test.ts`
3. **Modifier**: `apps/obsidian-vps-publish/src/_tests/dataview-to-markdown.converter.test.ts`
4. **Modifier**: `apps/node/src/_tests/markdown-it-renderer.test.ts`

---

## ✅ Critère de Réussite Final

Après export d'une note contenant:

```markdown
\`\`\`dataview
TABLE file.link AS Personnage
WHERE contains(file.path, "Personnages")
\`\`\`
```

Le HTML final doit contenir:

✅ **Autorisé**:

- `<a class="wikilink" href="/notes/ektaron-personnages-helena">Héléna</a>` (wikilink résolu)
- `<span class="wikilink wikilink-unresolved">Page Non Existante</span>` (wikilink non résolu)

❌ **INTERDIT**:

- `[[Héléna]]` en texte brut dans HTML
- `<a href="http://Maladram.md">` (auto-link corrompu)
- `<span class="wikilink" data-wikilink="...">` vide de Dataview
- `.md` visible dans le texte (sauf dans data-wikilink attribute)
- Balises HTML Dataview (`<table class="dataview">`, `<div class="table-view-table">`)

---

## 🚀 Implémentation

Prêt à implémenter les corrections dans l'ordre suivant:

1. Créer `MarkdownLinkNormalizer` + tests unitaires
2. Refondre `DataviewToMarkdownConverter` pour utiliser le normalizer
3. Désactiver `linkify` backend
4. Ajouter tests d'intégration
5. Valider build + lint + tests
6. Test manuel E2E

**Estimation**: ~2h de développement + tests.
