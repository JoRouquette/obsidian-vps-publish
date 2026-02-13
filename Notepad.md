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

-------------------------------------------------------------------------/

## Prompt overhaul asset handling

Tu es GitHub Copilot Chat dans ce monorepo Nx. Mission : overhauler proprement le système de gestion des assets en appliquant EXACTEMENT les recommandations ci-dessous (priorités haute → moyenne → basse) SANS hallucination ni supposition. Toute affirmation doit être prouvée par : chemin de fichier + extrait réel (idéalement avec numéros de lignes) + tests qui échouent puis passent. Si une info n’est pas dans le repo, tu le dis et tu proposes une commande de recherche (rg / nx graph / cat package.json), au lieu d’inventer.

Périmètre imposé (ne pas élargir sans preuve d’un bug existant) :

- Upload + validation (DTO/handler)
- Stockage local (file system storage)
- Staging + promotion (mutex, copie)
- Manifest (dédup/hash)
- Tests d’intégration end-to-end
- Documentation architecture (option reverse-proxy/CDN)
- Optionnel perf : thumbnails (si et seulement si tu trouves déjà un besoin clair dans le code/usages)

Backlog à implémenter (dans cet ordre strict) :

A) Priorité HAUTE — Sécurité

1. MIME spoofing

- Objectif : ne JAMAIS faire confiance au `mimeType` fourni par le client.
- Localise l’endpoint / handler qui reçoit les assets et le DTO : upload-assets.dto.ts, upload-assets.handler.ts (et tout ce qu’ils appellent).
- Ajoute une validation du “MIME réel” à partir des bytes.
  - Avant de choisir une lib, vérifie ce qui est déjà présent dans package.json (ou lockfile) : si `file-type` ou une lib de magic bytes existe, réutilise-la ; sinon ajoute la dépendance minimale et justifie-la.
  - Le MIME réel doit être déterminé depuis le buffer (pas l’extension, pas le header client).
  - Définis une politique claire : soit tu refuses si MIME réel != attendu, soit tu ignores le MIME client et tu remplaces par le MIME réel. Tu choisis en t’alignant sur la logique existante (prouve-la).
- Mets à jour le modèle interne (si besoin) pour stocker le MIME réel et l’extension calculée.

2. Fichiers malicieux (scan)

- Objectif : intégrer un scan AVANT `writeFile` dans assets-file-system.storage.ts.
- Contrainte : ne suppose pas que ClamAV est installé. Tu dois donc introduire une abstraction “scanner” injectée/configurable :
  - Interface ex: `IAssetScanner.scan(buffer, meta) -> ScanResult`.
  - Implémentation par défaut : “NoopScanner” (mais loggable en debug) si aucun scanner n’est configuré.
  - Implémentation “ClamAVScanner” : uniquement si tu peux prouver une stratégie réaliste depuis le repo (ex: usage de `clamdscan`/socket clamd, variables env déjà présentes, ou doc interne). Sinon, tu la laisses comme option documentée + code non activé par défaut.
- En cas de détection, refuser l’upload avec une erreur explicite et testée.

3. Limite par fichier

- Objectif : `maxAssetSizeBytes` configurable (ex 10MB) et validation AVANT stockage (donc avant decode/base64->buffer si ça coûte cher, et avant writeFile).
- Ajoute la config au système de config existant (ne crée pas un nouveau mécanisme).
- Vérifie où la taille est accessible : si l’upload est base64, calcule la taille réelle en bytes (pas la longueur de la string) et prouve le calcul dans un test.
- Refuser proprement avec code d’erreur cohérent avec l’existant.

B) Priorité MOYENNE — Robustesse 4) Re-upload systématique

- Objectif : calculer un hash SHA256 des assets, le stocker dans manifest, et SKIP l’upload si identique.
- Localise assets-uploader.adapter.ts et session-finalizer.service.ts + le format du manifest actuel (chemin + extrait).
- Implémente :
  - calcul SHA256 sur les bytes réellement stockés (pas sur le base64 brut).
  - stockage dans manifest (clé stable : au minimum chemin logique + hash + taille + MIME réel).
  - logique de dédup : si le manifest indique que l’asset (même chemin logique) a le même hash, ne pas re-téléverser / ne pas réécrire.
