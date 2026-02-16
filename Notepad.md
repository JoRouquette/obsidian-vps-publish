# ToDo list

- Gestion des liens de header interne à la page courante dans le site HS.

## Corriger les erreurs console angular

1. NG0751: Angular has detected that this application contains `@defer` blocks and the hot module replacement (HMR) mode is enabled. All `@defer` block dependencies will be loaded eagerly. Find more at https://v20.angular.dev/errors/NG0751
2. tree.mjs:481 Tree is using conflicting node types which can cause unexpected behavior. Please use tree nodes of the same type (e.g. only flat or only nested). Current node type: "nested", new node type "flat".

## Prompt de refactorisation

Tu es un agent de refactorisation. Objectif : améliorer la qualité du code (bonnes pratiques + règles SonarQube) SANS modifier le comportement fonctionnel. Toute modification doit être sûre, minimale, vérifiable, et traçable.

CONTRAINTES NON NÉGOCIABLES

- Zéro changement fonctionnel : mêmes entrées/sorties, mêmes effets de bord, mêmes exceptions observables, même ordre d’exécution significatif.
- Ne modifie pas les signatures publiques ni les contrats API (public/protected exposés) sauf si tu prouves que c’est strictement interne et sans impact.
- Ne change pas la logique métier, les règles, les seuils, les valeurs, ni les comportements de bord (logs, timing, IO) sauf si c’est explicitement une correction de bug prouvée (sinon : interdit).
- Pas de “refacto esthétique” isolée : chaque changement doit améliorer une règle Sonar, un smell clair, une dette réelle, ou supprimer du mort.
- Respecte KISS / SOLID / SRP au maximum, mais sans sur-architecture ni patterns inutiles.

PÉRIMÈTRE DES ACTIONS (priorité décroissante)

1. Supprimer le code mort : méthodes/fonctions/classes/variables inutilisées, using/imports inutiles, paramètres non utilisés (si interne), duplications évidentes.
2. Réduire les commentaires inutiles : supprimer les commentaires redondants (expliquent ce que le code dit déjà). Conserver/ajouter uniquement ceux qui expliquent le “pourquoi” (intention, invariants, contraintes métier) ou les pièges.
3. Corriger smells Sonar fréquents : complexité cyclomatique élevée, méthodes trop longues, duplication, null-checks incohérents, exceptions trop génériques, ressources non disposées, async mal géré, LINQ/allocations inutiles (si C#), etc.
4. Renforcer la lisibilité : nommage, extraction de petites fonctions, early returns, guard clauses, simplification d’expressions, réduction du nesting.
5. SRP : découper uniquement quand ça diminue vraiment la complexité et améliore la testabilité, sans multiplier les abstractions.

MODE OPÉRATOIRE (OBLIGATOIRE)
A. Analyse initiale du repository

- Identifie la/les techno(s) (ex: C#/.NET, Angular/TS, etc.), l’architecture, les conventions de code, la configuration Sonar (si présente), et les points chauds (fichiers complexes, zones à forte dette).
- Propose un plan d’attaque court : ordre de traitement, types de changements attendus, risques (tests manquants, zones sensibles).

B. Passe de refactorisation complète fichier par fichier

- Traite les fichiers un par un, en commençant par les plus simples/isolés, puis les points chauds.
- Pour chaque fichier :
  1. Résume brièvement ce que fait le fichier et ses dépendances.
  2. Liste les problèmes concrets détectés (dead code, smells Sonar, complexité, commentaires inutiles).
  3. Applique des changements minimalistes, localisés et sûrs.
  4. Explique en 2–5 lignes ce qui a changé et pourquoi (règle Sonar / principe).
  5. Vérifie que rien n’est cassé (compilation/typecheck). Si possible : lance les tests. Sinon : indique précisément quels tests seraient pertinents.

C. Discipline de changement

- Fais des commits atomiques logiques (ou au minimum des unités de changement séparées) : “Remove dead code”, “Reduce complexity”, “Simplify null-handling”, etc.
- Ne mélange pas reformatage global + refacto : garde le diff lisible.

CRITÈRES D’ACCEPTATION

- Le projet build/typecheck.
- Les tests existants passent.
- La dette Sonar et les code smells diminuent (ou au moins pas de régression).
- Les changements sont strictement refactoring (pas d’ajout de feature).

COMMENCE MAINTENANT

1. Fais l’analyse du repo et donne le plan.
2. Ensuite, commence la passe fichier par fichier.

-------------------------------------------------------------------------/

## Prompt PWA

Tu es GitHub Copilot Chat dans VS Code, avec accès au code du monorepo Nx. Objectif unique : rendre `apps/site` (Angular) une PWA “propre” (service worker + manifest + caching adapté + vérifs serveur/Docker), sans inventer de faits. Règle absolue : tu n’affirmes rien que tu n’as pas vérifié dans le repo. À chaque fois que tu proposes une action, tu cites les fichiers exacts et tu montres les diffs.

Cadre et anti-hallucination (non négociable)

1. Avant toute modification, tu fais un audit factuel en lisant les fichiers, puis tu résumes uniquement ce que tu as constaté (versions, structure, chemins, routes). Si une info manque, tu me demandes de coller l’extrait exact plutôt que de deviner.
2. Tu ne touches PAS aux libs `core-domain` / `core-application` / au plugin. Les changements doivent rester dans `apps/site` + éventuellement `apps/node` (uniquement si nécessaire pour headers/static hosting) + `docs/site/**` si comportement/config user-facing.
3. Tu avances étape par étape. À la fin de chaque étape : (a) tu donnes les changements (diffs), (b) tu donnes les commandes à exécuter, (c) tu définis des critères de validation observables. Tu t’arrêtes après ça.

Étape 0 — Audit (obligatoire, pas de code)

- Ouvre et lis : `package.json` (versions Angular/Nx), `apps/site/project.json` (targets/build options), et tout fichier de config Angular existant (`angular.json`, `workspace.json`, `nx.json`, `apps/site/src/main.ts`, `app.module.ts` ou `app.config.ts`).
- Détermine FACTUELLEMENT :
  a) version Angular (majeure) et si l’app est “NgModule” ou “standalone bootstrap”
  b) outputPath réel de `site` (où sort le build)
  c) baseHref / deployUrl éventuels
  d) comment le backend sert l’UI : repère dans `apps/node` le montage static (chemin URL et dossier FS), et s’il y a un fallback SPA.
