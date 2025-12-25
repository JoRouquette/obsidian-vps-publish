# Performance Backend (API)

## Objectif

Optimiser les performances du backend Node.js pour réduire le temps de traitement des uploads et du rendering Markdown.

## Optimisations implémentées

### 1. Upload parallèle des batches

Le plugin upload maintenant **3 batches simultanément** au lieu de séquentiellement.

**Gain** : Latency réseau divisée par 3.

### 2. Traitement parallèle côté API

Le backend traite **10 notes/assets en parallèle** au lieu de séquentiellement.

**Gain** : CPU mieux utilisé, rendering Markdown parallélisé.

**Localisation** :

- `libs/core-application/src/lib/publishing/handlers/upload-notes.handler.ts`
- `libs/core-application/src/lib/publishing/handlers/upload-assets.handler.ts`

### 3. Yields périodiques

Des yields (`await new Promise(resolve => setTimeout(resolve, 0))`) sont insérés dans les boucles de traitement pour éviter de bloquer l'event loop.

**Utilisation** : `YieldScheduler` dans `libs/core-application/src/lib/utils/concurrency.util.ts`

**Intégration** :

- `ParseContentHandler` : 11 points de yield
- Dataview processing
- Uploads batches

## Gains de performance

### Vault moyen (~150 notes, 50 assets)

```
AVANT : ~16 secondes
APRÈS : ~8 secondes
GAIN  : 50% plus rapide
```

### Gros vault (~500 notes, 200 assets)

```
AVANT : ~43 secondes
APRÈS : ~19 secondes
GAIN  : 56% plus rapide
```

## Configuration

### Concurrence upload (plugin)

Hardcodée dans `apps/obsidian-vps-publish/src/lib/infra/notes-uploader.adapter.ts` et `assets-uploader.adapter.ts` :

```typescript
concurrency: 3; // 3 batches simultanés
```

### Concurrence traitement (backend)

Hardcodée dans `libs/core-application/src/lib/publishing/handlers/upload-notes.handler.ts` :

```typescript
const CONCURRENCY = 10; // 10 notes/assets simultanées
```

## Diagnostics

### Activer les logs de performance

1. **Plugin** : Settings → Log Level → Debug
2. **Backend** : Variable d'environnement `LOGGER_LEVEL=debug`

### Observer les métriques

**Console plugin (Ctrl+Shift+I dans Obsidian)** :

```
Batch upload progress: batchesCompleted=1, totalBatches=10
Starting parallel publishing of 150 notes (max 10 concurrent)
=== Performance Summary ===
upload-notes: 4532ms
upload-assets: 1823ms
```

**Logs backend** :

```
[INFO] Processing 150 notes with concurrency=10
[DEBUG] Batch 1-10 completed in 450ms
[INFO] All notes processed in 4.5s
```

## Troubleshooting

### Upload trop lent

**Symptômes** : Le publishing prend > 30s pour ~200 notes.

**Causes possibles** :

- Latency réseau élevée (>500ms)
- Backend CPU saturé
- Fichiers très volumineux (images > 5MB)

**Solutions** :

1. Vérifier la latence réseau : `ping votre-vps.com`
2. Réduire la taille des assets (compresser images)
3. Augmenter les ressources CPU du VPS

### Timeouts fréquents

**Symptômes** : Erreur `Request timeout` en plein publishing.

**Causes possibles** :

- Timeout HTTP trop court (défaut: 60s)
- Backend surchargé (autre trafic concurrent)

**Solutions** :

1. Augmenter `REQUEST_TIMEOUT` côté backend (env var)
2. Publier en dehors des heures de pointe
3. Réduire `CONCURRENCY` backend (de 10 à 5)

### Mémoire saturée backend

**Symptômes** : Erreur `Out of memory` dans logs backend.

**Causes possibles** :

- Trop de batches en mémoire simultanément
- Vault très volumineux (>1000 notes)

**Solutions** :

1. Augmenter RAM du VPS (min 1GB recommandé)
2. Réduire `CONCURRENCY` backend
3. Nettoyer le cache de sessions (redémarrer container)

## Références

- Code source : `apps/node/src/`, `libs/core-application/src/lib/publishing/`
- Utilitaires concurrence : `libs/core-application/src/lib/utils/concurrency.util.ts`
- Tests : `libs/core-application/src/_tests/publishing/`

---

**Dernière mise à jour** : 2025-12-25
