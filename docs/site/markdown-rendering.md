# Correctifs du rendu Markdown/HTML

Ce document détaille les corrections apportées au système de rendu Markdown pour résoudre trois problèmes identifiés dans le HTML généré.

## Vue d'ensemble

Trois problèmes majeurs ont été corrigés dans le pipeline de rendu Markdown → HTML :

1. **Wikilinks vers les headings** : `[[#Titre de Section]]` ne fonctionnaient pas
2. **IDs de footnotes invalides** : Les deux-points dans les IDs (ex: `fn:1`) cassaient les sélecteurs CSS
3. **Tags Markdown non filtrés** : Les tags comme `#todo`, `#à-faire` apparaissaient dans le HTML rendu

## 1. Wikilinks vers les headings

### Problème

Les wikilinks pointant vers des sections internes (`[[#Titre]]` ou `[[Page#Titre]]`) ne fonctionnaient pas car le texte du heading n'était pas converti en slug URL-safe matching les IDs générés par markdown-it.

**Exemple** :

- Wikilink source : `[[#Système de gouvernance]]`
- ID généré par markdown-it : `systeme-de-gouvernance`
- Lien généré (avant fix) : `<a href="#Système de gouvernance">` ❌
- Lien attendu : `<a href="#systeme-de-gouvernance">` ✅

### Solution

#### HeadingSlugger Service

Création d'un service dédié pour générer des slugs identiques à ceux de markdown-it :

```typescript
// apps/node/src/infra/markdown/heading-slugger.ts
export class HeadingSlugger {
  slugify(text: string): string {
    return text
      .normalize('NFKD') // Décompose les accents
      .replace(/[\u0300-\u036f]/g, '') // Supprime les diacritiques
      .toLowerCase()
      .replace(/[^\w\s-]/g, '') // Supprime caractères spéciaux
      .replace(/\s+/g, '-') // Espaces → hyphens
      .replace(/-+/g, '-') // Collapse hyphens multiples
      .replace(/^-+|-+$/g, ''); // Trim hyphens
  }
}
```

#### Intégration dans MarkdownItRenderer

Modification de `renderWikilink()` pour détecter et transformer les anchors :

