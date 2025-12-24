# API Performance Optimizations

## Analyse de l'architecture actuelle

### Workflow actuel

1. **Plugin** → compress + chunk → envoie batches séquentiellement
2. **API** → reçoit chunks → assemble → décompresse → traite
3. Chaque batch est traité **séquentiellement** (attente de réponse avant prochain batch)

### Goulots d'étranglement identifiés

#### 1. **Upload séquentiel des batches**

**Problème** : Le plugin attend la réponse de chaque batch avant d'envoyer le suivant.

**Impact** :

- Latency réseau multipliée par le nombre de batches
- Si 10 batches avec 200ms de latency réseau → +2000ms de délai incompressible

**Localisation** :

- `apps/obsidian-vps-publish/src/lib/infra/notes-uploader.adapter.ts:64-108`
- `apps/obsidian-vps-publish/src/lib/infra/assets-uploader.adapter.ts:98-145`

```typescript
// Actuel : séquentiel
for (const batch of batches) {
  const chunks = await this.chunkedUploadService.prepareUpload(uploadId, payload);
  await this.chunkedUploadService.uploadAll(chunks, uploader, ...);
  await yieldToEventLoop(); // Yield entre batches
}
```

#### 2. **Traitement synchrone côté API**

**Problème** : L'API traite chaque note individuellement de manière synchrone dans le handler.

**Impact** :

- CPU bloqué pendant le rendering Markdown (coûteux)
- Pas de parallélisation possible des opérations I/O (write HTML, update manifest)

**Localisation** :

- `libs/core-application/src/lib/publishing/handlers/upload-notes.handler.ts:60-96`

```typescript
// Actuel : boucle for synchrone
for (const note of notes) {
  const bodyHtml = await this.markdownRenderer.render(note);
  const fullHtml = this.buildHtmlPage(note, bodyHtml);
  await contentStorage.save({ route, content: fullHtml, slug });
  published++;
}
```

#### 3. **Middleware chunked upload séquentiel**

**Problème** : Les chunks sont réassemblés uniquement quand **tous** sont reçus.

**Impact** :

- Mémorisation de tous les chunks avant traitement (overhead mémoire)
- Pas de traitement anticipé possible

**Localisation** :

- `apps/node/src/infra/http/express/middleware/chunked-upload.middleware.ts:48-75`

## Solutions proposées

### Solution 1 : Upload parallèle des batches (IMPACT ÉLEVÉ)

**Principe** : Uploader plusieurs batches en parallèle avec concurrence contrôlée (ex: 3 simultanés).

**Avantages** :

- Réduction drastique du temps d'upload (latency réseau divisée par le facteur de concurrence)
- Utilise mieux la bande passante disponible
- Facile à implémenter avec les utilitaires existants (`ConcurrencyLimiter`)

**Implémentation** :

```typescript
// Dans NotesUploaderAdapter.upload()
import { processWithControlledConcurrency } from '@core-application/utils/concurrency.util';

async upload(notes: PublishableNote[]): Promise<boolean> {
  const batches = batchByBytes(notes, this.maxBytesPerRequest, (batch) => ({ notes: batch }));

  this._logger.debug(
    `Uploading ${notes.length} notes in ${batches.length} batch(es) with concurrency=3`
  );

  let batchIndex = 0;
  const uploadBatch = async (batch: PublishableNote[]) => {
    batchIndex++;
    const uploadId = `notes-${this.sessionId}-${this.guidGenerator.generateGuid()}`;

    const payload = {
      notes: batch,
      ...(batchIndex === 1 && this.cleanupRules ? { cleanupRules: this.cleanupRules } : {}),
    };

    const chunks = await this.chunkedUploadService.prepareUpload(uploadId, payload);
    const uploader = new NoteChunkUploaderAdapter(this.sessionClient, this.sessionId);

    await this.chunkedUploadService.uploadAll(chunks, uploader, (current, total) => {
      this._logger.debug('Chunk upload progress', { uploadId, current, total });
    });

    this.advanceProgress(batch.length);
  };

  // Upload batches avec concurrence=3
  await processWithControlledConcurrency(
    batches,
    uploadBatch,
    3, // concurrency
    50, // yieldAfterN operations
    (current, total) => {
      this._logger.debug('Batch upload progress', { current, total });
    }
  );

  this._logger.debug('Successfully uploaded notes to session');
  return true;
}
```

