# Guide d'Implémentation Dataview

## Vue d'Ensemble

Les blocs de code Dataview et DataviewJS sont automatiquement traités par le plugin avant la publication :

- Les requêtes sont exécutées contre le vault
- Les résultats sont convertis en Markdown natif
- Le site publié génère du HTML statique (pas de dépendance Dataview au runtime)

## Architecture

### Couche Plugin (Obsidian)

**Fichier** : `apps/obsidian-vps-publish/src/lib/dataview/process-dataview-blocks.service.ts`

- Détecte les blocs de code Dataview dans les notes du vault
- Exécute les requêtes en utilisant l'API du plugin Dataview d'Obsidian
- Convertit les résultats HTML/JS en Markdown
- Retourne le contenu traité prêt pour la publication

### Couche Application

**Convertisseur** : `libs/core-application/src/lib/dataview/dataview-to-markdown.converter.ts`

Convertit les formats de sortie Dataview en Markdown :

- **Listes** (`<ul>`, `<ol>`) → Listes Markdown (`-`, `1.`)
- **Tableaux** → Tableaux Markdown avec pipes
- **Résultats vides** → Callout info `> [!info] No Results`
- **Wikilinks** → Format normalisé `[[path|title]]` sans extension `.md`

### Couche Backend (API Express)

Aucun traitement spécifique Dataview. Le backend reçoit du Markdown pré-traité depuis le plugin.

## Formats Supportés

### Types de Requêtes

```dataview
LIST FROM #tag
TABLE field1, field2 FROM "folder"
TASK WHERE !completed
CALENDAR date
```

### DataviewJS

```dataviewjs
dv.list(dv.pages("#tag").map(p => p.file.link))
dv.table(["Name", "Date"], pages.map(p => [p.name, p.date]))
```

## Détails d'Implémentation

### Normalisation des Wikilinks

**Problème** : Dataview génère des liens avec extensions `.md` qui sont corrompus par la fonctionnalité linkify de markdown-it.

**Solution** : `MarkdownLinkNormalizer` supprime le `.md` et convertit en format wikilink propre avant le rendu Markdown.

**Exemple** :

- Avant : `[[Ektaron/Character.md]]`
- Après : `[[Ektaron/Character|Character]]`

### Gestion des Résultats Vides

| Type                              | Sortie                                                    |
| --------------------------------- | --------------------------------------------------------- |
| Requête Dataview (aucun résultat) | `> [!info] No Results<br>This query returned no results.` |
| DataviewJS (aucune sortie)        | Chaîne vide (pas de HTML)                                 |

### Rendu des Listes

Assure une sortie HTML propre sans balises `<p>` non désirées à l'intérieur des éléments `<li>` :

```markdown
- Item 1
- Item 2
```

Rendu en :

```html
<ul>
  <li>Item 1</li>
  <li>Item 2</li>
</ul>
```

Pas :

```html
<ul>
  <li><p>Item 1</p></li>
</ul>
```

## Tests

### Tests Unitaires

- `DataviewToMarkdownConverter.test.ts` - Logique de conversion
- `MarkdownLinkNormalizer.test.ts` - Normalisation des liens

### Tests d'Intégration

- Traitement Dataview de bout en bout avec vraies notes du vault
- Tests anti-corruption pour prévenir `.md` dans les liens

## Configuration

Aucune configuration backend requise. Le traitement Dataview se fait dans le plugin en utilisant l'API d'Obsidian.

## Dépannage

### Problème : Blocs Dataview non traités

**Cause** : Le plugin Dataview d'Obsidian n'est pas installé ou désactivé.

**Solution** : S'assurer que Dataview est installé et activé dans Obsidian.

### Problème : Les wikilinks montrent l'extension `.md`

**Cause** : Ancienne version avant le correctif de normalisation.

**Solution** : Mettre à jour vers la dernière version (≥4.7.0).

### Problème : Les requêtes dataview vides affichent un avertissement

**Cause** : Comportement attendu pour plus de clarté.

**Solution** : Les requêtes vides génèrent intentionnellement un callout info.

## Documentation Connexe

- [Rendu Markdown](./rendu-markdown.md) - Wikilinks, footnotes, tags
- [Architecture](./architecture.md) - Structure du monorepo
- [Development](./development.md) - Configuration locale et tests
