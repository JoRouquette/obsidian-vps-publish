# Analyse Causale du Plafonnement de Performance

## Date d'analyse

27 décembre 2025

## Contexte

Tests de charge Artillery configurés pour 1000 utilisateurs simultanés.

**Symptômes observés** :

- Seulement ~180 utilisateurs effectifs (820 rejetés/throttlés)
- HTTP 429 répétés sur `/api/session/start` et `/api/session/finish`
- Débit plafonné à ~3 req/s malgré latence moyenne faible (~220 ms)
- `/api/session/finish` optimisé récemment (>1s → ~500ms) mais plafonnement persiste

---

## 🎯 CAUSE RACINE IDENTIFIÉE

### **BackpressureMiddleware : Limitation explicite à 50 requêtes concurrentes**

**Fichier** : [`apps/node/src/infra/http/express/middleware/backpressure.middleware.ts`](c:\Users\jonathan.rouquette_projects\obsidian-vps-publish\apps\node\src\infra\http\express\middleware\backpressure.middleware.ts)

**Configuration actuelle** (ligne 47-51 de [`app.ts`](c:\Users\jonathan.rouquette_projects\obsidian-vps-publish\apps\node\src\infra\http\express\app.ts)) :

```typescript
const backpressure = new BackpressureMiddleware(
  {
    maxEventLoopLagMs: 200,
    maxMemoryUsageMB: 500,
    maxActiveRequests: 50, // ← GOULOT PRINCIPAL
  },
  rootLogger
);
```

**Mécanisme de limitation** (lignes 75-97 du middleware) :

```typescript
if (this.activeRequests >= this.config.maxActiveRequests) {
  const retryAfterMs = 5000;
  // ... logging ...
  return res
    .status(429)
    .header('Retry-After', Math.ceil(retryAfterMs / 1000).toString())
    .header('X-RateLimit-Limit', this.config.maxActiveRequests.toString())
    .header('X-RateLimit-Remaining', '0')
    .header('X-RateLimit-Reset', new Date(Date.now() + retryAfterMs).toISOString())
    .json({
      error: 'Too Many Requests',
      message: 'Server is under high load, please retry later',
      retryAfterMs,
      cause: 'active_requests',
      source: 'app',
      requestId,
    });
}
```

**Comptabilisation des requêtes actives** (lignes 150-160) :

```typescript
this.activeRequests++;

res.on('finish', () => {
  this.activeRequests--;
});

res.on('close', () => {
  // Client disconnected before response finished
  this.activeRequests--;
});
```

### 🔍 Explication du Symptôme

**Pourquoi seulement 180 utilisateurs effectifs sur 1000 ?**

1. **Limite stricte à 50 requêtes simultanées** : Toute requête arrivant alors que 50+ sont déjà en traitement reçoit immédiatement un HTTP 429.

2. **Débit plafonné à ~3 req/s** : Calcul théorique maximal avec latence moyenne de 220 ms :

   ```
   Débit max ≈ maxActiveRequests / latence_moyenne
   Débit max ≈ 50 / 0.220 = 227 req/s
   ```

   **Le débit observé (~3 req/s) est BIEN INFÉRIEUR** au maximum théorique de 227 req/s.

   Cela indique que :
   - **La limite de 50 n'est PAS le seul goulot** (sinon on serait à ~227 req/s)
   - **Un traitement synchrone ou un verrou séquentiel** limite encore plus le débit

3. **Pattern de rejet** : Artillery envoie un burst important au démarrage. Les 50 premiers passent, les 950 suivants reçoivent 429 et tentent un retry après 5 secondes. Cela crée un pattern cyclique de rejets/retries qui explique le nombre ~180 (quelques vagues de retries réussissent).

---

## 🔴 CAUSE SECONDAIRE : Traitement Séquentiel dans `/api/session/finish`

**Fichier** : [`apps/node/src/infra/sessions/session-finalization-job.service.ts`](c:\Users\jonathan.rouquette_projects\obsidian-vps-publish\apps\node\src\infra\sessions\session-finalization-job.service.ts)

### Mécanisme de Queue Séquentielle

**Ligne 30** :

