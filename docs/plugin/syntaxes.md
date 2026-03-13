# Syntaxes Obsidian supportées

> ⚠️ **RÈGLE CRITIQUE** : Ce document DOIT rester synchronisé avec l'aide interne du plugin (`apps/obsidian-vps-publish/src/i18n/locales.ts` → sections `help`).

## Objectif

Documenter toutes les syntaxes Obsidian supportées par le plugin lors de la publication vers le VPS.

## Contrôle de publication

### Exclusion par frontmatter

Exclure une note de la publication :

```yaml
---
publish: false
---
```

Marquer comme draft (exclu si règle draft configurée) :

```yaml
---
draft: true
---
```

### Exclusion de sections avec `^no-publishing`

Vous pouvez exclure des sections spécifiques en utilisant le marqueur `^no-publishing`.

**Comportement** : Quand une ligne contient `^no-publishing`, le plugin supprime le contenu jusqu'au délimiteur précédent :

1. **Règle horizontale** (`---`, `***`, `___`) si présente (priorité haute)
2. **Header précédent** (`##`, `###`, etc.) si pas de règle horizontale
3. **Début du document** si aucun délimiteur trouvé

**Exemples avec délimiteurs** :

```markdown
## Public Header

Public content

---

Private content
^no-publishing

## Next Section
```

→ Seul le contenu entre `---` et le marqueur est supprimé. Le header est conservé.

```markdown
## Private Header

Private content
^no-publishing

## Public Section
```

→ Le header ET le contenu sont supprimés (pas de règle horizontale).

```markdown
Public start

---

Private section
^no-publishing
```

→ Fonctionne aussi avec `***` et `___` comme délimiteurs.

**Cas spécial : Début de document**

Si le marqueur est au tout début du document (sans contenu avant) :

```markdown
^no-publishing

## First Header

Public content
```

→ Seul le marqueur est supprimé, le reste du document est conservé.

Si un header se trouve immédiatement au début :

```markdown
## Private Header

^no-publishing

## Public Header

Public content
```

→ Le header privé et le marqueur sont supprimés, le contenu public est conservé.

**Note** : Les espaces vides excessifs (3+ lignes blanches consécutives) sont automatiquement réduits à 2 après suppression pour maintenir la lisibilité.

## Frontmatter

### Propriétés standards

```yaml
---
title: My Note
tags: [blog, tech]
publish: true
---
```

### Propriétés d'exclusion

Les notes avec `type: Dashboard` sont exclues par défaut.

```yaml
---
type: Dashboard
---
```

## Wikilinks et liens internes

### Formats supportés

- `[[Note]]` : Lien simple
- `[[Note|Display Text]]` : Lien avec texte custom
- `[[Note#Header]]` : Lien vers header
- `[[Note#Header|Custom Text]]` : Lien vers header avec texte custom
- `[[Folder/Note]]` : Lien avec chemin
- `[[#Header]]` : Lien vers header dans la page courante

**Exemples** :

```markdown
See [[Other Note]] for details.
Check [[Deep Concepts#Section|this section]].
Jump to [[#Introduction]].
```

→ Tous convertis en liens HTML valides avec ancres CSS-safe.

## Assets et images

### Images Obsidian

```markdown
![[screenshot.png]]
![[folder/diagram.svg]]
```

### Images Markdown

```markdown
![alt text](path/image.jpg)
![diagram](assets/diagram.svg)
```

### Fichiers attachés

PDFs, vidéos, et autres fichiers sont automatiquement détectés et uploadés.

**Configuration** : Dossier des assets configurable dans Settings → Vault & assets.

## Dataview

### Requêtes inline

```markdown
`= this.title`
`= this.tags`
`= dateformat(this.file.ctime, "yyyy-MM-dd")`
```

### Blocs Dataview

```markdown
\`\`\`dataview
LIST FROM #tag
WHERE publish = true
\`\`\`
```

### DataviewJS

```markdown
\`\`\`dataviewjs
dv.list(dv.pages("#blog").file.name)
\`\`\`
```

### Vues personnalisées (dv.view)

DataviewJS supporte les vues personnalisées réutilisables :

```markdown
\`\`\`dataviewjs
await dv.view("my-custom-view", { parameter: "value" })
\`\`\`
```

**Exemple de vue** (`views/book-list.js`) :

```javascript
const pages = dv.pages('#book').sort((p) => p.title);
for (const page of pages) {
  dv.span(`**${page.title}** by ${page.author}`);
  dv.paragraph('---');
}
```

→ Toutes les requêtes sont **exécutées côté plugin** et rendues en HTML avant upload.

## Cartes Leaflet

Les blocs ` ```leaflet ` sont détectés, parsés et remplacés par des placeholders HTML. Le rendu interactif se fait côté client sur le site publié.

### Propriétés supportées

| Propriété         | Type           | Obligatoire | Description                                |
| ----------------- | -------------- | ----------- | ------------------------------------------ |
| `id`              | string         | **oui**     | Identifiant unique de la carte             |
| `lat`             | number         | non         | Latitude du centre                         |
| `long` (ou `lon`) | number         | non         | Longitude du centre                        |
| `defaultZoom`     | number         | non         | Niveau de zoom initial                     |
| `minZoom`         | number         | non         | Zoom minimum autorisé                      |
| `maxZoom`         | number         | non         | Zoom maximum autorisé                      |
| `height`          | string         | non         | Hauteur CSS (ex: `500px`)                  |
| `width`           | string         | non         | Largeur CSS (ex: `100%`)                   |
| `darkMode`        | boolean        | non         | Forcer le mode sombre (`true`, `yes`, `1`) |
| `marker`          | format spécial | non         | Marqueur (voir ci-dessous)                 |
| `image`           | wikilink       | non         | Image overlay (ex: `[[map.png]]`)          |
| `scale`           | number         | non         | Échelle pour les images overlays           |
| `unit`            | string         | non         | Unité de mesure                            |
| `tileServer`      | URL            | non         | Serveur de tuiles custom                   |

Les lignes commençant par `#` sont traitées comme des commentaires et ignorées.