```typescript
if (hrefTarget.includes('#')) {
  const [path, heading] = hrefTarget.split('#');
  if (heading) {
    const slug = this.headingSlugger.slugify(heading);
    hrefTarget = path ? `${path}#${slug}` : `#${slug}`;
  }
}
```

#### Tests

13 tests dans `apps/node/src/_tests/heading-slugger.test.ts` :

- Conversion en minuscules
- Suppression d'accents (français : é → e, à → a)
- Gestion caractères spéciaux
- Collapse espaces/hyphens multiples
- Cas réels du document "Le Code"

### Impact

✅ Les wikilinks `[[#Heading]]` fonctionnent maintenant correctement  
✅ Support complet des accents et caractères spéciaux français  
✅ Cohérence avec le comportement de markdown-it

---

## 2. Normalisation des IDs de footnotes

### Problème

Le plugin `markdown-it-footnote` génère des IDs avec des deux-points (`:`) :

- `id="fn:1"` pour la footnote
- `id="fnref:1"` pour la référence

**Problème** : Les deux-points invalident les sélecteurs CSS et compliquent le ciblage en JavaScript.

```css
/* Ne fonctionne pas */
#fn:1 {
  color: red;
}

/* Nécessite un échappement complexe */
#fn\:1 {
  color: red;
}
```

### Solution

#### Custom Footnote Renderers

Override des renderers du plugin `markdown-it-footnote` pour remplacer `:` par `-` :

```typescript
private customizeFootnoteRenderer(): void {
  // Référence (superscript dans le texte)
  this.md.renderer.rules.footnote_ref = (tokens, idx) => {
    const id = Number(tokens[idx].meta.id + 1);
    const refId = `fnref-${id}`;  // fnref:1 → fnref-1
    return `<sup class="footnote-ref"><a href="#fn-${id}" id="${refId}">...</a></sup>`;
  };

  // Footnote (dans la section <section class="footnotes">)
  this.md.renderer.rules.footnote_open = (tokens, idx) => {
    const id = Number(tokens[idx].meta.id + 1);
    return `<li id="fn-${id}" class="footnote-item">`;  // fn:1 → fn-1
  };

  // Lien retour (↩)
  this.md.renderer.rules.footnote_anchor = (tokens, idx) => {
    const id = Number(tokens[idx].meta.id + 1);
    const refId = `fnref-${id}`;
    return ` <a href="#${refId}" class="footnote-backref">↩</a>`;
  };
}
```

#### Structure HTML générée

**Avant** :

```html
<p>
  Texte avec footnote<sup><a href="#fn:1" id="fnref:1">1</a></sup>
</p>
<section class="footnotes">
  <li id="fn:1">Contenu <a href="#fnref:1">↩</a></li>
</section>
```

**Après** :

```html
<p>
  Texte avec footnote<sup><a href="#fn-1" id="fnref-1">1</a></sup>
</p>
<section class="footnotes">
  <li id="fn-1">Contenu <a href="#fnref-1">↩</a></li>
</section>
```

### Impact

✅ Sélecteurs CSS standards fonctionnent (`#fn-1`, `#fnref-2`)  
✅ Ciblage JavaScript simplifié  
✅ Conformité aux standards HTML5 pour les IDs

---

## 3. Filtrage des tags ignorés

### Problème

Les tags Markdown (hashtags) utilisés pour la gestion de contenu (`#todo`, `#à-faire`, `#wip`) apparaissaient dans le HTML rendu :

```html
<h4>Initiation au Code #à-compléter</h4>
<blockquote><p>#à-faire Ajouter des exemples.</p></blockquote>
```

Ces tags sont utiles pendant l'édition dans Obsidian mais ne doivent pas être visibles sur le site publié.

### Solution

#### TagFilterService

Service utilisant **cheerio** pour parser le DOM et supprimer les tags du texte uniquement (préserve code/attributs) :

```typescript
// apps/node/src/infra/markdown/tag-filter.service.ts
export class TagFilterService {
  filterTags(html: string, ignoredTags: string[]): string {
    const $ = load(html);
    const tagPattern = /(^|\s|[^\w])#([\p{L}\p{N}_-]+)/gu;

    const processTextInElement = (element) => {
      // Skip code/pre/script/style
      if (['code', 'pre', 'script', 'style'].includes(tagName)) return;

      element.contents().each((_, node) => {
        if (node.type === 'text') {
          node.data = node.data.replace(tagPattern, (match, prefix, tag) => {
            if (ignoredTags.includes(normalize(tag))) {
              return prefix; // Supprime le tag, garde le préfixe
            }
            return match;
          });
        }
      });
    };

    processTextInElement($.root());
    return $.html();
  }
}
```

#### Caractéristiques

- ✅ **Normalisation Unicode** : `#café` et `#cafe` sont équivalents (NFKD)
- ✅ **Case-insensitive** : `#TODO`, `#Todo`, `#todo` → tous supprimés
- ✅ **Préserve le code** : Tags dans `<code>` et `<pre>` intacts
- ✅ **Préserve les attributs** : `href="#section"` et `id="titre"` inchangés
- ✅ **Support Unicode complet** : Français, japonais, cyrillique...
- ✅ **Nettoyage des espaces** : Supprime les doubles espaces après tag

#### Intégration

Le `TagFilterService` est appelé dans `MarkdownItRenderer.render()` juste avant le return final :

```typescript
const filtered = this.tagFilter.filterTags(withStyles, ignoredTags);
return filtered;
```

**Note** : Pour l'instant, `ignoredTags` est un tableau vide. L'intégration avec la configuration des folders/VPS est prévue dans une future itération.

#### Tests

25 tests dans `apps/node/src/_tests/tag-filter.service.test.ts` :

- Tags simples dans paragraphes
- Tags avec accents (`#à-faire`, `#été`)
- Tags dans headings (h1-h6)
- Tags dans blockquotes
- Préservation code blocks
- Préservation attributs (href, id)
- Unicode (japonais, cyrillique)
- Edge cases (espaces, hyphens, underscores)

### Impact

✅ HTML rendu propre, sans tags de gestion  
✅ Support complet des accents français  
✅ Pas de régression sur le code ou les attributs

---

## Dépendances ajoutées

### Production

```json
{
  "cheerio": "^1.1.2", // DOM parsing pour TagFilterService
  "markdown-it-footnote": "^4.0.0" // Plugin footnotes pour markdown-it
}
```

### Développement

```json
{
  "@types/cheerio": "^0.22.35" // Types TypeScript pour cheerio
}
```

**Note** : `markdown-it-footnote` n'a pas de types officiels → déclaration manuelle dans `apps/node/src/types/markdown-it-footnote.d.ts`

---

## Tests

### Résumé

- **HeadingSlugger** : 13 tests ✅
- **TagFilterService** : 25 tests ✅
- **Total projet node** : 114 tests ✅
- **Zéro régression** sur les tests existants

### Exécution

```bash
# Tous les tests
npm test

# Tests spécifiques
npx nx test node --testPathPattern=heading-slugger
npx nx test node --testPathPattern=tag-filter
```

---

## Architecture

### Fichiers créés

```
apps/node/src/
├── infra/markdown/
│   ├── heading-slugger.ts          (nouveau)
│   └── tag-filter.service.ts       (nouveau)
├── _tests/
│   ├── heading-slugger.test.ts     (nouveau)
│   └── tag-filter.service.test.ts  (nouveau)
└── types/
    └── markdown-it-footnote.d.ts   (nouveau)
```

### Fichiers modifiés

```
apps/node/src/infra/markdown/
└── markdown-it.renderer.ts
    ├── Import HeadingSlugger, TagFilterService, footnote plugin
    ├── Ajout customizeFootnoteRenderer()
    ├── Modification renderWikilink() pour anchors
    └── Appel tagFilter.filterTags() avant return
```

---

## Exemples d'utilisation

### Wikilinks vers headings

**Markdown source** :

```markdown
Voir [[#Système de gouvernance]] pour plus de détails.
Consulter aussi [[Le Code#Mythes fondateurs]].
```

**HTML généré** :

```html
<p>
  Voir <a class="wikilink" href="#systeme-de-gouvernance">Système de gouvernance</a> pour plus de
  détails.
</p>
<p>
  Consulter aussi
  <a class="wikilink" href="/le-code#mythes-fondateurs">Le Code#Mythes fondateurs</a>.
</p>
```

### Footnotes

**Markdown source** :

```markdown
Texte avec footnote[^1].

[^1]: Contenu de la footnote.
```

**HTML généré** :

```html
<p>
  Texte avec footnote<sup class="footnote-ref"><a href="#fn-1" id="fnref-1">1</a></sup
  >.
</p>

<section class="footnotes" role="doc-endnotes">
  <hr />
  <ol class="footnotes-list">
    <li id="fn-1" class="footnote-item">
      <p>Contenu de la footnote. <a href="#fnref-1" class="footnote-backref">↩</a></p>
    </li>
  </ol>
</section>
```

### Tags filtrés

**Markdown source** :

```markdown
## Personnages historiques #à-compléter

> #à-faire Ajouter des exemples de personnages.

Le code `#todo` dans le code reste intact.
```

**HTML généré** (avec `ignoredTags: ['à-compléter', 'à-faire']`) :

```html
<h2>Personnages historiques</h2>

<blockquote>
  <p>Ajouter des exemples de personnages.</p>
</blockquote>

<p>Le code <code>#todo</code> dans le code reste intact.</p>
```

---

## Compatibilité

- ✅ **Node.js** : v20-alpine (Docker)
- ✅ **TypeScript** : ~5.9.2
- ✅ **markdown-it** : ^14.1.0
- ✅ **Pas de breaking changes** : toutes les fonctionnalités existantes préservées

---

## Prochaines étapes

### Configuration des tags ignorés

Actuellement, `ignoredTags` est hardcodé à `[]` dans `MarkdownItRenderer`. À implémenter :

1. Ajouter `ignoredTags?: string[]` dans `FolderConfig` ou `VPSConfig`
2. Passer la config au renderer via `PublishableNote`
3. Permettre la configuration par note (frontmatter) ou par folder

### Tests d'intégration end-to-end

Ajouter des tests vérifiant le pipeline complet :

- Note Obsidian avec wikilinks, footnotes, tags
- Upload via API
- Rendu HTML final avec tous les correctifs appliqués

---

## Références

- [markdown-it documentation](https://markdown-it.github.io/)
- [markdown-it-footnote plugin](https://github.com/markdown-it/markdown-it-footnote)
- [cheerio documentation](https://cheerio.js.org/)
- [HTML5 ID attribute spec](https://html.spec.whatwg.org/multipage/dom.html#the-id-attribute)
