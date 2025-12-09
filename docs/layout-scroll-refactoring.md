# Refactoring du Layout et du Système de Scroll

**Date** : 8 décembre 2024  
**Branche** : `fix/style-mobile`  
**Périmètre** : Application Angular `apps/site`

---

## Contexte

L'application présentait plusieurs problèmes de scroll :

1. **Double-scroll** : scrollbars apparaissaient à la fois sur le `body` et dans des conteneurs internes (`.main` + `.content-wrapper`)
2. **Scroll inutile** : scrollbars visibles même quand le contenu était plus court que la fenêtre
3. **Footer flottant** : comportement incohérent du footer selon la hauteur du contenu
4. **Hauteurs en cascade** : `height: 100%` déclarés à tous les niveaux (html, body, :host, .grid) forçant des hauteurs fixes et créant des conflits

---

## Objectifs du refactoring

✅ **Un seul scroll vertical cohérent** : le scroll se fait naturellement sur le `body`, pas dans des conteneurs imbriqués  
✅ **Pas de scrollbar sur contenu court** : si le contenu tient dans la fenêtre, aucune scrollbar n'apparaît  
✅ **Footer sticky propre** : le footer reste en bas de page sur contenu court, et est poussé naturellement vers le bas sur contenu long  
✅ **Vault-explorer fonctionnel** : conserve son scroll interne sans interférer avec le scroll principal  
✅ **Responsive cohérent** : comportements desktop/mobile maintenus

---

## Changements apportés

### 1. `apps/site/src/styles.scss`

**Avant** :

```scss
html,
body {
  height: 100%;
  margin: 0;
  padding: 0;
  overflow: hidden; // Désactive tout scroll sur html/body
}
```

**Après** :

```scss
html,
body {
  margin: 0;
  padding: 0;
  /* Permet le scroll naturel sur body - le conteneur principal (shell) gère sa hauteur avec min-height: 100vh */
}
```

**Justification** : Supprimer `overflow: hidden` autorise le scroll naturel sur le `body`. Le shell (conteneur principal) utilise `min-height: 100vh` pour garantir qu'il occupe au moins la hauteur de la fenêtre, sans forcer de hauteur fixe.

---

### 2. `apps/site/src/presentation/shell/shell.component.scss`

#### 2.1. `:host`

**Avant** :

```scss
:host {
  display: block;
  height: 100%;
  width: 100%;
  overflow: hidden;
  color: var(--c-on-surface);
  background: var(--c-background);
}
```

**Après** :

```scss
:host {
  display: block;
  /* Hauteur minimum = viewport, permet au contenu de pousser le footer naturellement si nécessaire */
  min-height: 100vh;
  color: var(--c-on-surface);
  background: var(--c-background);
}
```

**Justification** : `min-height: 100vh` au lieu de `height: 100%` permet au contenu de s'étendre au-delà de la fenêtre si nécessaire, tout en garantissant que le footer reste en bas sur contenu court. Plus besoin de `overflow: hidden`.

---

#### 2.2. `.grid`

**Avant** :

```scss
.grid {
  display: grid;
  grid-template-columns: min-content 1fr;
  grid-template-rows: $row-top 1fr;
  grid-template-areas:
    'Logo TopBar'
    'vault-explorer main';
  gap: 0;

  height: 100%;
  width: 100%;
  background: var(--c-background);
  transition: grid-template-columns 0.3s cubic-bezier(0.4, 0, 0.2, 1);
}
```

**Après** :

```scss
.grid {
  display: grid;
  grid-template-columns: min-content 1fr;
  grid-template-rows: $row-top 1fr;
  grid-template-areas:
    'Logo TopBar'
    'vault-explorer main';
  gap: 0;

  /* Hauteur minimum = viewport pour garantir footer sticky sur contenu court */
  min-height: 100vh;
  background: var(--c-background);
  transition: grid-template-columns 0.3s cubic-bezier(0.4, 0, 0.2, 1);
}
```

**Justification** : Même logique que `:host`. La grid occupe au minimum toute la hauteur de la fenêtre, mais peut s'étendre si le contenu est plus long. Plus besoin de `height: 100%` ni `width: 100%`.

---

#### 2.3. `.vault-explorer`

**Avant** :

```scss
.vault-explorer {
  grid-area: vault-explorer;
  position: relative;
  display: flex;
  flex-direction: column;
  background: var(--c-surface);
  border-right: 2px solid var(--c-outline-strong);

  min-width: 0;
  min-height: 0;
  overflow: hidden;
  transition: opacity 0.3s ease;

  app-vault-explorer {
    flex: 1 1 auto;
    min-height: 0;
    inline-size: 100%;
    block-size: 100%;
    display: block;
  }
}
```

