# ToDo list

- Ajout de l'inclusion des wikilinks vers header comme `[[Sens et capacités#Vision thermique|vision thermique]]`. Utiliser les frangments d'url Angular.
- Amélioration de l'ergonomie : vault explorer clear filter
- Site web PWA

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

## Résumé Exécutif (8-12 lignes)

Ce projet (obsidian-vps-publish) permet de publier du contenu depuis un vault Obsidian vers un VPS auto-hébergé. La **gestion des assets** désigne le flux de fichiers binaires (images, PDF, audio, vidéo) depuis le vault Obsidian jusqu'au serving HTTP.

**Architecture** : Clean Architecture (monorepo Nx) avec 3 apps (plugin Obsidian, backend Node/Express, frontend Angular) et 2 libs partagées. Les assets suivent un cycle **détection → résolution → upload chunké → staging → promotion → serving**.

**Stockage** : filesystem local (`ASSETS_ROOT`), pas de cloud storage. Serving via `express.static` avec cache agressif (immutable, 365d).

**Risques majeurs identifiés** :

1. **Aucune validation MIME type réelle** (upload-assets.dto.ts) - le `mimeType` est accepté tel quel
2. **Pas de scan antivirus/malware** - aucune référence trouvée
3. **Pas de déduplication/checksum** - re-upload systématique
4. **Pas de limite de taille par fichier individuel** - seulement limite globale 50MB (app.ts)

## Glossaire Asset (spécifique au repo)

### Définition opérationnelle

Un **Asset** est un fichier binaire référencé dans une note Obsidian, détecté via la syntaxe `![[filename]]` ou via les propriétés frontmatter.

**Référence** : asset.ts

```typescript
export type Asset = {
  relativePath: string; // Chemin relatif pour stockage backend
  vaultPath: string; // Chemin dans le vault Obsidian
  fileName: string; // Nom de fichier seul
  mimeType: string; // Type MIME déclaré (non validé)
  contentBase64: string; // Contenu encodé base64
};
```

### Champs/attributs clés

| Entité                | Fichier                  | Rôle                                                      |
| --------------------- | ------------------------ | --------------------------------------------------------- |
| `Asset`               | asset.ts                 | Structure d'upload API                                    |
| `AssetRef`            | asset-ref.ts             | Référence détectée dans une note                          |
| `AssetKind`           | asset-kind.ts            | Type: `'image' \| 'audio' \| 'video' \| 'pdf' \| 'other'` |
| `ResolvedAssetFile`   | resolved-asset-file.ts   | Fichier résolu avec contenu binaire                       |
| `AssetDisplayOptions` | asset-display-options.ts | Options d'affichage (alignment, width, classes CSS)       |

### Invariants

1. Un asset doit avoir un `contentBase64` non vide pour être uploadé (assets-uploader.adapter.test.ts)
2. Le `relativePath` ne peut pas contenir `..` (protection path traversal) (path-utils.test.ts)
3. Les assets sont uploadés **après** les notes, dans la même session

## Architecture & Flux

### Flux principal : Upload d'assets

```
Plugin Obsidian                         Backend Node/Express
================                        ====================

1. DETECTION (au parsing des notes)
   DetectAssetsService.process()
   → parse ![[...]] dans content
   → parse frontmatter strings
   → retourne AssetRef[]
         │
         ▼
2. RESOLUTION (avant upload)
   ObsidianAssetsVaultAdapter
   .resolveAssetsFromNotes()
   → cherche fichier dans assetsFolder
   → fallback: tout le vault
   → lit contenu binaire
   → retourne ResolvedAssetFile[]
         │
         ▼
3. PREPARATION UPLOAD
   AssetsUploaderAdapter
   → encode base64
   → batch par octets (maxBytesPerRequest)
   → compression gzip (ChunkedUploadService)
   → découpe en chunks 5MB
         │
         ▼
4. UPLOAD HTTP ────────────────────────► ChunkedUploadMiddleware
   POST /api/session/{id}/assets/upload   → assemble chunks
                                          → décompresse
                                               │
                                               ▼
                                         5. VALIDATION
                                            ApiAssetsBodyDto.safeParse()
                                            (Zod: strings non vides)
                                               │
                                               ▼
                                         6. HANDLER
                                            UploadAssetsHandler.handle()
                                            → decode base64
                                            → CONCURRENCY=10
                                               │
                                               ▼
                                         7. STORAGE (staging)
                                            AssetsFileSystemStorage.save()
                                            → mkdir récursif
                                            → writeFile
                                            → path:
                                              /assets/.staging/{sessionId}/{relativePath}
                                               │
                                               ▼
8. FINISH SESSION ─────────────────────► StagingManager.promoteSession()
   POST /api/session/{id}/finish          → clear /assets (hors .staging)
                                          → copy staging → production
                                          → cleanup staging
```

