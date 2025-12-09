# Service EnsureTitleHeaderService

## Vue d'ensemble

Le service `EnsureTitleHeaderService` fait partie du pipeline de parsing des notes côté API. Il garantit que chaque note possède un header markdown correspondant à son titre, juste après le frontmatter.

## Objectif

Lors du parsing d'une note :

1. Le titre est déterminé depuis le frontmatter ou le nom de fichier
2. Le frontmatter est retiré du contenu markdown
3. Le service vérifie si un header contenant le titre existe dans le contenu
4. Si absent, il insère automatiquement un header avec un niveau cohérent

## Position dans le pipeline

Le service est exécuté dans `ParseContentHandler`, **juste après** `ContentSanitizerService.stripFrontmatter()` :

```
notes → normalizeFrontmatter
     → noteMapper
     → evaluateIgnoreRules
     → inlineDataviewRenderer
     → contentSanitizer (stripFrontmatter)
     → 🆕 ensureTitleHeader ⬅️ ICI
     → assetsDetector
     → wikilinkResolver
     → computeRouting
```

## Règles de fonctionnement

### 1. Détection du titre

Le titre provient de `note.title`, qui est déjà déterminé en amont par :

- Le frontmatter (`title`, `name`, etc.)
- Le nom de fichier (si convention en place)

Si `note.title` est vide ou whitespace, **aucun header n'est ajouté**.

### 2. Recherche d'un header existant

Le service parcourt le contenu et extrait tous les headers markdown (H1 à H6).

Un header est considéré comme "correspondant au titre" si son texte normalisé (trim, lowercase, sans markdown inline basique) est égal au titre normalisé.

**Exemples de correspondance** :

- Titre `"My Title"` ↔ Header `# My Title` ✅
- Titre `"My Title"` ↔ Header `# my title` ✅ (insensible à la casse)
- Titre `"My Title"` ↔ Header `# **My Title**` ✅ (markdown inline ignoré)
- Titre `"My Title"` ↔ Header `##   My Title  ` ✅ (espaces en plus OK)

Si un tel header existe, **aucune modification n'est apportée**.

### 3. Calcul du niveau de header à insérer

Si aucun header correspondant n'existe, le service calcule le niveau approprié :

| Contexte                       | Niveau inséré  |
| ------------------------------ | -------------- |
| Aucun header dans la note      | **H1** (`#`)   |
| Seulement H2+ (pas de H1)      | **H1** (`#`)   |
| Seulement H3+ (pas de H1/H2)   | **H2** (`##`)  |
| Seulement H4+                  | **H3** (`###`) |
| Déjà un H1 (mais pas le titre) | **H1** (`#`)   |

**Règle générale** : `niveau = max(1, niveauMin - 1)`

Où `niveauMin` est le niveau le plus élevé (numérique le plus petit) trouvé dans la note.

### 4. Insertion du header

Le header est inséré :

- **Au tout début du contenu** (après retrait du frontmatter)
- Suivi de **deux lignes vides** (`\n\n`) pour séparer du reste du contenu
- Le contenu existant est préservé tel quel (y compris espaces blancs en début si présents)

**Exemple** :

Avant :

```markdown
## Section 1

Contenu de la section 1.

### Sous-section

Texte.
```

Après (titre = "Document") :

```markdown
# Document

## Section 1

Contenu de la section 1.

### Sous-section

Texte.
```

## Cas d'usage

### Note sans aucun header

```markdown
Titre: "Introduction"
Contenu: "Ceci est le texte brut."
```

→ Résultat :

```markdown
# Introduction

Ceci est le texte brut.
```

### Note avec H2 uniquement

```markdown
Titre: "Guide"
Contenu:

## Étape 1

Détails.

## Étape 2

Plus de détails.
```

→ Résultat :

```markdown
# Guide

## Étape 1

Détails.

## Étape 2

Plus de détails.
```

### Note avec header déjà présent

```markdown
Titre: "Mon Article"
Contenu:

# Mon Article

Contenu de l'article.
```

→ Résultat : **Aucun changement** (header déjà présent)

### Note avec header similaire mais formaté différemment

```markdown
Titre: "Tutorial"
Contenu:

## **Tutorial**

Étape 1...
```

→ Résultat :

```markdown
# Tutorial

## **Tutorial**

Étape 1...
```

_(Note : les deux headers sont considérés identiques, donc pas d'ajout)_

**Correction** : Dans ce cas, la normalisation détecterait que `"Tutorial"` == `"Tutorial"` (après suppression du markdown), donc **aucun header ne serait ajouté**.

## Tests

Le service dispose de :

- **20 tests unitaires** (`ensure-title-header.service.test.ts`) couvrant :
  - Notes sans header
  - Notes avec différents niveaux de headers (H2, H3, H4+)
  - Détection de headers existants (case-insensitive, markdown inline)
  - Titres vides ou whitespace
  - Cas particuliers (H6, titres avec caractères spéciaux)
- **9 tests d'intégration** (`ensure-title-header.service.integration.test.ts`) couvrant :
  - Contenu markdown complexe (listes, code blocks, wikilinks, assets)
  - Simulation post-frontmatter stripping
  - Titres avec caractères spéciaux
  - Titres avec markdown inline
  - Préservation de la structure du contenu

## Dépendances

Le service implémente `BaseService` et nécessite :

- `LoggerPort` (optionnel, pour traçage debug)

Il n'a **aucune dépendance externe** (pure TypeScript).

## Intégration dans d'autres contextes

Pour utiliser ce service dans un nouveau pipeline :

```typescript
import { EnsureTitleHeaderService } from '@core-application/vault-parsing/services/ensure-title-header.service';

const logger: LoggerPort = ...; // votre logger
const service = new EnsureTitleHeaderService(logger);

const updatedNotes = service.process(publishableNotes);
```

**Important** : Ce service doit être appelé **après** le retrait du frontmatter du contenu, sinon il détecterait le frontmatter comme du contenu et pourrait insérer le header au mauvais endroit.

## Limitations connues

1. **Markdown inline complexe** : Le service normalise seulement `**gras**`, `*italique*`, `_italique_`, `` `code` ``. D'autres formes (par ex. `~~barré~~`, liens, etc.) ne sont pas gérées.
2. **Headers dans code blocks** : Si le contenu contient un code block avec des headers markdown dedans, le service les détectera comme de vrais headers. Cela peut conduire à un calcul de niveau erroné, mais c'est un cas extrême peu probable.

3. **Titre multiligne** : Si le titre contient des retours à la ligne, le header inséré sera sur une seule ligne (trim appliqué).

## Évolutions futures possibles

- Support de détection plus robuste des headers (ignorer ceux dans code blocks/blockquotes)
- Normalisation plus poussée du markdown inline (liens, images, etc.)
- Option pour forcer un niveau spécifique de header (par configuration)
- Mode "strict" qui lève une erreur si le titre existe déjà avec un niveau différent

## Auteur & Date

- **Créé le** : 9 décembre 2024
- **Par** : AI Agent spécialisé parsing markdown
- **Version initiale** : 4.1.2