**Après** :

```scss
.vault-explorer {
  grid-area: vault-explorer;
  position: relative;
  display: flex;
  flex-direction: column;
  background: var(--c-surface);
  border-right: 2px solid var(--c-outline-strong);

  /* Permet au vault-explorer de remplir toute la hauteur de sa zone grid */
  min-height: 0;
  transition: opacity 0.3s ease;

  app-vault-explorer {
    flex: 1 1 auto;
    min-height: 0;
    inline-size: 100%;
    /* Le vault-explorer gère son propre scroll interne via .tree-wrap */
    display: block;
  }
}
```

**Justification** : Suppression de `overflow: hidden` et `block-size: 100%` pour laisser le composant enfant gérer son propre scroll interne. Le `vault-explorer` remplit naturellement toute la hauteur de sa zone grid grâce à `grid-template-rows: $row-top 1fr`.

---

#### 2.4. `.main` et `.content-wrapper` (CLEF DU REFACTORING)

**Avant** :

```scss
.main {
  grid-area: main;
  display: flex;
  flex-direction: column;
  background: var(--c-background);
  min-width: 0;
  min-height: 0;
  overflow-y: auto; // ⚠️ SCROLL ICI
  padding: clamp(0.75rem, 2vw, 1.5rem) clamp(0.75rem, 3vw, 2rem) 0;
}

.content-wrapper {
  flex: 1 1 0;
  min-height: 0;
  overflow-y: auto; // ⚠️ ET AUSSI ICI → DOUBLE SCROLL
  overflow-x: hidden;
  padding-bottom: clamp(0.75rem, 2vw, 1.5rem);
  scroll-behavior: smooth;
  -webkit-overflow-scrolling: touch;

  router-outlet {
    display: contents;
  }
}
```

**Après** :

```scss
.main {
  grid-area: main;
  display: flex;
  flex-direction: column;
  background: var(--c-background);
  min-height: 0;

  /* Padding latéral + top, bottom géré par content-wrapper et footer */
  padding: clamp(0.75rem, 2vw, 1.5rem) clamp(0.75rem, 3vw, 2rem) 0;
}

.content-wrapper {
  /* Prend tout l'espace disponible, pousse le footer vers le bas */
  flex: 1 1 auto;
  /* Pas de hauteur fixe ni overflow - le contenu s'étend naturellement */
  padding-bottom: clamp(0.75rem, 2vw, 1.5rem);

  router-outlet {
    display: contents;
  }
}
```

**Justification** : **Élimination du double-scroll**. Le scroll se fait maintenant naturellement sur le `body`, pas dans des conteneurs internes. `.content-wrapper` utilise `flex: 1 1 auto` pour pousser le footer vers le bas quand le contenu est court, et s'étend naturellement quand le contenu est long.

---

#### 2.5. `.footer`

**Avant** :

```scss
.footer {
  flex: 0 0 auto;
  height: clamp(2.5rem, 5vh, 3rem);
  display: flex;
  align-items: center;
  justify-content: center;
  gap: clamp(0.4rem, 1vw, 0.75rem);
  font-size: clamp(0.8rem, 1.5vw, 0.95rem);
  margin-left: calc(-1 * clamp(0.75rem, 3vw, 2rem));
  padding: 0 clamp(0.75rem, 3vw, 2rem);
  color: var(--c-on-surface-variant);
}
```

**Après** :

```scss
.footer {
  /* Footer sticky : flex-shrink 0 pour ne jamais se réduire, reste en bas */
  flex: 0 0 auto;
  height: clamp(2.5rem, 5vh, 3rem);
  display: flex;
  align-items: center;
  justify-content: center;
  gap: clamp(0.4rem, 1vw, 0.75rem);
  font-size: clamp(0.8rem, 1.5vw, 0.95rem);
  /* Compense le padding latéral de .main pour occuper toute la largeur */
  margin-left: calc(-1 * clamp(0.75rem, 3vw, 2rem));
  margin-right: calc(-1 * clamp(0.75rem, 3vw, 2rem));
  padding: 0 clamp(0.75rem, 3vw, 2rem);
  color: var(--c-on-surface-variant);
  background: var(--c-background);
}
```

**Justification** : Ajout de `margin-right` pour compenser le padding de `.main` des deux côtés, et ajout d'un `background` pour garantir que le footer ne soit pas transparent. Le footer reste collé en bas grâce à `flex: 0 0 auto` dans une colonne flex.

---

#### 2.6. Responsive (mobile)

**Changements principaux** :

- Sur mobile, le `.vault-explorer` devient un overlay fixe avec `overflow-y: auto` pour gérer son propre scroll
- `.main` n'a plus de `overflow-y: auto` ni `overflow-x: hidden` → le scroll se fait sur le body
- Le footer conserve ses marges latérales négatives adaptées au padding de `.main` à chaque breakpoint