**Impact estimé** :

- Avec 10 batches et 200ms latency : **2000ms → ~800ms** (gain ~60%)
- Avec 5 batches : **1000ms → ~400ms** (gain ~60%)

**Risques** :

- Ordre d'arrivée des batches non garanti (mais l'API est stateless, pas de problème)
- Pic de charge côté API (limiter concurrency à 3-5 max)

---

### Solution 2 : Traitement parallèle côté API handler (IMPACT MOYEN-ÉLEVÉ)

**Principe** : Paralléliser le rendering Markdown + save HTML dans l'`UploadNotesHandler`.

**Avantages** :

- Utilise mieux les CPU multi-core côté backend
- Réduction du temps de traitement pour les gros batches
- Améliore le débit (throughput)

**Implémentation** :

```typescript
// Dans UploadNotesHandler.handle()
async handle(command: UploadNotesCommand): Promise<UploadNotesResult> {
  const { sessionId, notes } = command;
  const logger = this.logger?.child({ method: 'handle', sessionId });

  logger?.debug(`Starting parallel publishing of ${notes.length} notes`);

  // Traiter avec concurrence contrôlée
  const results = await Promise.allSettled(
    notes.map(async (note) => {
      const noteLogger = logger?.child({ noteId: note.noteId });

      // Render + save en parallèle
      const bodyHtml = await this.markdownRenderer.render(note);
      const fullHtml = this.buildHtmlPage(note, bodyHtml);

      await contentStorage.save({
        route: note.routing.fullPath,
        content: fullHtml,
        slug: note.routing.slug,
      });

      noteLogger?.debug('Note published successfully');
      return note;
    })
  );

  // Agréger les résultats
  const succeeded: PublishableNote[] = [];
  const errors: { noteId: string; message: string }[] = [];

  results.forEach((result, idx) => {
    if (result.status === 'fulfilled') {
      succeeded.push(result.value);
    } else {
      errors.push({
        noteId: notes[idx].noteId,
        message: result.reason?.message ?? 'Unknown error',
      });
    }
  });

  // Update manifest (groupé)
  if (succeeded.length > 0) {
    const pages: ManifestPage[] = succeeded.map((n) => ({ ... }));
    await manifestStorage.upsertPages(pages);
  }

  return { sessionId, published: succeeded.length, errors };
}
```

**Impact estimé** :

- Avec 50 notes et rendering à 50ms/note : **2500ms → ~600ms** (gain ~75% avec 4 cores)
- Avec 150 notes : **7500ms → ~2000ms** (gain ~73%)

**Risques** :

- Pic de consommation CPU/mémoire côté backend
- Surcharge si markdown rendering est I/O-bound plutôt que CPU-bound
- **Solution** : Limiter concurrence avec `processWithControlledConcurrency(notes, processNote, 10)`

---

### Solution 3 : Streaming de réponse API (IMPACT FAIBLE-MOYEN)

**Principe** : L'API renvoie un statut intermédiaire dès réception des chunks, sans attendre le traitement complet.

**Avantages** :

- Plugin peut continuer immédiatement avec le prochain batch
- Réduit la latency perçue côté client

**Implémentation** :

```typescript
// Dans session-controller.ts
router.post('/session/:sessionId/notes/upload', async (req: Request, res: Response) => {
  const parsed = UploadSessionNotesBodyDto.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ status: 'invalid_payload' });
  }

  // Répondre immédiatement "accepted"
  res.status(202).json({
    sessionId: req.params.sessionId,
    status: 'accepted',
    notes: parsed.data.notes.length,
  });

  // Traiter en arrière-plan (fire-and-forget)
  const command: UploadNotesCommand = { ... };
  notePublicationHandler.handle(command)
    .then(result => {
      routeLogger?.debug('Notes published', { published: result.published });
    })
    .catch(err => {
      routeLogger?.error('Error while publishing notes', { err });
    });
});
```

**Problème** : Comment gérer les erreurs ? Le plugin ne saura pas si un batch a échoué.

**Solution hybride** :

