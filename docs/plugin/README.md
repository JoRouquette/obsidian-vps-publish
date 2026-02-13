# Documentation Plugin Obsidian

> **English version:** [docs/en/plugin/](../en/plugin/)

Cette section contient la documentation relative au plugin Obsidian (`apps/obsidian-vps-publish`) : l'extension qui permet de publier du contenu depuis votre vault Obsidian vers votre VPS.

## 🎯 Vue d'ensemble

Le plugin Obsidian :

- Se connecte à un VPS configuré (URL + clé API)
- Collecte les notes et assets depuis le vault
- Upload le contenu par session (chunked upload pour gros fichiers)
- Applique des règles d'exclusion (publish: false, draft, tags ignorés, etc.)
- Fournit une aide interne détaillée sur les syntaxes supportées

## 📄 Documentation disponible

- **[Chunked Upload](./chunked-upload.md)** - Système d'upload par morceaux pour gros fichiers
- **[Syntaxes supportées](./syntaxes.md)** - Syntaxes Obsidian supportées (wikilinks, footnotes, callouts, etc.)
- **[Folders Settings UI](./folders-settings-ui.md)** - Configuration des dossiers de publication améliorée
- **[Testing Strategy](./testing-strategy.md)** - Stratégie de tests (unit + integration) pour la gestion des routes

### Performance & Optimisation

- **[Background Throttle - Guide de Test](./BACKGROUND_THROTTLE_TEST_GUIDE.md)** - Tester la détection de pauses lors de la perte de focus (instrumentation)
- **[Background Throttle - Analyse des Résultats](./BACKGROUND_THROTTLE_ANALYSIS.md)** - Résultats de test, métriques mesurées, patches implémentés
- **[Background Throttle - Rapport Technique](./BACKGROUND_THROTTLE_TECHNICAL_REPORT.md)** - Analyse technique complète du monitoring de background throttling
- **[Background Throttle - Résumé](./BACKGROUND_THROTTLE_SUMMARY.md)** - Résumé exécutif de l'instrumentation installée

## 🚀 Installation

### Via release GitHub

1. Télécharger `vps-publish.zip` depuis [Releases](https://github.com/JoRouquette/obsidian-vps-publish/releases)
2. Extraire dans `.obsidian/plugins/vps-publish/`
3. Activer le plugin dans Obsidian : Settings → Community plugins

### Build manuel

```bash
npm install
npm run build:plugin
npm run package:plugin
```

Les fichiers sont générés dans `dist/vps-publish/`.

## ⚙️ Configuration

### Paramètres obligatoires

Dans les settings du plugin (Obsidian) :

- **URL du VPS** : `https://votre-vps.com`
- **Clé API** : Clé d'authentification (chiffrée localement)

### Paramètres de publication

- **Dossiers à publier** : Liste des dossiers du vault à inclure
- **Règles d'exclusion** :
  - Propriétés frontmatter à exclure
  - Tags à filtrer (ex: `#todo`, `#draft`)
  - Règles de draft (ex: `draft: true`)

### Paramètres avancés

- **Dossier des assets** : Chemin relatif dans le vault (ex: `Assets/`)
- **Fallback vault root** : Chercher les assets dans tout le vault si non trouvés dans le dossier
- **Styles de callout** : Chemins vers CSS custom (ex: `.obsidian/snippets/callouts.css`)
- **Niveau de log** : `debug`, `info`, `warn`, `error`
- **Flatten tree** : Ignore les sous-dossiers dans l'arborescence publiée (voir aide interne pour détails et avertissements)

## 🎨 Aide interne

Le plugin inclut une aide interactive accessible via :

- **Commande** : `Ouvrir l'aide et la documentation`
- **Settings** : Bouton "Help & Documentation"

L'aide interne documente :

- Contrôle de publication (`publish: false`, `draft: true`)
- Exclusion de sections (`^no-publishing`)
- Frontmatter
- Wikilinks et ancres
- Assets et images
- Dataview
- Leaflet
- **Markdown avancé** : wikilinks vers headings, footnotes, filtrage de tags

**⚠️ RÈGLE CRITIQUE** : Toute modification de logique ou syntaxe dans le plugin DOIT mettre à jour :

1. L'aide interne (`apps/obsidian-vps-publish/src/i18n/locales.ts` → sections `help`)
2. La documentation `docs/plugin/syntaxes.md`

## 🧪 Tests

### Build du plugin

```bash
npm run build:plugin
```

### Watch mode (dev)

```bash
npx nx run obsidian-vps-publish:dev
```

### Symlink vers un vault de test

```bash
ln -s $(pwd)/dist/vps-publish /path/to/vault/.obsidian/plugins/vps-publish
```

Recharger les plugins dans Obsidian (`Ctrl+R`).

## 🔗 Liens utiles

- [Architecture générale](../architecture.md)
- [Development workflow](../development.md)
- [API Backend](../api/)
- [Release process](../release.md)
- Code source : `apps/obsidian-vps-publish/src/`

---

**Dernière mise à jour** : Février 2026
