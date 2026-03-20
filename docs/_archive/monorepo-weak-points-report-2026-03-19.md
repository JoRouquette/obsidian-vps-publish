# Rapport d'audit du monorepo

Date: 2026-03-19

## Perimetre

Audit statique du monorepo `obsidian-vps-publish` base sur:

- la structure Nx et les scripts racine
- les configurations `project.json`, ESLint et Jest
- les principaux hotspots de code par taille
- les artefacts versionnes, TODOs et assouplissements de qualite visibles

Ce rapport n'inclut pas un run complet de `build`, `lint` et `test` sur tout le workspace. Il identifie les points faibles les plus probables a partir de la structure et du code present.

## Resume executif

Le monorepo est bien outille sur le papier: Nx, separation par couches, ESLint avec `@nx/enforce-module-boundaries`, documentation abondante. Les points faibles observes sont surtout operationnels et de maintenabilite:

1. des artefacts de build sont versionnes dans des repertoires source et de test
2. les scripts racine annulent largement les gains attendus d'un monorepo Nx et restent fragiles hors environnement bash
3. plusieurs modules critiques ont grossi jusqu'a devenir des points de concentration de dette
4. la dette de typage et les contournements lint se trouvent justement dans des zones centrales
5. les garde-fous qualite sont heterogenes selon les applications
6. certaines parties fonctionnelles exposees a l'utilisateur portent encore des TODOs explicites

## Constats detailles

### 1. Artefacts generes committes dans les sources

Gravite: elevee

Des fichiers generes sont versionnes au milieu des sources:

- `apps/node/src/infra/filesystem/dist/apps/node/package.json`
- `apps/node/src/infra/filesystem/dist/apps/node/package-lock.json`
- `libs/core-application/src/lib/_tests/publishing/dist/apps/node/package.json`
- `libs/core-application/src/lib/_tests/publishing/dist/apps/node/package-lock.json`

Faiblesses induites:

- bruit dans les revues et les diffs
- risque de desynchronisation entre sources et artefacts
- ambiguite sur ce qui releve d'un fixture de test vs d'un build reel
- augmentation de la taille du depot et des conflits inutiles

Recommendation:

- sortir ces fichiers du tree source
- remplacer par de vrais fixtures minimaux s'ils sont necessaires aux tests
- verifier que `.gitignore` et les scripts de packaging empechent leur retour

### 2. Scripts racine peu portables et sous-optimaux pour Nx

Gravite: elevee

Les scripts racine utilisent massivement `--skip-nx-cache`, `|| exit 1` et des appels bash:

- `package.json`: `build`, `test`, `lint`, `format`, `build:plugin`
- `package.json`: `ci`, `ci:full`, `ci:quick` appellent `bash scripts/ci-pipeline.sh`

Faiblesses induites:

- perte d'un benefice majeur du monorepo Nx: le cache
- temps de CI et de developpement inutilement allonges
- experience moins fiable sur Windows natif, alors meme que le plugin vise un ecosysteme desktop
- couplage a un shell specifique pour des commandes pourtant tres centrales

Recommendation:

- reserver `--skip-nx-cache` aux cas de debug et non aux scripts par defaut
- supprimer `|| exit 1` lorsqu'il n'apporte rien dans le shell d'execution
- remplacer le pipeline bash racine par un script Node ou des targets Nx composees

### 3. Hotspots de code trop volumineux

Gravite: moyenne a elevee

Plusieurs fichiers concentrent beaucoup de responsabilites:

- `apps/obsidian-vps-publish/src/i18n/locales.ts`: ~1500 lignes
- `apps/obsidian-vps-publish/src/main.ts`: ~1400 lignes
- `apps/node/src/infra/sessions/session-finalizer.service.ts`: ~900 lignes
- `apps/node/src/infra/markdown/markdown-it.renderer.ts`: ~800 lignes
- `apps/site/src/presentation/components/leaflet-map/leaflet-map.component.ts`: ~600 lignes

Faiblesses induites:

- faible localite des changements
- tests plus couteux a maintenir
- forte probabilite d'effets de bord lors des evolutions
- relecture plus difficile, surtout quand ces modules cumulent orchestration, transformation et details techniques

