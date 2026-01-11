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

Convertit les formats de sortie Dataview en Markdown **ou préserve le HTML pour DataviewJS** :

#### Requêtes DQL (```dataview)

- **Listes** (`<ul>`, `<ol>`) → Listes Markdown (`-`, `1.`)
- **Tableaux** → Tableaux Markdown avec pipes
- **Résultats vides** → Callout info `> [!info] No Results`
- **Wikilinks** → Format normalisé `[[path|title]]` **sans extension `.md`**
  - Les attributs HTML `data-wikilink` ou `href` contenant `.md` sont automatiquement nettoyés
  - Exception : les embeds d'assets (images, PDFs) conservent leur extension
  - Exemple : `data-wikilink="Notes/Page.md"` → `[[Notes/Page|Page]]`

#### Blocs DataviewJS (```dataviewjs)

- **Préservation HTML** : Le HTML généré par `dataviewjs` est retourné tel quel
- **Styles inline** : Les attributs `style` (background-color, font-weight, etc.) sont préservés
- **Balises riches** : `<em>`, `<strong>`, `<span>`, `<div>` conservés
- **Raison** : DataviewJS génère souvent du HTML complexe (badges colorés, layouts personnalisés) qui ne peut pas être représenté en Markdown

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

#### Formatage Riche avec DataviewJS

DataviewJS supporte le HTML complexe avec styles inline :

```dataviewjs
// Exemple : afficher les propriétés frontmatter avec formatage
const current = dv.current();
dv.span(`*${current.ecole} de niveau ${current.niveau}*`);
dv.paragraph(' ');

const details = [
  `***Temps d'incantation*** : ${current.temps_incantation}`,
  `***Portée*** : ${current.portee}`,
  `***Durée*** : ${current.duree}`
];
dv.list(details);
```

```dataviewjs
// Exemple : badges colorés pour les classes
const classes = dv.current().classes;
let display = "";
for (let classe of classes.sort()) {
  display += `<span style="background-color:#800020;color:white;margin-right:0.3vw;display:inline-block;padding:3px 5px;border-radius:3px;">${classe}</span>`;
}
dv.el("div", display);
```

Ces blocs sont rendus avec **préservation complète du HTML**, incluant :

- Balises d'emphase : `<em>`, `<strong>`
- Styles inline : `style="background-color:..."`
- Layouts personnalisés : `<div>`, `<span>` avec classes/attributs

#### Support de dv.view()

DataviewJS supporte **pleinement** l'appel de vues personnalisées via `dv.view()` :

```dataviewjs
// Appeler une vue personnalisée
await dv.view("my-custom-view", { parameter: "value" });
```

**Fonctionnement** :

- Les vues personnalisées sont des fichiers JavaScript dans votre vault (par exemple `views/my-custom-view.js`)
- Elles reçoivent l'objet `dv` et les paramètres passés
- Le HTML généré par la vue est capturé et préservé dans le contenu publié
- Les vues peuvent utiliser toutes les fonctionnalités `dv.*` (liste, table, span, el, etc.)

**Exemple de vue personnalisée** (`views/book-list.js`) :

```javascript
// Afficher une liste de livres avec métadonnées
const pages = dv.pages('#book').sort((p) => p.title);

for (const page of pages) {
  dv.span(`**${page.title}** by ${page.author} (${page.year})`);
  dv.paragraph(page.summary || 'No summary');
  dv.span('---');
}
```

**Appel dans une note** :

```dataviewjs
await dv.view("book-list");
```

**Avec paramètres** :

```dataviewjs
// Vue avec filtrage par tag
await dv.view("book-list", { tag: "#fantasy", limit: 10 });
```

**Important** : Les vues doivent être des fonctions **asynchrones** si elles utilisent `await`. Le plugin attend que l'exécution se termine avant de capturer le rendu.

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

### Problème : DataviewJS perd les styles (italique, gras, couleurs)

**Cause** : Ancienne version qui convertissait tout en Markdown (≤6.1.0).

**Solution** : Mettre à jour vers ≥6.1.1. Les blocs DataviewJS préservent maintenant le HTML avec tous les styles inline.

## Documentation Connexe

- [Rendu Markdown](./markdown-rendering.md) - Wikilinks, footnotes, tags
- [Architecture](../architecture.md) - Structure du monorepo
- [Development](../development.md) - Configuration locale et tests