- Garder le statut 200 (synchrone) pour valider que les données sont reçues correctement
- Traiter en arrière-plan avec un worker pool
- Exposer un endpoint `/session/:sessionId/status` pour vérifier l'état du traitement

**Impact estimé** :

- Réduction de latency perçue : **oui**
- Réduction de durée totale : **non** (même durée, juste décalée)

---

### Solution 4 : Worker pool côté API (IMPACT MOYEN)

**Principe** : Déléguer le traitement des notes à un pool de workers (threads ou child processes).

**Avantages** :

- Parallélisation réelle multi-core (Node.js est single-threaded par défaut)
- Évite de bloquer l'event loop principal
- Scaling horizontal si déployé avec plusieurs instances

**Implémentation** :

```typescript
// Utiliser `worker_threads` de Node.js
import { Worker } from 'worker_threads';

class NotesWorkerPool {
  private workers: Worker[] = [];

  constructor(private readonly poolSize: number = 4) {
    for (let i = 0; i < poolSize; i++) {
      this.workers.push(new Worker('./note-worker.js'));
    }
  }

  async processNote(note: PublishableNote): Promise<string> {
    // Round-robin dispatch
    const worker = this.workers[Math.floor(Math.random() * this.workers.length)];

    return new Promise((resolve, reject) => {
      worker.once('message', resolve);
      worker.once('error', reject);
      worker.postMessage({ type: 'render', note });
    });
  }
}
```

**Impact estimé** :

- Avec 4 workers : Throughput x4 (si CPU-bound)
- Réduit latency pour les requêtes concurrentes

**Complexité** :

- Nécessite architecture worker (serialization/deserialization)
- Debugging plus complexe
- Overhead de communication inter-process

---

### Solution 5 : Optimisation du markdown rendering (IMPACT VARIABLE)

**Principe** : Profiler et optimiser le `markdownRenderer.render()` lui-même.

**Pistes** :

1. **Cache de rendering** : Si une note n'a pas changé, réutiliser le HTML précédent
2. **Pré-compilation des templates** : Si le renderer utilise des templates (callouts, etc.)
3. **Streaming rendering** : Commencer à écrire le HTML avant la fin du rendering

**Localisation** :

- Dépend de l'implémentation concrète du `MarkdownRendererPort`
- Identifier via profiling quelle étape est la plus coûteuse

**Impact estimé** :

- Variable selon l'implémentation actuelle (besoin de profiling)
- Potentiellement **20-50% de gain** si rendering est le goulot principal

---

## Recommandations par priorité

### 🔥 Priorité HAUTE (quick wins)

**1. Upload parallèle des batches (Solution 1)**