### Flux : Serving des assets

```
Client HTTP                           Backend
===========                           =======

GET /assets/images/photo.jpg ──────► express.static(ASSETS_ROOT)
                                      │
                                      ├── Cache-Control: max-age=365d, immutable
                                      ├── ETag: true
                                      └── sendFile()
```

**Référence** : app.ts

## Points de Preuve

### 1. Détection des assets dans les notes

| Affirmation                  | Référence                                                             |
| ---------------------------- | --------------------------------------------------------------------- |
| Regex de détection           | detect-assets.service.ts: `const EMBED_REGEX = /!\[\[([^\]]+)\]\]/g;` |
| Classification par extension | detect-assets.service.ts                                              |
| Détection dans frontmatter   | detect-assets.service.ts                                              |

### 2. Résolution dans le vault Obsidian

| Affirmation                         | Référence                                                           |
| ----------------------------------- | ------------------------------------------------------------------- |
| Recherche dans assetsFolder d'abord | obsidian-assets-vault.adapter.ts                                    |
| Fallback vault complet configurable | obsidian-assets-vault.adapter.ts                                    |
| Lecture binaire via Obsidian API    | obsidian-assets-vault.adapter.ts: `this.app.vault.readBinary(file)` |

### 3. Upload vers backend

| Affirmation                   | Référence                                                                     |
| ----------------------------- | ----------------------------------------------------------------------------- |
| Encodage base64               | assets-uploader.adapter.ts                                                    |
| Batch par octets              | batch-by-bytes.util.ts                                                        |
| Compression gzip              | chunked-upload.service.ts                                                     |
| Upload concurrent (3 batches) | assets-uploader.adapter.ts: `this.concurrencyLimit = concurrencyLimit \|\| 3` |

### 4. Validation backend

| Affirmation                                   | Référence                                           |
| --------------------------------------------- | --------------------------------------------------- |
| Validation Zod (strings non vides uniquement) | upload-assets.dto.ts                                |
| Pas de validation MIME réelle                 | DTO accepte n'importe quelle string pour `mimeType` |
| Pas de limite de taille par fichier           | Non présent dans le DTO ni handler                  |

### 5. Stockage filesystem

| Affirmation                | Référence                     |
| -------------------------- | ----------------------------- |
| Stockage en staging        | staging-manager.ts            |
| Protection path traversal  | path-utils.util.ts            |
| mkdir récursif + writeFile | assets-file-system.storage.ts |

### 6. Promotion et serving

| Affirmation                        | Référence          |
| ---------------------------------- | ------------------ |
| Clear production puis copy staging | staging-manager.ts |
| Mutex sur clear seulement          | staging-manager.ts |
| express.static avec cache 365d     | app.ts             |

### 7. Authentification