**Exemple (max-width: 900px)** :

```scss
.vault-explorer {
  // ...overlay fixe
  overflow-y: auto;
  overflow-x: hidden;
  -webkit-overflow-scrolling: touch;
  // ...
}

.main {
  /* Sur mobile, pas de double-scroll, le body scroll naturellement */
  padding: clamp(0.5rem, 2vw, 1rem);
}

.footer {
  // ... adapt margins
  margin-left: calc(-1 * clamp(0.5rem, 2vw, 1rem));
  margin-right: calc(-1 * clamp(0.5rem, 2vw, 1rem));
}
```

---

### 3. `apps/site/src/presentation/components/vault-explorer/vault-explorer.component.scss`

#### 3.1. `.explorer`

**Avant** :

```scss
.explorer {
  position: relative;
  display: flex;
  flex-direction: column;
  block-size: 100%;
  min-block-size: 0;
  color: var(--on-surface);
  background: var(--bg-surface);

  // Better scrolling performance
  overflow: hidden; // ⚠️ Empêche le scroll
  // ...
}
```

**Après** :

```scss
.explorer {
  position: relative;
  display: flex;
  flex-direction: column;
  block-size: 100%;
  min-block-size: 0;
  color: var(--on-surface);
  background: var(--bg-surface);
  // ...
}
```

**Justification** : Suppression de `overflow: hidden` pour permettre au `.tree-wrap` enfant de gérer son scroll vertical.

---

#### 3.2. `.search` et `.sep`

**Avant** :

```scss
.search {
  margin: 4px;
  // ...
}

.sep {
  margin: 0 4px 4px;
}
```

**Après** :

```scss
.search {
  /* Flex-shrink 0 pour ne jamais compresser la barre de recherche */
  flex: 0 0 auto;
  margin: 4px;
  // ...
}

.sep {
  flex: 0 0 auto;
  margin: 0 4px 4px;
}
```

**Justification** : Ajout de `flex: 0 0 auto` pour garantir que la barre de recherche et le séparateur ne se compressent jamais, même quand `.tree-wrap` grandit.

---

#### 3.3. `.tree-wrap`

**Avant** :

```scss
.tree-wrap {
  position: relative;
  flex: 1 1 auto;
  overflow-y: auto;
  overflow-x: hidden;
  padding-bottom: 4px;

  // Smooth scrolling
  scroll-behavior: smooth;
  -webkit-overflow-scrolling: touch;
}
```

**Après** :

```scss
.tree-wrap {
  position: relative;
  /* Prend tout l'espace disponible et active le scroll vertical */
  flex: 1 1 auto;
  overflow-y: auto;
  overflow-x: hidden;
  padding-bottom: 4px;
  min-height: 0; /* Important pour permettre au scroll de fonctionner dans un conteneur flex */

  // Smooth scrolling
  scroll-behavior: smooth;
  -webkit-overflow-scrolling: touch;
}
```

**Justification** : Ajout de `min-height: 0` pour forcer le conteneur flex à ne pas s'étendre indéfiniment. Cela permet au scroll de fonctionner correctement dans un conteneur flexbox.

---

#### 3.4. Mobile (max-width: 768px)

**Avant** :

```scss
.tree-wrap {
  // Remove internal scroll in mobile overlay - parent handles it
  overflow-y: visible;
  overflow-x: hidden;
  padding: 0 4px 8px;
}
```

**Après** :

```scss
.tree-wrap {
  /* Mobile overlay : conserve le scroll interne, le parent (.vault-explorer) est déjà scrollable */
  padding: 0 4px 8px;
}
```

**Justification** : Sur mobile, le `.vault-explorer` (parent) est un overlay fixe avec `overflow-y: auto`. Le `.tree-wrap` conserve son propre scroll interne pour permettre la navigation, sans conflit avec le scroll du parent.

---

## Architecture finale du système de scroll

```
body (scroll naturel autorisé)
└─ app-shell (:host, min-height: 100vh)
   └─ .grid (min-height: 100vh, CSS Grid)
      ├─ .Logo (header, hauteur fixe)
      ├─ .TopBar (header, hauteur fixe)
      ├─ .vault-explorer (sidebar, rempli par grid row)
      │  └─ app-vault-explorer
      │     └─ .explorer (flex column, height: 100%)
      │        ├─ .search (flex: 0 0 auto)
      │        ├─ .sep (flex: 0 0 auto)
      │        └─ .tree-wrap (flex: 1 1 auto, overflow-y: auto, min-height: 0)
      │           └─ SCROLL INTERNE (liste de fichiers/dossiers)
      └─ .main (flex column, rempli par grid row)
         ├─ .content-wrapper (flex: 1 1 auto, pas de overflow)
         │  └─ router-outlet (home, viewer, search...)
         │     └─ CONTENU QUI S'ÉTEND NATURELLEMENT
         └─ .footer (flex: 0 0 auto, sticky bottom)
```