- **Effort** : Faible (utilise utilitaires existants)
- **Gain** : Élevé (~60% sur la phase d'upload)
- **Risque** : Faible (facile à rollback si problème)

**Implémentation** :

- Modifier `NotesUploaderAdapter.upload()` pour utiliser `processWithControlledConcurrency`
- Ajouter un setting pour concurrency (default=3, configurable via env var `UPLOAD_CONCURRENCY`)
- Idem pour `AssetsUploaderAdapter`

### 🟠 Priorité MOYENNE (gains significatifs)

**2. Traitement parallèle côté API (Solution 2)**

- **Effort** : Moyen (refactor du handler)
- **Gain** : Élevé (~70% sur la phase de traitement)
- **Risque** : Moyen (besoin de tester la charge CPU/mémoire)

**Implémentation** :

- Refactor `UploadNotesHandler.handle()` avec `Promise.allSettled`
- Ajouter un limiter de concurrency (ex: 10 notes simultanées max)
- Utiliser `processWithControlledConcurrency` pour contrôler la charge

**3. Profiling et optimisation du rendering (Solution 5)**

- **Effort** : Variable (dépend des findings)
- **Gain** : Variable (peut être énorme si le renderer est mal optimisé)
- **Risque** : Faible (optimisations ciblées)

**Implémentation** :

- Ajouter des spans performance pour chaque étape du rendering
- Identifier les regex coûteuses, les boucles inefficaces
- Implémenter un cache si pertinent

### 🟢 Priorité BASSE (nice-to-have)

**4. Worker pool (Solution 4)**

- **Effort** : Élevé (architecture complexe)
- **Gain** : Moyen-élevé (si CPU-bound et multi-instances)
- **Risque** : Élevé (complexité, debugging)

**Quand le faire** :

- Si les solutions 1+2 ne suffisent pas
- Si le backend doit gérer plusieurs sessions simultanées

**5. Streaming de réponse (Solution 3)**

- **Effort** : Moyen
- **Gain** : Faible (latency perçue, pas de gain réel)
- **Risque** : Moyen (gestion des erreurs asynchrones)

**Quand le faire** :

- Si les uploads deviennent très longs (>10s par batch)
- Nécessite un système de monitoring de jobs

---

## Plan d'action suggéré

### Phase 1 : Quick wins (1-2 jours)

1. ✅ Implémenter **upload parallèle des batches** (Solution 1)
   - Notes et assets
   - Configurable via env var `UPLOAD_CONCURRENCY=3`
2. ✅ Ajouter instrumentation performance pour l'API
   - Spans dans `UploadNotesHandler` pour chaque note
   - Métriques : `note-rendering-time`, `note-save-time`, `batch-processing-time`

### Phase 2 : Optimisations backend (2-3 jours)

3. ⚙️ Implémenter **traitement parallèle API** (Solution 2)
   - Avec `processWithControlledConcurrency(notes, processNote, 10)`
   - Tester charge CPU/mémoire avec gros batches
4. 🔍 Profiling du markdown renderer (Solution 5)
   - Identifier les goulots avec les spans ajoutés
   - Optimiser les étapes les plus coûteuses

### Phase 3 : Advanced optimizations (si nécessaire)

5. 🚀 Worker pool (Solution 4) - uniquement si phases 1+2 insuffisantes
6. 📡 Streaming de réponse (Solution 3) - uniquement si uploads très longs

---

## Métriques de succès

**Baseline actuel** (à mesurer avec un gros vault ~500 notes, 200 assets) :

- Upload notes : **~8-12 secondes**
- Upload assets : **~4-6 secondes**
- Durée totale publishing : **~15-25 secondes**

**Cibles après optimisations** :

- Upload notes : **~3-5 secondes** (gain 60-70%)
- Upload assets : **~1-2 secondes** (gain 60-70%)
- Durée totale publishing : **~6-10 secondes** (gain 60%)

**Métriques à surveiller** :

- CPU usage côté backend (ne pas dépasser 80% sustained)
- Mémoire backend (pas de leak sur chunk reassembly)
- Latency réseau (vérifier que la parallélisation n'augmente pas les timeouts)
- Taux d'erreur (pas de regression sur la fiabilité)

---

## Configuration recommandée

### Variables d'environnement

```bash
# Plugin (future implémentation)
UPLOAD_CONCURRENCY=3           # Batches simultanés (notes + assets)

# Backend
NOTES_PROCESSING_CONCURRENCY=10  # Notes traitées simultanément par batch
WORKER_POOL_SIZE=4              # (si worker pool implémenté)
CHUNK_CLEANUP_INTERVAL_MS=30000 # Nettoyage chunks plus fréquent
```

### Instrumentation

```typescript
// Ajouter dans perfTracker :
perfTracker.startSpan('upload-notes-parallel');
perfTracker.recordMetric('upload-concurrency', 3);
perfTracker.recordMetric('batches-uploaded-parallel', batchCount);
perfTracker.endSpan('upload-notes-parallel');

// Côté API :
perfTracker.startSpan('batch-processing');
perfTracker.recordMetric('notes-processed-parallel', notesCount);
perfTracker.endSpan('batch-processing');
```

---

## Conclusion

Les **Solutions 1 + 2** (upload parallèle + traitement parallèle API) sont les plus rentables en termes de **gain/effort**. Elles permettent de réduire la durée totale de **~60%** avec un effort d'implémentation raisonnable et un risque contrôlé.

La **Solution 5** (profiling du renderer) est à faire systématiquement car elle peut révéler des gains inattendus.

Les **Solutions 3 + 4** sont des optimisations avancées à réserver pour des scénarios extrêmes (vaults de milliers de notes, backend partagé multi-utilisateurs).