| Affirmation                 | Référence                                 |
| --------------------------- | ----------------------------------------- |
| API key requise sur /api/\* | app.ts: `apiRouter.use(apiKeyMiddleware)` |
| Assets publics (pas d'auth) | app.ts: pas de middleware auth            |

## Non Déterminable Depuis le Code Actuel

| Élément                           | Ce qui manque                                                                      | Pistes                                                              |
| --------------------------------- | ---------------------------------------------------------------------------------- | ------------------------------------------------------------------- |
| **Scan antivirus/malware**        | Aucune référence à ClamAV, VirusTotal, ou autre. Pas de quarantaine.               | Chercher: `clam`, `virus`, `scan`, `quarantine` - aucun résultat    |
| **Déduplication (hash/checksum)** | Aucun calcul de hash des fichiers. Re-upload systématique.                         | Chercher: `checksum`, `hash`, `dedup` - seulement dans node_modules |
| **Limite de taille par fichier**  | Seulement limite globale `MAX_REQUEST_SIZE=50mb`. Pas de max par asset.            | Absent du DTO et du handler                                         |
| **Validation MIME réelle**        | Le `mimeType` dans le DTO est `z.string().min(1)`, jamais validé contre le contenu | Pas de lib de détection MIME (`file-type`, `magic-bytes`)           |
| **Retention policy**              | `purgeAll()` existe mais pas de purge automatique/retention                        | Absent du cron/scheduler                                            |
| **Backup des assets**             | Aucune référence à backup/snapshot                                                 | Probablement géré en dehors du code (infra)                         |
| **CDN**                           | Aucune référence à CloudFront, Cloudflare, etc.                                    | Serving direct via Node.js                                          |
| **Signed URLs (présignés)**       | Aucune référence à `presign`, `signed`                                             | Les assets sont publics                                             |
| **Resize/thumbnail**              | Aucune transformation d'image                                                      | Pas de sharp, jimp, ou équivalent                                   |
| **Quota utilisateur**             | Pas de limite par session/utilisateur                                              | Absent de la logique                                                |

## Qualité et Tests

### Tests existants autour des assets

| Fichier                            | Lignes | Couverture                                  |
| ---------------------------------- | ------ | ------------------------------------------- |
| detect-assets.service.test.ts      | ~55    | Détection content + frontmatter             |
| assets-file-system-storage.test.ts | ~45    | Save multiple, path traversal, write errors |
| assets-uploader.adapter.test.ts    | ~75    | Empty array, batch upload, missing content  |
| upload-assets.handler.test.ts      | ~85    | Handler basique (sessionId, published=0)    |
| path-utils.test.ts                 | ~17    | Path traversal protection                   |

### Scénarios non testés

1. **Upload fichier malicieux** (polyglot, MIME spoofing)
2. **Très gros fichier individuel** (>50MB après chunking)
3. **Concurrence élevée** (100+ assets simultanés)
4. **Collision de fichiers** (même `relativePath` dans 2 sessions)
5. **Erreur réseau pendant chunk** (retry behavior)
6. **Disk full pendant staging**
7. **Race condition promotion** (mutex seulement sur clear)

### Dette technique identifiée

1. **Tests du handler superficiels** : upload-assets.handler.test.ts teste un handler quasi-vide (published=0)
2. **Pas de test d'intégration E2E** pour le flux complet asset
3. **ChunkedUploadMiddleware** non testé unitairement (seulement docs)

## Recommandations

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

Voici les commandes Docker nécessaires pour résoudre le problème de déploiement CSS :

## 1. Nettoyage complet et rebuild

```bash
# Arrêter et supprimer TOUT (containers, volumes, images)
docker compose -f docker-compose.yml -f docker-compose.dev.yml down -v
docker image rm obsidian-vps-publish:dev 2>/dev/null || true
docker system prune -f

# Rebuild SANS cache (force la recopie des sources)
docker compose -f docker-compose.yml -f docker-compose.dev.yml build --no-cache --pull

# Démarrer le container
docker compose -f docker-compose.yml -f docker-compose.dev.yml up -d
```

## 2. Vérification du déploiement CSS

```bash
# 1. Vérifier que le container tourne
docker ps --filter "name=obsidian-vps-publish"

# 2. Chercher le nouveau max-width dans les chunks JS
docker exec obsidian-vps-publish sh -c "grep -r 'max-width:min(320px' /ui/"

# 3. Vérifier les marges corrigées (0.25rem au lieu de 0.5rem)
docker exec obsidian-vps-publish sh -c "grep -r 'margin:\.25rem 1\.5rem' /ui/"

# 4. Vérifier le HTML (doit contenir </figure><p>)
docker exec obsidian-vps-publish sh -c "grep -o '</figure>[^<]*<p>' /content/lore/pantheon/tenebra.html"
```

## 3. Si les styles sont TOUJOURS absents

```bash
# Vérifier que le fichier SCSS local contient bien les modifications
grep -A 5 "figure.md-asset.align-left" apps/site/src/presentation/pages/viewer/viewer.component.scss

# Si le fichier local est correct mais pas déployé, il faut vider le cache Nx AVANT le build Docker
rm -rf .nx/cache node_modules/.cache
docker compose -f docker-compose.yml -f docker-compose.dev.yml build --no-cache --pull
docker compose -f docker-compose.yml -f docker-compose.dev.yml up -d
```

## 4. Alternative : Utiliser la task VS Code

Tu peux aussi utiliser la task définie dans tasks.json :

**Ctrl+Shift+P** → "Tasks: Run Task" → **"Dev refresh"**

Cette task exécute en parallèle `Docker: dev up` et `Plugin: package`, ce qui correspond au workflow de développement.

---

**Rappel du problème identifié :**

- Le Dockerfile copiait une **ancienne version** des sources à cause du cache Docker sur `COPY apps ./apps`
- Le `--no-cache` standard ne suffit pas toujours car les **layers** peuvent être réutilisées
- Il faut **supprimer l'image** avant rebuild pour forcer Docker à tout reconstruire

Une fois le rebuild terminé, les styles devraient contenir :

- ✅ `max-width: min(320px, 45%)`
- ✅ `margin: 0.25rem 1.5rem 0.75rem 0` (au lieu de 0.5rem 1.5rem 1rem 0)
- ✅ `shape-outside: margin-box`

**\*\*\*\***\*\***\*\*\*\***\*\*\*\***\*\*\*\***\*\***\*\*\*\***\_\_\_**\*\*\*\***\*\***\*\*\*\***\*\*\*\***\*\*\*\***\*\***\*\*\*\***/