### Exemple minimal

```markdown
\`\`\`leaflet
id: map-1
lat: 48.8566
long: 2.3522
defaultZoom: 13
\`\`\`
```

### Marqueurs

Format : `marker: type, lat, long, [[Lien optionnel]]`

Plusieurs marqueurs peuvent être définis en répétant la ligne `marker:`.

```markdown
\`\`\`leaflet
id: map-paris
lat: 48.8566
long: 2.3522
defaultZoom: 12
marker: default, 48.8566, 2.3522, [[Paris]]
marker: custom, 48.8606, 2.3376, [[Louvre]]
\`\`\`
```

Le parser tolère aussi les variantes YAML-like :

```markdown
marker: - default, 48.8, 2.3
marker: - [custom, 51.5, -0.1, [[London]]]
```

### Image overlay (cartes fantasy)

Pour afficher une image personnalisée au lieu de tuiles OpenStreetMap :

```markdown
\`\`\`leaflet
id: fantasy-map
image: [[world-map.png]]
scale: 1000
darkMode: true
\`\`\`
```

→ L'image est centrée à `[0, 0]` en coordonnées pixel (CRS Simple).

### Tolérances du parser

- **Fins de ligne Windows** (CRLF) : supportées sans conversion préalable
- **Espaces après ` ```leaflet `** : ignorés automatiquement
- **Casse des clés** : insensible (`defaultZoom`, `DefaultZoom`, `DEFAULTZOOM` sont équivalents)
- **Bloc invalide** : conservé tel quel dans le contenu (pas de placeholder généré), un warning est émis dans les logs

## Markdown avancé

### Wikilinks vers headings

Liens vers headers dans la page courante ou une autre page :

```markdown
[[#Introduction]]
[[Page#Section]]
[[Other Note#Subsection|See here]]
```

→ Génère des ancres CSS-safe (caractères spéciaux, espaces, emojis gérés).

### Footnotes

Syntaxe standard Markdown avec IDs CSS-safe :

```markdown
Text with footnote[^1].

Another reference[^note-label].

[^1]: Footnote content here.

[^note-label]: Another footnote.
```

→ Les IDs de footnotes sont nettoyés pour être CSS-safe (pas de caractères spéciaux dans les ancres).

### Filtrage de tags inline

Les tags configurés dans **Settings → Ignore Rules → Tags** sont **automatiquement supprimés** du HTML rendu (headings, blockquotes, paragraphes, etc.).

**Exemple** :

Si vous configurez `#todo` et `#note` comme tags ignorés :

```markdown
# Title #todo

> #note Quote text

Paragraph with #todo tag.
```

→ Rendu HTML final :

```html
<h1>Title</h1>
<blockquote>Quote text</blockquote>
<p>Paragraph with tag.</p>
```

### Callouts

Callouts Obsidian sont supportés avec styles personnalisables :

```markdown
> [!note]
> This is a note callout.

> [!warning]
> Warning message.

> [!tip] Custom Title
> Tip with custom title.
```

**Aliases supportés** (selon spécification Obsidian Help) :

- `abstract` ← `summary`, `tldr`
- `tip` ← `hint`, `important`
- `success` ← `check`, `done`
- `question` ← `help`, `faq`
- `warning` ← `caution`, `attention`
- `failure` ← `fail`, `missing`
- `danger` ← `error`
- `quote` ← `cite`

Les aliases sont automatiquement convertis vers leur type canonique pour le rendu (couleur, icône, classes CSS).

**Configuration** : Vous pouvez ajouter des CSS custom dans Settings → Advanced → Callout styles.

## Configuration des règles d'exclusion

### Dans les Settings du plugin

**Ignore Rules** :

- **Frontmatter properties to exclude** : Liste de propriétés à ne pas inclure dans le HTML
- **Tags to filter** : Tags inline à supprimer du rendu (ex: `#todo`, `#draft`, `#wip`)
- **Draft rules** : Condition frontmatter pour exclure les drafts (ex: `draft: true`)

**Vault & assets** :

- **Assets folder** : Chemin relatif dans le vault (ex: `Assets/`, `Media/`)
- **Fallback vault root** : Chercher assets dans tout le vault si non trouvés

## Références

- Code source : `apps/obsidian-vps-publish/src/`
- Aide interne : `apps/obsidian-vps-publish/src/i18n/locales.ts` (sections `help`)
- Tests : `apps/obsidian-vps-publish/src/_tests/`

---

**Dernière mise à jour** : 2026-03-13  
**⚠️ À synchroniser avec l'aide interne** : Toute modification ici DOIT être répercutée dans `locales.ts` → `help` sections.