- Résume ces faits en citant les fichiers. Ne propose encore aucune solution.

Étape 1 — Ajouter le support PWA de manière idiomatique pour CET Angular/Nx

- Choisis la commande correcte en fonction de l’audit (tu ne la “supposes” pas) :
  - soit `ng add @angular/pwa --project=site`
  - soit un generator Nx/schematic équivalent si c’est la méthode attendue dans ce repo.
- Explique pourquoi tu choisis cette commande (référence à versions/structure observées).
- Applique le minimum : enregistrement du service worker (module ou provider selon architecture), ajout du manifest, icônes, liens/meta dans `index.html`, création/maj `ngsw-config.json`.
- Montre les diffs complets des fichiers modifiés/créés.

Validation Étape 1

- Donne les commandes : build prod de `site` via Nx, puis liste des fichiers générés (tu me dis quoi vérifier : présence de `ngsw-worker.js`, `ngsw.json`, `manifest.webmanifest`, icônes).
- Critères : l’app démarre en prod, et le service worker apparaît en “activated” dans DevTools (Application > Service Workers), sans erreurs console.

Étape 2 — Caching “propre” (pas le config par défaut aveugle)

- Avant de toucher `ngsw-config.json`, tu identifies les routes réellement appelées par le front :
  - cherche dans `apps/site` les usages de `HttpClient`, les `environment*.ts`, tout `API_BASE_URL`, et les patterns d’URL.
  - tu listes uniquement les endpoints GET pertinents pour la consultation (ex: pages, manifest/catalog, recherche) et tu exclus explicitement les endpoints mutationnels (POST upload/session, etc.) s’ils existent.
- Ensuite tu ajustes `ngsw-config.json` :
  - `assetGroups` pour app shell + assets statiques
  - `dataGroups` UNIQUEMENT pour les GET consultatifs identifiés, avec stratégie cohérente (stale-while-revalidate ou freshness) justifiée par le produit (site de contenu).
  - `navigationUrls` : tu t’assures que les navigations SPA sont bien captées, tout en excluant `/api/**` et les assets binaires.
- Tu montres le diff, et tu justifies chaque règle par un besoin concret observé (offline shell, perf, stabilité), pas par théorie.

Validation Étape 2

- Scénario test : première visite online → naviguer 2–3 pages → passer offline → recharger → l’app shell + pages déjà visitées restent accessibles (ou comportement attendu explicitement décrit).
- Aucune requête non-GET critique ne doit être “cachée”.

Étape 3 — Backend: servir une PWA correctement (headers & fallback), seulement si nécessaire

- Tu vérifies d’abord les headers réellement envoyés en prod pour :
  `index.html`, `ngsw-worker.js`, `ngsw.json`, `manifest.webmanifest`.
- Si et seulement si c’est problématique, tu ajustes `apps/node` :
  - pas de cache agressif sur `index.html`, `ngsw*.json/js`, `manifest.webmanifest` (sinon updates PWA cassées)
  - cache long possible pour assets fingerprintés (si le build en génère)
  - content-type correct du manifest (à corriger uniquement si faux observé)
- Tu montres les diffs et tu expliques l’impact.

Validation Étape 3

- Commandes/curl à exécuter + ce qu’on doit voir dans `Cache-Control` et `Content-Type`.
- Vérifier que les updates du SW se propagent (DevTools > Update on reload / ou reload après nouvelle build).

Étape 4 — Docker/runtime: ne pas “oublier” les artefacts PWA

- Tu inspectes le Dockerfile (runtime stage) et tu prouves que les fichiers PWA sont bien copiés dans `UI_ROOT` (ou tu corriges).
- Tu évites toute copie “pattern” qui exclut `*.json` ou `*.webmanifest`.
- Diffs + justification.

Validation Étape 4

- Build docker + run local : vérifier que `/<path>/ngsw-worker.js` et `/<path>/manifest.webmanifest` répondent 200, et que le SW s’enregistre.

Étape 5 — UX update (optionnel mais “propre”)

- Si le repo a déjà un système de notifications (snackbar/toast), tu l’utilises. Sinon tu proposes une implémentation minimale : détecter `SwUpdate` (ou équivalent selon version) et proposer un “reload” quand une nouvelle version est prête.
- Aucun design “inventé” : tu t’alignes sur les composants déjà présents.

Étape 6 — Documentation (conforme à la charte)

- Avant toute doc : lis `docs/README.md` et applique les règles.
- Tu mets à jour la doc “final state” uniquement : où activer PWA, ce qui est caché, comment tester, troubleshooting (SW cache, hard reload).
- Pas de fichiers interdits, pas de journal de migration.
- Tu ajoutes la référence dans l’index approprié (`docs/site/README.md` ou équivalent).
- Tu donnes la commande `npm run docs:check` à exécuter.

Livrable attendu à chaque étape

- Un bloc “Faits observés” (avec chemins de fichiers)
- Un bloc “Changements” (diffs)
- Un bloc “Commandes à exécuter”
- Un bloc “Critères de validation”

Puis tu t’arrêtes.

-------------------------------------------------------------------------/