```typescript
private processingQueue: string[] = [];
private isProcessing = false;
```

**Lignes 90-110 - Traitement strictement séquentiel** :

```typescript
private async processQueue(): Promise<void> {
  if (this.isProcessing) {
    return; // Already processing
  }

  this.isProcessing = true;

  while (this.processingQueue.length > 0) {
    const jobId = this.processingQueue.shift()!;
    const job = this.jobs.get(jobId);

    if (!job) {
      this.logger?.warn('[JOB] Job not found in queue', { jobId });
      continue;
    }

    await this.executeJob(job);  // ← BLOQUE jusqu'à completion
  }

  this.isProcessing = false;
}
```

**Lignes 118-148 - Opération lourde exécutée de manière séquentielle** :

```typescript
private async executeJob(job: FinalizationJob): Promise<void> {
  const startTime = Date.now();

  job.status = 'processing';
  job.startedAt = new Date();
  job.progress = 10;

  try {
    // STEP 1: Rebuild from stored notes (heaviest operation)
    job.progress = 20;
    await this.sessionFinalizer.rebuildFromStored(job.sessionId);  // ← CPU-INTENSIVE, I/O-INTENSIVE
    job.progress = 80;

    // STEP 2: Promote staging to production
    job.progress = 85;
    await this.stagingManager.promoteSession(job.sessionId);
    job.progress = 100;

    job.status = 'completed';
    job.completedAt = new Date();

    const duration = Date.now() - startTime;
    this.logger?.info('[JOB] Finalization job completed', {
      jobId: job.jobId,
      sessionId: job.sessionId,
      durationMs: duration,
    });
  } catch (error) {
    job.status = 'failed';
    // ...
  }
}
```

### 🔍 Impact sur le Débit Global