- Attention aux cas : renommage, collisions de nom, asset manquant sur disque : tu dois aligner le comportement sur l’existant et le prouver par tests (pas de logique inventée).

5. Race condition promotion

- Objectif : étendre le mutex dans staging-manager.ts pour couvrir aussi la copie/promotion, pas seulement le clear.
- Localise le mutex actuel et les sections protégées. Cite le code.
- Étends la section critique au minimum nécessaire pour garantir atomicité (clear + stage write + promote/copy), en restant compatible avec l’architecture (ne pas transformer toute l’app en lock global si ce n’est pas déjà le cas).

6. Tests d’intégration “réels”

- Objectif : un test d’intégration pour le flux complet upload → staging → promote → serve.
- Contrainte : réutiliser l’infra de tests existante (Jest/Vitest + supertest/playwright/whatever). Tu dois d’abord prouver ce qui est utilisé dans apps/node.
- Le test doit couvrir :
  - upload d’un asset valide (MIME réel détecté),
  - rejet d’un asset dont le MIME client ment (MIME spoofing),
  - rejet d’un asset “trop gros” (maxAssetSizeBytes),
  - comportement “skip” quand hash identique,
  - promotion sous mutex (au moins un test concurrentiel minimal : deux promotions simultanées ne doivent pas corrompre l’état),
  - asset servi/accessible après promote (prouve via endpoint ou lecture FS selon l’existant).
- Le test doit échouer AVANT tes changements et passer APRÈS. C’est non négociable.

C) Priorité BASSE — Performance / doc 7) CDN / cache

- Objectif : documenter une option Nginx reverse proxy cache / CDN externe dans architecture.md, en décrivant comment servir les assets statiques et où brancher le cache.
- Ne donne pas de recette “générique” : base-toi sur l’architecture réelle du repo (ports, chemins, endpoints) que tu prouves dans le code.

8. Thumbnails (si pertinent)

- N’implémente cette partie QUE si tu peux prouver un besoin clair : présence d’images lourdes, endpoints de preview, ou perf UI liée aux images (preuve par code/config).
- Si c’est pertinent, propose un “nouveau service” minimal, derrière un flag, qui génère des thumbnails au moment du promote ou à la demande. Tests minimaux.

9. Streaming vs base64 (refactor majeur)

- Ne le fais PAS dans ce patch. À la place, produis une note technique (dans un fichier doc du repo) avec :
  - pourquoi le base64 est limitant (preuve depuis le code actuel),
  - une proposition de migration (multipart/stream) adaptée au stack existant,
  - impacts sur DTO/handler/tests.
- Pas de promesse, pas d’implémentation ici.

Règles de travail

- Tu commences par cartographier le flux actuel (upload → storage → staging → promote → serve), avec chemins + extraits.
- Chaque item A/B/C : tu fournis un diff, puis tu fais tourner les tests cibles, puis tu ajoutes/ajustes les tests.
- Tu donnes les commandes Nx EXACTES en fin de réponse (tu les vérifies dans project.json/workspace.json : pas d’invention).
- Tu ne touches pas au comportement fonctionnel non lié aux assets.

Commence maintenant par :

1. ouvrir upload-assets.dto.ts, upload-assets.handler.ts, assets-file-system.storage.ts, assets-uploader.adapter.ts, session-finalizer.service.ts, staging-manager.ts, architecture.md (si existe) ;
2. me rendre une carte du flux actuel avec les points exacts où : mimeType client est lu, writeFile est appelé, manifest est construit/lu, mutex est utilisé.
   Ensuite seulement, tu proposes le premier patch (MIME réel + maxAssetSizeBytes) accompagné d’un test qui échoue puis passe.
