# ToDo list

- Site web PWA

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

---

# Rapport d'Audit Technique : Gestion des Assets

### Priorité Haute (Sécurité)

| #   | Risque                 | Recommandation                                                                                     | Fichier concerné                               |
| --- | ---------------------- | -------------------------------------------------------------------------------------------------- | ---------------------------------------------- |
| 1   | **MIME spoofing**      | Valider le MIME type réel via `file-type` ou `magic-bytes` au lieu d'accepter `mimeType` du client | upload-assets.dto.ts, upload-assets.handler.ts |
| 2   | **Fichiers malicieux** | Intégrer ClamAV ou scanner externe avant `writeFile`                                               | assets-file-system.storage.ts                  |
| 3   | **Limite par fichier** | Ajouter `maxAssetSizeBytes` configurable (ex: 10MB) et valider avant stockage                      | upload-assets.handler.ts                       |

### Priorité Moyenne (Robustesse)

| #   | Risque                       | Recommandation                                                                     | Fichier concerné                                         |
| --- | ---------------------------- | ---------------------------------------------------------------------------------- | -------------------------------------------------------- |
| 4   | **Re-upload systématique**   | Calculer hash SHA256 des assets, stocker dans manifest, skip si identique          | assets-uploader.adapter.ts, session-finalizer.service.ts |
| 5   | **Race condition promotion** | Étendre le mutex pour couvrir aussi la copie, pas seulement le clear               | staging-manager.ts                                       |
| 6   | **Tests superficiels**       | Écrire tests d'intégration pour le flux complet upload → staging → promote → serve | Nouveau fichier test                                     |

### Priorité Basse (Performance)

| #   | Risque                  | Recommandation                                                           | Fichier concerné   |
| --- | ----------------------- | ------------------------------------------------------------------------ | ------------------ |
| 7   | **Pas de CDN**          | Documenter l'option Nginx reverse proxy avec cache ou CDN externe        | architecture.md    |
| 8   | **Pas de resize**       | Si pertinent, ajouter génération de thumbnails pour images lourdes       | Nouveau service    |
| 9   | **Streaming vs base64** | Pour fichiers très gros, envisager streaming multipart au lieu de base64 | Refactoring majeur |

Audit terminé. Le rapport ci-dessus synthétise l'analyse complète de la gestion des assets dans ce repository, avec chaque affirmation soutenue par des références précises au code source.

-------------------------------------------------------------------------/

## Prompt performance pluggin

Tu es GitHub Copilot Chat. Objectif : VÉRIFIER (sans supposition) si, dans le plugin Obsidian de ce repo, le traitement de publication “se met en pause” quand l’utilisateur ne reste pas focus sur la page (fenêtre inactive / onglet en arrière-plan), et préparer une correction pour rendre le traitement le plus asynchrone possible sans bloquer l’UI Obsidian.

Contraintes non négociables :

- Zéro hallucination : tu n’affirmes rien sans preuve issue du code + d’une reproduction instrumentée.
- Tu ne proposes pas de refactor global. Tu instrumentes, tu mesures, tu conclus, puis tu proposes le minimum viable.
- Tu ne “rends asynchrone” que ce qui est actuellement synchrone/bloquant, et tu le prouves.

Phase 1 — Localiser et instrumenter (preuve)

1. Localise dans le repo le code du plugin Obsidian qui déclenche la publication (commande, bouton, event). Donne chemins exacts + extraits.
2. Identifie la “pipeline” de publication : scan du vault, lecture fichiers, rendu markdown, génération manifest, upload/HTTP, etc. Pour chaque étape, indique si elle est sync ou async avec preuve (extrait).
3. Ajoute une instrumentation STRICTEMENT TEMPORAIRE derrière un flag (ex: settings.debugPublishTiming = true) :
   - log de début/fin pour chaque étape (avec performance.now()).
   - un “heartbeat” toutes les 250ms pendant la publication : log l’intervalle réel entre ticks et le timestamp. (Si l’intervalle dérive fortement ou s’arrête, on le verra.)
   - écouteurs window/document pour : visibilitychange, blur/focus, pagehide, freeze/resume (si dispo), et log ces événements avec timestamp.
   - si le code utilise requestAnimationFrame, setTimeout, setInterval, ou awaits en boucle, log aussi le type de scheduling utilisé.
4. Ajoute un mode “repro deterministe” : une commande “Publish (debug)” qui lance la publication + instrumentation sans dépendre d’interactions UI.

Phase 2 — Reproduction contrôlée (preuve) 5) Écris un scénario de reproduction dans un test manuel guidé (pas d’hypothèse) :

- lancer “Publish (debug)”
- pendant la publication, alt-tab (perdre le focus), minimiser, changer d’onglet, puis revenir
- récupérer les logs : vérifier s’il y a un trou dans le heartbeat, et quelle étape était en cours

6. Si le repo a déjà une infra de test (unit/e2e) pour le plugin, ajoute un test minimal qui valide au moins que la pipeline n’est pas 100% sync (ex: le heartbeat tick pendant une étape lourde). Si aucun test plugin n’existe, constate-le explicitement (preuve par structure repo), et garde la preuve via logs.

Phase 3 — Analyse causale (pas de théorie) 7) Si pause observée :

- prouve si c’est causé par “background throttling” (timers/RAF) vs “blocage event loop” (CPU sync) vs “await qui attend un event UI”.
- Pour trancher “blocage event loop”, utilise une mesure : pendant une étape suspecte, fais un micro-benchmark de boucle CPU (ou mesure de long tasks via PerformanceObserver si possible dans Obsidian/Electron) et log les durées.
- Montre la ligne de code précise qui crée le comportement (ex: boucle sync, appel à une lib sync, utilisation de raf, etc.)

Phase 4 — Rendre la publication non bloquante (patch minimal, si et seulement si la preuve le justifie) 8) Objectif : ne pas bloquer l’UI Obsidian pendant publication.

- Identifie les sections CPU-heavy (par ex. parsing/rendu en masse, compression, hashing, etc.). Prouve-les (timing).
- Pour celles-ci, implémente un “yield” coopératif entre lots (chunking) : traiter N fichiers, puis await une fonction yield() qui rend la main (ex: await new Promise(r => setTimeout(r, 0)) ou meilleure primitive existante dans le code). Pas de setTimeout arbitraire long.
- Ne change pas la logique métier, uniquement la planification.

9. Objectif : “asynchrone possible” : si certaines tâches peuvent être externalisées :
   - Propose (uniquement si nécessaire et réaliste dans ce repo) un Worker (WebWorker) ou un processus Node séparé, mais seulement après avoir prouvé que le blocage vient du CPU et que chunking est insuffisant.
   - Si Electron/Obsidian limite les workers, prouve-le ou cite la doc/contrainte (sinon ne le dis pas).
10. Ajoute un indicateur de progression UI non bloquant (si l’UI existe déjà) et assure-toi qu’il reste réactif pendant les grosses étapes. Prouve-le via heartbeat et/ou logs.

Livrable attendu :

- Un rapport factuel : “quand on perd le focus, voilà ce qui se passe” avec logs horodatés.
- Un patch minimal (diff) qui : (a) ajoute instrumentation (flag), (b) ajoute yield/chunking sur l’étape prouvée bloquante, (c) garde le comportement fonctionnel.
- Les commandes exactes pour build/test le plugin dans ce repo (Nx targets), VÉRIFIÉES dans project.json.

Commence maintenant par : retrouver le point d’entrée de la commande de publication du plugin et montrer le pipeline exact (chemins + extraits), puis implémente l’instrumentation heartbeat + visibilitychange derrière un flag.