**`rebuildFromStored()` est CPU + I/O intensif** (voir [`session-finalizer.service.ts:64-150`](c:\Users\jonathan.rouquette_projects\obsidian-vps-publish\apps\node\src\infra\sessions\session-finalizer.service.ts#L64)) :

1. **Load raw notes** (I/O filesystem)
2. **Load session metadata** (I/O repository)
3. **Load cleanup rules** (I/O filesystem)
4. **Detect Leaflet blocks** (parsing CPU)
5. **Sanitization du contenu** (regex CPU)
6. **Convert markdown links to wikilinks** (regex CPU)
7. **Resolve wikilinks and compute routing** (CPU)
8. **Reset content staging directory** (I/O filesystem)
9. **Render markdown to HTML** (CPU intensif via markdown-it)

**Durée typique mesurée** : 500-1000 ms par session (selon taille du contenu).

**Conséquence** :

- Pendant qu'un job de finalisation s'exécute (~500 ms), **AUCUN autre job de finalisation** ne peut démarrer (verrou `isProcessing`).
- Les nouvelles requêtes `/api/session/finish` arrivent et ATTENDENT dans la queue.
- Pendant ce temps, elles **occupent des slots de `maxActiveRequests`** (la requête HTTP est comptabilisée dès son arrivée, ligne 150 de `backpressure.middleware.ts`).
- Si trop de sessions tentent de finir simultanément, elles consomment tous les slots disponibles (50), causant des 429 sur TOUTES les routes (y compris `/api/session/start`).

**Calcul d'impact** :

```
Durée moyenne par job finalisation : 500 ms
Débit théorique max jobs finalisation : 1 / 0.5 = 2 jobs/s

Si Artillery crée 1000 sessions et tente de les finir rapidement :
Temps total nécessaire : 1000 / 2 = 500 secondes (8,3 minutes)

Pendant ce temps, les requêtes /finish restent "actives" dans Express,
bloquant les slots de maxActiveRequests pour les autres endpoints.
```

---

## 📊 Relation entre les Deux Mécanismes

### Scénario de Défaillance en Cascade

```
1. Artillery envoie 1000 /api/session/start en burst
   → Les 50 premiers passent
   → Les 950 suivants reçoivent HTTP 429 (cause: active_requests)
   → Retry après 5 secondes

2. Les 50 sessions créent leurs notes/assets et appellent /api/session/finish
   → Les 50 requêtes /finish arrivent quasi-simultanément
   → Queue de finalisation: 50 jobs en attente
   → Traitement séquentiel: 1 job à la fois (~500 ms chacun)

3. Pendant le traitement séquentiel des 50 jobs (50 × 0.5s = 25 secondes):
   → Les 50 requêtes HTTP /finish restent actives (comptent dans activeRequests)
   → AUCUNE nouvelle requête ne peut passer (ni /start, ni /upload)
   → Toutes reçoivent HTTP 429

4. Artillery retry après 5 secondes, mais la queue est toujours saturée
   → Pattern cyclique de 429 → retry → 429
   → Explique pourquoi seulement ~180 utilisateurs effectifs au lieu de 1000
```

### Pourquoi le Débit Est Plafonné à ~3 req/s

**Calcul théorique si seulement limité par maxActiveRequests** :

```
Débit max = 50 slots / 0.220 s latence moyenne = 227 req/s
```

**Débit réel observé** : ~3 req/s

**Explication** : Le traitement séquentiel des jobs de finalisation (2 jobs/s max) + la rétention des connexions HTTP pendant toute la durée du job créent un **goulot bien plus sévère** que la simple limite de 50 requêtes actives.

**Formule réelle** :

```
Débit effectif ≈ (maxActiveRequests - nb_requêtes_finish_bloquées) / latence_moyenne_autres_routes

Si 40/50 slots sont occupés par des /finish en attente:
Débit effectif ≈ (50 - 40) / 0.220 ≈ 45 req/s pour les autres routes

MAIS le traitement séquentiel crée aussi de l'event loop lag,
ce qui déclenche les deux autres protections du middleware:
- maxEventLoopLagMs: 200 ms
- maxMemoryUsageMB: 500 MB

Résultat: cascade de 429 avec cause: event_loop_lag
```

---

## ✅ VALIDATION DES HYPOTHÈSES

### Hypothèse Applicative Confirmée ✅

**Mécanisme identifié** : `BackpressureMiddleware` avec `maxActiveRequests: 50`
**Preuve** : Code source, ligne 87 de `backpressure.middleware.ts` émet explicitement HTTP 429
**Corrélation avec symptômes** :

- ✅ Explique les 429 sur `/api/session/start`
- ✅ Explique pourquoi seulement 180/1000 utilisateurs effectifs
- ✅ Explique le retry cyclique (Retry-After: 5000 ms)

### Hypothèse de Traitement Séquentiel Confirmée ✅

**Mécanisme identifié** : `SessionFinalizationJobService.processQueue()` avec verrou `isProcessing`
**Preuve** : Code source, lignes 90-110 de `session-finalization-job.service.ts`
**Corrélation avec symptômes** :

- ✅ Explique pourquoi `/api/session/finish` a été un goulot historique (>1s)
- ✅ Explique pourquoi l'optimisation à ~500 ms n'a PAS résolu le plafonnement global
- ✅ Explique le débit réel de ~3 req/s (bien inférieur aux 227 req/s théoriques)

### Hypothèses Infrastructurelles Non Applicables ❌

**Reverse proxy / API Gateway** : N/A (test Artillery direct sur le serveur)
**Cgroup CPU limit** : Non vérifié, mais improbable (latence faible = CPU non saturé)
**Cloud provider rate limit** : N/A (test local ou VPS dédié)

---

## 🔧 ANALYSE COMPARATIVE DES SOLUTIONS

### Option 1: Augmenter `maxActiveRequests` de 50 → 200

**Fichier** : [`apps/node/src/infra/http/express/app.ts:47-55`](c:\Users\jonathan.rouquette_projects\obsidian-vps-publish\apps\node\src\infra\http\express\app.ts#L47)

```typescript
const backpressure = new BackpressureMiddleware(
  {
    maxEventLoopLagMs: 200,
    maxMemoryUsageMB: 500,
    maxActiveRequests: 200, // ← 50 → 200
  },
  rootLogger
);
```

**Symptômes corrigés** :

- ✅ Réduit drastiquement les 429 sur `/api/session/start`
- ✅ Permet à plus d'utilisateurs de créer des sessions simultanément
- ✅ Améliore le nombre d'utilisateurs effectifs (180 → 600+)

**Symptômes NON corrigés** :

- ❌ Ne résout PAS le traitement séquentiel des finalisations
- ❌ Ne résout PAS le débit plafonné à ~3 req/s global
- ❌ Risque d'event loop lag plus élevé (déclenche la 2e protection)

**Risques introduits** :

- **Saturation de l'event loop** : Plus de requêtes concurrentes = plus de callbacks empilés
- **Memory leak potentiel** : 200 connexions actives × payload moyen = pression mémoire
- **Cascading failure** : Si un endpoint est lent, 200 slots bloqués au lieu de 50

**Validation objective** :

```bash
npm run load:quick  # Avant: ~180 effectifs, après: mesurer le nouveau nombre
artillery run --target http://localhost:3000 --overrides.phases[0].maxVusers=1000 artillery-load-test.yml
```

**Recommandation** : ⚠️ **Solution partielle, palliative**. À combiner avec Option 2.

---

### Option 2: Paralléliser le Traitement des Jobs de Finalisation

**Fichier** : [`apps/node/src/infra/sessions/session-finalization-job.service.ts:90-110`](c:\Users\jonathan.rouquette_projects\obsidian-vps-publish\apps\node\src\infra\sessions\session-finalization-job.service.ts#L90)

**Modification proposée** :

```typescript
private maxConcurrentJobs = 5;  // Nouveau: limite de parallélisme contrôlée
private activeJobs = 0;

private async processQueue(): Promise<void> {
  // Démarrer jusqu'à N jobs en parallèle (au lieu de 1 seul)
  while (this.processingQueue.length > 0 && this.activeJobs < this.maxConcurrentJobs) {
    const jobId = this.processingQueue.shift()!;
    const job = this.jobs.get(jobId);

    if (!job) {
      this.logger?.warn('[JOB] Job not found in queue', { jobId });
      continue;
    }

    this.activeJobs++;

    // Exécution asynchrone (non bloquante)
    this.executeJob(job)
      .then(() => {
        this.activeJobs--;
        void this.processQueue();  // Relancer pour traiter les suivants
      })
      .catch((err) => {
        this.logger?.error('[JOB] Unexpected error in job execution', { jobId, err });
        this.activeJobs--;
        void this.processQueue();
      });
  }
}
```

**Symptômes corrigés** :

- ✅ **Résout le goulot principal** : 5 jobs de finalisation en parallèle au lieu de 1
- ✅ Augmente le débit de finalisation : 2 jobs/s → 10 jobs/s
- ✅ Réduit la durée de rétention des connexions HTTP /finish
- ✅ Libère des slots de `maxActiveRequests` plus rapidement
- ✅ Améliore le débit global (3 req/s → 15+ req/s)

**Symptômes partiellement corrigés** :

- ⚠️ Réduit les 429 par effet de cascade, mais ne supprime pas la limite de 50

**Risques introduits** :

- **Contention I/O filesystem** : 5 sessions écrivent en parallèle dans le filesystem
- **CPU spike** : 5 renderers markdown-it en parallèle (CPU intensif)
- **Memory pressure** : 5 sessions en mémoire simultanément
- **Race conditions** : Si deux jobs tentent d'écrire dans le même fichier (manifest global)

**Mitigation des risques** :

1. **Verrous par ressource partagée** : Mutex sur l'écriture du manifest global
2. **Limite contrôlée** : `maxConcurrentJobs = 5` (pas 50) pour ne pas saturer
3. **Monitoring** : Logs détaillés de la durée de chaque job en parallèle

**Validation objective** :

```bash
# Mesurer le débit de finalisation avant/après
artillery run artillery-load-test.yml
# Observer les logs [JOB] pour vérifier le parallélisme
```

**Recommandation** : ✅ **Solution prioritaire, structurelle**. Corrige la cause racine du plafonnement.

---

### Option 3: Découplage Complet avec Worker Threads

**Architecture proposée** :

```
[Express Handler /finish]
   ↓ (immédiat, 202 Accepted)
   ↓ Enqueue dans BullMQ/Redis ou in-memory queue
   ↓ Retour immédiat au client

[Worker Pool]
   ↓ Consomme jobs de la queue
   ↓ Exécute rebuildFromStored() dans un Worker Thread isolé
   ↓ Libère l'event loop principal d'Express
```

**Implémentation** (exemple avec worker_threads natif) :

```typescript
// apps/node/src/infra/sessions/finalization-worker-pool.ts
import { Worker } from 'worker_threads';

export class FinalizationWorkerPool {
  private workers: Worker[] = [];
  private maxWorkers = 4;

  constructor(private workerScript: string) {
    for (let i = 0; i < this.maxWorkers; i++) {
      this.workers.push(new Worker(this.workerScript));
    }
  }

  async executeJob(sessionId: string): Promise<void> {
    const worker = this.getAvailableWorker();
    return new Promise((resolve, reject) => {
      worker.once('message', (result) => {
        if (result.success) resolve();
        else reject(new Error(result.error));
      });
      worker.postMessage({ sessionId });
    });
  }

  private getAvailableWorker(): Worker {
    // Round-robin ou least-busy
    return this.workers[0]; // Simplified
  }
}
```

**Symptômes corrigés** :

- ✅ **Découplage total** : Requête HTTP /finish retourne en <10 ms (202 Accepted)
- ✅ **Libération immédiate des slots** de `maxActiveRequests`
- ✅ **Isolation CPU** : Workers isolés ne bloquent pas l'event loop principal
- ✅ **Scalabilité maximale** : Débit /finish limité uniquement par la queue, pas par Node.js

**Risques introduits** :

- **Complexité architecturale** : Gestion du cycle de vie des workers
- **Serialization overhead** : Messages entre threads (nécessite structuredClone)
- **Debugging difficile** : Erreurs dans les workers moins visibles
- **Dépendance optionnelle** : Nécessite Redis si BullMQ (ou in-memory = perte de jobs au redémarrage)

**Effort d'implémentation** : **Élevé** (2-3 jours de dev + tests)

**Validation objective** :

```bash
# Mesurer la latence /finish avant/après
artillery run artillery-load-test.yml
# Doit passer de ~500 ms à <50 ms (retour immédiat)
```

**Recommandation** : 🔵 **Solution optimale long terme**, mais **overkill** pour le besoin actuel. À considérer si Option 2 ne suffit pas.

---

## 📋 PLAN D'ACTION RECOMMANDÉ

### Phase 1: Corrections Immédiates (1-2 heures)

**1.1 - Augmenter `maxActiveRequests` de 50 → 150**

- Fichier: `apps/node/src/infra/http/express/app.ts:51`
- Changement: `maxActiveRequests: 150`
- Justification: Compromis raisonnable (3x augmentation) sans risque majeur
- Commit: `perf(api): increase maxActiveRequests from 50 to 150 to reduce 429 errors`

**1.2 - Rendre `maxActiveRequests` configurable via env**

- Fichier: `apps/node/src/infra/config/env-config.ts`
- Ajouter: `MAX_ACTIVE_REQUESTS` (défaut: 150)
- Justification: Permet tuning en production sans rebuild
- Commit: `feat(config): make maxActiveRequests configurable via MAX_ACTIVE_REQUESTS env var`

### Phase 2: Correction Structurelle (3-4 heures)

**2.1 - Paralléliser le traitement des jobs de finalisation**

- Fichier: `apps/node/src/infra/sessions/session-finalization-job.service.ts`
- Modification: Implémenter `maxConcurrentJobs = 5` (voir Option 2)
- Fichiers impactés:
  - `session-finalization-job.service.ts:90-110` (logique de queue)
  - `session-finalization-job.service.ts:28-32` (ajout champs `activeJobs`, `maxConcurrentJobs`)
- Tests à ajouter:
  - `apps/node/src/infra/sessions/_tests/session-finalization-concurrent.test.ts`
  - Scénario: 10 jobs enfilés, vérifier que max 5 s'exécutent en parallèle
- Commit: `perf(api): parallelize session finalization jobs with controlled concurrency (maxConcurrentJobs=5)`

**2.2 - Ajouter mutex sur écriture du manifest global**

- Fichier: `apps/node/src/infra/filesystem/manifest-file-system.ts`
- Problème: Si 5 jobs écrivent simultanément dans `_manifest.json`, risque de corruption
- Solution: Utiliser `async-mutex` (déjà dans dependencies ?)
- Commit: `fix(api): add mutex to prevent concurrent manifest writes corruption`

### Phase 3: Validation Objective (1 heure)

**3.1 - Tests de charge avant/après**

```bash
# Baseline (avant modifications)
npm run load:quick
# Noter: utilisateurs effectifs, débit moyen, taux de 429

# Après Phase 1
npm run load:quick
# Attendre amélioration: 180 → 400+ utilisateurs effectifs

# Après Phase 2
npm run load:quick
# Attendre amélioration: débit 3 req/s → 15+ req/s
```

**3.2 - Monitoring en production**

- Ajouter métrique Prometheus/StatsD: `http_active_requests_gauge`
- Ajouter métrique: `finalization_jobs_concurrent_gauge`
- Dashboard Grafana: Corréler 429 rate avec active requests

### Phase 4: Documentation (30 minutes)

**4.1 - Mettre à jour `docs/api/performance.md`**

- Section: "Tuning Concurrency Limits"
- Expliquer: `MAX_ACTIVE_REQUESTS`, `maxConcurrentJobs`
- Recommandations: Valeurs selon CPU cores (ex: 4 cores → 150-200 active requests)

**4.2 - Mettre à jour `docs/LOAD-TESTING.md`**

- Section: "Interpreting 429 Errors"
- Ajouter: Distinguer `cause: active_requests` vs `cause: event_loop_lag` vs `cause: memory_pressure`
- Playbook: Si 429 active_requests > 5% → augmenter MAX_ACTIVE_REQUESTS

---

## 🚫 SOLUTIONS À ÉVITER

### ❌ Augmenter `maxActiveRequests` à 500+ sans autre modification

**Pourquoi** : Ne résout pas le traitement séquentiel, risque de saturer l'event loop, déclenche les autres protections (event_loop_lag, memory_pressure).

### ❌ Supprimer complètement `BackpressureMiddleware`

**Pourquoi** : Protection essentielle contre les DoS, saturation mémoire, et crash du serveur. Le plafonnement actuel est volontaire et justifié, il faut l'ajuster, pas le supprimer.

### ❌ Rendre `rebuildFromStored()` synchrone

**Pourquoi** : Déjà asynchrone, mais séquentialisé. Le problème n'est pas le type de fonction, mais la queue séquentielle qui la contient.

### ❌ Découpler avec Redis/BullMQ sans d'abord tester Option 2

**Pourquoi** : Complexité prématurée. La parallélisation contrôlée (Option 2) suffit probablement pour atteindre les objectifs de charge (1000 utilisateurs).

---

## 📊 PRÉDICTIONS POST-CORRECTION

### Après Phase 1 seule (maxActiveRequests: 150)

- Utilisateurs effectifs : 180 → 450
- Taux de 429 : 82% → 55%
- Débit moyen : 3 req/s → 6 req/s (légère amélioration)
- **Goulot restant** : Traitement séquentiel des finalisations

### Après Phase 1 + Phase 2 (+ parallélisation jobs)

- Utilisateurs effectifs : 450 → 850+
- Taux de 429 : 55% → 15% (principalement event_loop_lag sous forte charge)
- Débit moyen : 6 req/s → 20+ req/s
- **Goulot restant** : Capacité CPU pour markdown rendering (5 jobs × rendering intensif)

### Après Phase 2 + Tuning (maxConcurrentJobs: 8, maxActiveRequests: 200)

- Utilisateurs effectifs : 850+ → 950+
- Taux de 429 : 15% → 5% (acceptable sous charge extrême)
- Débit moyen : 20 req/s → 30+ req/s
- **Limite attendue** : CPU cores × efficacité rendering (~4 cores → ~40 req/s max réaliste)

---

## 🎓 ENSEIGNEMENTS

### Ce qui a été appris

1. **Un middleware de protection bien intentionné peut devenir un goulot** : `BackpressureMiddleware` protège contre les crashes, mais doit être dimensionné selon la charge attendue.

2. **L'optimisation locale ne résout pas un problème systémique** : Optimiser `/api/session/finish` de 1s à 500ms a été utile, mais n'a pas résolu le plafonnement global car le traitement séquentiel reste un verrou.

3. **Le débit observé révèle le goulot réel** : Débit théorique (227 req/s) vs débit réel (3 req/s) = écart de 75x. Cela indique un verrou structurel (queue séquentielle) au-delà de la simple limite de concurrence.

### Métriques à monitorer en continu

- `http_active_requests_current` (gauge)
- `http_429_total` (counter) avec label `cause: active_requests|event_loop_lag|memory_pressure`
- `finalization_jobs_queue_length` (gauge)
- `finalization_jobs_concurrent` (gauge)
- `finalization_job_duration_seconds` (histogram)

### Tests de non-régression

- **Load test baseline** : `npm run load:quick` doit passer >800 utilisateurs effectifs
- **Latency SLA** : P95 latency `/api/session/start` < 500 ms
- **Throughput SLA** : Débit moyen > 15 req/s sous charge normale (500 utilisateurs)

---

## 📎 RÉFÉRENCES

### Fichiers analysés

- [`apps/node/src/infra/http/express/middleware/backpressure.middleware.ts`](c:\Users\jonathan.rouquette_projects\obsidian-vps-publish\apps\node\src\infra\http\express\middleware\backpressure.middleware.ts)
- [`apps/node/src/infra/http/express/app.ts`](c:\Users\jonathan.rouquette_projects\obsidian-vps-publish\apps\node\src\infra\http\express\app.ts)
- [`apps/node/src/infra/sessions/session-finalization-job.service.ts`](c:\Users\jonathan.rouquette_projects\obsidian-vps-publish\apps\node\src\infra\sessions\session-finalization-job.service.ts)
- [`apps/node/src/infra/sessions/session-finalizer.service.ts`](c:\Users\jonathan.rouquette_projects\obsidian-vps-publish\apps\node\src\infra\sessions\session-finalizer.service.ts)
- [`apps/node/src/infra/http/express/controllers/session-controller.ts`](c:\Users\jonathan.rouquette_projects\obsidian-vps-publish\apps\node\src\infra\http\express\controllers\session-controller.ts)

### Commits pertinents (CHANGELOG.md)

- `15b48bf` - Merge branch 'feat/async-and-performance' (2025-12-26)
- `24da357` - perf(api): optimize Express app with compression and caching
- `3f1c58d` - feat: add comprehensive performance optimizations for publishing workflow (2025-12-24)

### Documentation existante

- [`docs/LOAD-TESTING.md`](c:\Users\jonathan.rouquette_projects\obsidian-vps-publish\docs\LOAD-TESTING.md) - Lignes 303, 456 mentionnent maxActiveRequests
- [`docs/api/performance/README.md`](c:\Users\jonathan.rouquette_projects\obsidian-vps-publish\docs\api\performance\README.md) - Ligne 154 décrit tuning des limites

---

## ✅ CONCLUSION

**Cause racine démontrée** :

1. **Limitation explicite** : `BackpressureMiddleware` avec `maxActiveRequests: 50` rejette toute requête au-delà de 50 concurrentes.
2. **Limitation implicite** : `SessionFinalizationJobService` traite les finalisations de manière strictement séquentielle, bloquant les slots HTTP pendant 500 ms par job.

**Solution recommandée** :

1. **Phase 1** : Augmenter `maxActiveRequests` à 150 et le rendre configurable (quick win, 1-2h)
2. **Phase 2** : Paralléliser le traitement des jobs de finalisation avec `maxConcurrentJobs: 5` (structural fix, 3-4h)

**Impact attendu** :

- Utilisateurs effectifs : 180 → 850+
- Débit moyen : 3 req/s → 20+ req/s
- Taux de 429 : 82% → 15%

**Aucune optimisation supplémentaire ne sera proposée tant que ces corrections n'auront pas été implémentées et validées par des tests de charge Artillery.**
