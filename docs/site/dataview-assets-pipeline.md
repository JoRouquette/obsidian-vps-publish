# Dataview / DataviewJS: assets et icônes

## Invariant de pipeline

- `dataview` produit du Markdown canonique quand c'est possible (`[[...]]`, `![[...]]`, tableaux, listes).
- `dataviewjs` conserve le HTML capturé depuis le DOM pour ne pas perdre la mise en forme riche.
- La **détection des assets exportables** se fait côté plugin, dans la phase de parsing partagée, avant l'upload.
- La **réécriture des URLs HTML** se fait côté backend, après rendu Markdown-It, quand les assets connus peuvent être convertis en `/assets/...`.

## Responsabilités

### Plugin

Fichiers clés:

- `apps/obsidian-vps-publish/src/lib/dataview/process-dataview-blocks.service.ts`
- `libs/core-application/src/lib/vault-parsing/handler/parse-content.handler.ts`
- `libs/core-application/src/lib/vault-parsing/services/detect-assets.service.ts`

Responsabilités:

- exécuter Dataview / DataviewJS
- sérialiser le résultat dans `note.content`
- détecter les assets locaux exportables avant upload
- alimenter `note.assets` sans ouvrir une seconde pipeline de rendu

Support plugin:

- `![[asset.ext]]`
- `![alt](asset.png)`
- `<img src="asset.png">`
- `<img data-src="asset.png">`
- `<a href="asset.pdf">`

Non pris en charge côté détection:

- `srcset`, CSS `url(...)`, `<use href>`, `<image href>`
- icônes dépendantes uniquement d'une feuille CSS ou d'un runtime externe

### Backend

Fichiers clés:

- `apps/node/src/infra/markdown/markdown-it.renderer.ts`
- `apps/node/src/infra/sessions/validate-links.service.ts`

Responsabilités:

- transformer uniquement les embeds Obsidian en rendu `<figure>` / `/assets/...`
- laisser le HTML DataviewJS intact
- canonicaliser les références HTML connues vers `/assets/...`
- ne jamais requalifier `/assets/...` comme lien interne vers une page

## Icônes et SVG

- SVG inline: conservé tel quel, sans upload d'asset.
- Emoji et nœuds DOM simples (`span`, `i`, `data-icon`): conservés tels quels.
- Icônes CSS/runtime non embarquées: pas de faux support; elles peuvent rester dans le HTML mais sans garantie de rendu si le runtime n'existe pas côté site.

## Limites connues

- La détection Markdown image reste volontairement minimale et vise surtout `![alt](path)` ou `![alt](<path>)`.
- La détection HTML ne couvre pas toutes les syntaxes média avancées.
- Le backend ne découvre pas de nouveaux assets: il ne réécrit que des références déjà détectées côté plugin.