**Point clé** :

- ✅ Un seul scroll principal sur le `body`
- ✅ Un scroll secondaire interne dans `.tree-wrap` (vault-explorer)
- ✅ Pas de scroll dans `.main` ni `.content-wrapper`
- ✅ Footer sticky grâce à `flex: 0 0 auto` dans une colonne flex

---

## Tests de validation

À tester après ce refactoring :

1. **Desktop (> 901px)** :
   - [ ] Aucune scrollbar si contenu court (page home)
   - [ ] Une seule scrollbar verticale si contenu long (page viewer avec article long)
   - [ ] Footer collé en bas sur contenu court
   - [ ] Footer poussé naturellement vers le bas sur contenu long
   - [ ] Vault-explorer scroll indépendamment du contenu principal

2. **Tablette (768px - 900px)** :
   - [ ] Mêmes comportements que desktop
   - [ ] Sidebar collapsable fonctionne

3. **Mobile (< 768px)** :
   - [ ] Vault-explorer en overlay avec son propre scroll
   - [ ] Pas de double-scroll
   - [ ] Footer reste en bas, responsive

4. **Navigation** :
   - [ ] Changement de page (home → viewer → search) : pas de scroll parasite
   - [ ] Scroll position réinitialisée ou conservée selon la route (comportement actuel)

---

## Résolution de problèmes

### Problème : scrollbar apparaît alors que le contenu est court

**Cause** : Un élément enfant a une hauteur fixe (`height: 100%`, `height: 100vh`) qui force un scroll.

**Solution** : Vérifier les pages (home, viewer, search) et leurs composants. S'assurer qu'aucun `:host { height: 100%; }` n'est déclaré.

---

### Problème : footer ne reste pas en bas sur contenu court

**Cause** : `.content-wrapper` n'utilise pas `flex: 1 1 auto`, ou la grid/flex parente n'a pas de hauteur minimale.

**Solution** : Vérifier que :

- `.grid` a `min-height: 100vh`
- `.main` est un flex container (column)
- `.content-wrapper` a `flex: 1 1 auto`
- `.footer` a `flex: 0 0 auto`

---

### Problème : double-scroll revient

**Cause** : Un nouveau composant ou une page a ajouté `overflow-y: auto` sans nécessité.

**Solution** : Rechercher `overflow-y: auto` dans les fichiers SCSS récemment modifiés. Supprimer les occurrences inutiles.

---

## Maintenance future

### Règles à respecter

1. **Jamais de `height: 100%` en cascade** : privilégier `min-height: 100vh` au niveau global, laisser le contenu s'étendre naturellement
2. **Un seul scroll vertical** : uniquement sur le `body` + scroll interne du vault-explorer
3. **Pas de `overflow: hidden` sur html/body** : sauf cas très spécifique (modal, overlay temporaire)
4. **Footer sticky via flexbox** : `.content-wrapper` avec `flex: 1 1 auto`, `.footer` avec `flex: 0 0 auto`

### Pattern recommandé pour nouvelles pages

```scss
// apps/site/src/presentation/pages/nouvelle-page/nouvelle-page.component.scss

:host {
  display: block;
  /* PAS de height: 100%, laisse le contenu s'étendre naturellement */
}

.container {
  /* Layout interne avec flexbox/grid si nécessaire */
  display: flex;
  flex-direction: column;
  gap: 1rem;
  /* PAS de overflow-y: auto, le scroll se fait sur body */
}

/* Cas spécifique : liste longue qui doit scroller indépendamment */
.liste-specifique {
  /* Seulement si absolument nécessaire */
  max-height: 300px;
  overflow-y: auto;
}
```

---

## Références

- **Documentation interne** :
  - `docs/responsive-sidebar-refactoring.md` : Sidebar collapsable/redimensionnable
  - `docs/angular-modernization.md` : Angular 20, signaux, standalone
  - `docs/architecture.md` : Clean architecture, CQRS

- **Commits liés** :
  - Branche `fix/style-mobile`

- **Fichiers modifiés** :
  - `apps/site/src/styles.scss`
  - `apps/site/src/presentation/shell/shell.component.scss`
  - `apps/site/src/presentation/components/vault-explorer/vault-explorer.component.scss`

---

**Auteur** : GitHub Copilot (Claude Sonnet 4.5)  
**Date** : 8 décembre 2024
