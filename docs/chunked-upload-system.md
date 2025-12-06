# Système de Compression et Chunking des Uploads

## Vue d'ensemble

Ce système évite les erreurs HTTP 413 (Request Entity Too Large) en compressant et découpant automatiquement toutes les données avant l'upload, puis en les reconstituant côté serveur.

## Architecture

### Côté Client (Obsidian Plugin)

#### 1. **ChunkedUploadService** (`apps/obsidian-vps-publish/src/lib/services/chunked-upload.service.ts`)

Service générique qui gère la compression et le découpage des données.

**Fonctionnalités :**

- Compression gzip des données JSON (réduction de 60-80% pour du texte)
- Découpage en chunks de taille configurable (défaut : 5MB)
- Retry automatique avec backoff exponentiel (3 tentatives par défaut)
- Logging détaillé des métriques de compression

**Utilisation :**

```typescript
const service = new ChunkedUploadService(logger, {
  maxChunkSize: 5 * 1024 * 1024, // 5MB
  compressionLevel: 6, // 0-9
  retryAttempts: 3,
});

const chunks = await service.prepareUpload(uploadId, data);
await service.uploadAll(chunks, uploadFn, onProgress);
```

#### 2. **NotesUploaderAdapter** & **AssetsUploaderAdapter**

Adaptateurs modifiés pour utiliser automatiquement le système de chunking.

**Changements :**

- Les données sont maintenant compressées avant l'envoi
- Les batches sont envoyés chunk par chunk
- Chaque chunk a un ID unique pour le suivi
- Retry automatique en cas d'échec

### Côté Serveur (Node/Express)

#### 3. **ChunkedUploadMiddleware** (`apps/node/src/infra/http/express/middleware/chunked-upload.middleware.ts`)

Middleware Express qui intercepte les requêtes chunkées, assemble les chunks et décompresse les données.

**Fonctionnalités :**

- Détection automatique des requêtes chunkées (basée sur la structure du body)
- Stockage temporaire des chunks en mémoire
- Assemblage et décompression automatique quand tous les chunks sont reçus
- Nettoyage automatique des chunks expirés (10 minutes)
- Réponse 202 (Accepted) pour les chunks intermédiaires
- Réponse 200 avec données reconstituées pour le dernier chunk

**Intégration :**

```typescript
const chunkedUploadMiddleware = new ChunkedUploadMiddleware(logger);
apiRouter.use(chunkedUploadMiddleware.handle());
```

Le middleware est transparent : les routes existantes reçoivent les données décompressées sans modification.

## Format des Chunks

```typescript
interface ChunkedData {
  metadata: {
    uploadId: string; // ID unique de l'upload
    chunkIndex: number; // Index du chunk (0-based)
    totalChunks: number; // Nombre total de chunks
    originalSize: number; // Taille originale (avant compression)
    compressedSize: number; // Taille compressée totale
  };
  data: string; // Chunk compressé encodé en base64
}
```

## Flux de Données

### Upload de Notes

1. **Client** : `NotesUploaderAdapter`
   - Prépare un batch de notes
   - Génère un `uploadId` unique : `notes-{sessionId}-{nanoid}`
   - Compresse le batch JSON avec gzip
   - Découpe en chunks de 5MB
   - Envoie chaque chunk via `sessionClient.uploadChunk()`

2. **Serveur** : `ChunkedUploadMiddleware`
   - Reçoit le chunk
   - Le stocke en mémoire avec son index
   - Si tous les chunks ne sont pas reçus : retourne 202
   - Si tous les chunks sont reçus :
     - Assemble les chunks dans l'ordre
     - Décompresse avec pako.ungzip()
     - Parse le JSON
     - Remplace `req.body` avec les données décompressées
     - Continue vers le handler suivant

3. **Handler** : `UploadNotesHandler`
   - Reçoit les données décompressées dans `req.body`
   - Traite normalement (aucun changement nécessaire)

### Upload d'Assets

Même processus, mais avec `AssetsUploaderAdapter` et `uploadAssetChunk()`.

## Avantages

### Réduction de la Bande Passante