Recommendation:

- decouper par responsabilite metier ou technique
- isoler les parseurs, mappers, strategies et policies dans des modules dedies
- traiter en priorite `main.ts`, `markdown-it.renderer.ts` et `session-finalizer.service.ts`

### 4. Dette de typage et contournements des regles dans des modules critiques

Gravite: moyenne

Des contournements apparaissent dans des zones centrales:

- `apps/obsidian-vps-publish/src/main.ts`: `@ts-ignore` et plusieurs `no-explicit-any`
- `apps/site/src/presentation/components/leaflet-map/leaflet-map.component.ts`: nombreuses desactivations `no-explicit-any`
- plusieurs controllers Express commencent par `/* eslint-disable @typescript-eslint/no-misused-promises */`

Faiblesses induites:

- perte de confiance dans le typage exactement la ou les integrations externes sont les plus sensibles
- zones plus difficiles a refactorer en securite
- precedent culturel: la dette n'est plus localisee ni bornee

Recommendation:

- convertir les contournements en backlog explicite et borne
- introduire des types adaptes pour les APIs Obsidian, Leaflet et Express
- interdire les nouveaux `@ts-ignore` hors justification documentee

### 5. Garde-fous qualite heterogenes selon les projets

Gravite: moyenne

Les seuils de couverture ne sont imposes que pour l'application Node:

- `apps/node/jest.config.cjs` definit `coverageThreshold`
- `apps/site/jest.config.ts`, `apps/obsidian-vps-publish/jest.config.cjs`, `libs/core-application/jest.config.cjs` et `libs/core-domain/jest.config.cjs` n'en definissent pas

Autres signaux:

- `apps/obsidian-vps-publish/project.json` force `runInBand` sur les tests plugin
- la politique qualite n'est donc pas uniforme sur les briques du monorepo

Faiblesses induites:

- risque de regression silencieuse sur les libs partagees et le plugin
- incitation a concentrer la qualite sur l'API seulement
- baisse de predictibilite des temps de test et des attentes de couverture

Recommendation:

- definir des seuils minimaux de couverture par projet
- documenter les exceptions temporaires
- reevaluer `runInBand` et n'y recourir que pour des suites identifiees comme non parallellisables

### 6. TODOs ouverts dans des zones de configuration utilisateur

Gravite: moyenne

Des TODOs concernent des ecrans ou comportements directement visibles:

- `apps/obsidian-vps-publish/src/lib/settings/sections/routes-section.ts`: gestion UI de `ignoredCleanupRuleIds`
- `apps/obsidian-vps-publish/src/lib/settings/sections/folders-section.ts`: plusieurs TODOs de refactor vers `routeTree` et d'amelioration UX

Faiblesses induites:

- dette fonctionnelle exposee dans une zone sensible: la configuration
- risque d'empiler des correctifs locaux sur une base deja annoncée comme transitoire
- augmentation du cout de changement pour les futures evolutions de regles et de routage

Recommendation:

- transformer ces TODOs en tickets relies a une feuille de route claire
- stabiliser le modele cible (`routeTree`) avant d'ajouter davantage de logique UI

## Priorisation conseillee

### Priorite 1

- nettoyer les artefacts versionnes dans `dist/` embarques dans les sources
- remettre les scripts racine sur un usage normal de Nx sans `--skip-nx-cache` par defaut

### Priorite 2

- refactorer les gros modules centraux
- reduire les `@ts-ignore`, `any` et disables lint dans les integrations critiques

### Priorite 3

- harmoniser les seuils de couverture et la politique de tests
- fermer ou planifier explicitement les TODOs de configuration

## Conclusion

Le monorepo n'est pas faible sur sa vision d'ensemble. Il est faible sur sa discipline d'execution. L'architecture cible est lisible, mais plusieurs choix locaux sapent les benefices attendus d'un workspace Nx propre: artefacts generes dans les sources, scripts racine anti-cache, hotspots surdimensionnes et garde-fous qualite non homogenes.

Le meilleur retour sur investissement viendra d'abord d'un assainissement du depot et de la chaine build/test, avant meme un gros refactor metier.