- **Texte/JSON** : ~70% de réduction (notes, frontmatter)
- **Données binaires déjà compressées** : ~5-10% de réduction
- Exemple : 10MB de notes → ~3MB compressé → 1 seule requête

### Fiabilité

- Évite les erreurs 413 (payload too large)
- Retry automatique par chunk (pas tout l'upload)
- Chunks plus petits = moins de risque de timeout
- Tracking précis de la progression

### Performance

- Envoi séquentiel avec retry intelligent
- Compression côté client (libère le CPU serveur)
- Décompression une seule fois côté serveur
- Nettoyage automatique de la mémoire

## Configuration

### Limites Recommandées

```typescript
// Client
maxChunkSize: 5 * 1024 * 1024; // 5MB par chunk
compressionLevel: 6; // Bon compromis vitesse/taille
retryAttempts: 3; // 3 tentatives

// Serveur
MAX_REQUEST_SIZE: '50mb'; // Express body limit
chunkExpirationMs: 600000; // 10 minutes
```

### Métriques de Compression

Le service log automatiquement :

- Taille originale vs compressée
- Ratio de compression
- Nombre de chunks générés
- Progression de l'upload

Exemple de log :

```
[ChunkedUploadService] Data compressed
  originalSize: 15728640 (15MB)
  compressedSize: 4718592 (4.5MB)
  compressionRatio: 70%
  totalChunks: 1
```

## Gestion d'Erreurs

### Retry avec Backoff Exponentiel

```typescript
attempt 1: immediate
attempt 2: 1s delay
attempt 3: 2s delay
max delay: 10s
```

### Scénarios d'Échec

1. **Chunk échoue après 3 tentatives**
   - Erreur levée avec détails
   - Upload complet échoue
   - Message : "Failed to upload chunk X/Y after 3 attempts"

2. **Chunks expirés (>10min)**
   - Nettoyage automatique côté serveur
   - Nouvel upload nécessaire
   - Log : "Expired chunk store cleaned"

3. **Taille du chunk décompressé ne correspond pas**
   - Warning loggé mais continue
   - Validation après décompression

## Compatibilité

### Rétrocompatibilité

Le middleware détecte automatiquement si la requête est chunkée :

```typescript
if (!this.isChunkedRequest(req)) {
  return next(); // Requête normale, pas de traitement
}
```

Les anciennes requêtes (non-chunkées) continuent de fonctionner normalement.

### Migration Progressive

1. ✅ Nouveaux uploads utilisent automatiquement le chunking
2. ✅ Anciens clients non mis à jour continuent de fonctionner
3. ✅ Pas de breaking changes sur l'API

## Tests

### À Tester

- [ ] Upload de notes volumineuses (>10MB)
- [ ] Upload d'assets multiples
- [ ] Retry automatique en cas d'échec réseau
- [ ] Nettoyage des chunks expirés
- [ ] Performance de compression/décompression
- [ ] Métriques de progression

### Commandes Utiles

```bash
# Build
npm run build

# Tests
npm test

# Lancer le serveur en mode dev
npm run dev
```

## Dépendances Ajoutées

### Client (Obsidian)

- `nanoid` : Génération d'IDs uniques courts
- `pako` : Déjà inclus dans Obsidian API

### Serveur (Node)

- `pako` : Compression/décompression gzip
- `@types/pako` : Types TypeScript

## Maintenance

### Monitoring Recommandé

Surveiller ces métriques :

- Taux de compression moyen
- Nombre de chunks par upload
- Taux d'échec et de retry
- Durée moyenne des uploads
- Utilisation mémoire du chunk store

### Limites Actuelles

- **Stockage en mémoire** : Tous les chunks sont en RAM
  - Limitation : Ne pas dépasser 1GB total de chunks simultanés
  - Amélioration future : Stockage sur disque pour très gros uploads

- **Upload séquentiel** : Les chunks sont envoyés un par un
  - Limitation : Pas de parallélisation
  - Amélioration future : Upload concurrent de chunks

## Support

En cas de problème, vérifier :

1. Les logs côté client (`ChunkedUploadService`)
2. Les logs côté serveur (`ChunkedUploadMiddleware`)
3. La taille des chunks vs limite serveur
4. Le temps d'upload vs timeout serveur
