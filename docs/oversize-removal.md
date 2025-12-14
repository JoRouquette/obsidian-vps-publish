# Suppression de la logique "oversize"

## Contexte

Avant l'implémentation du **chunked upload**, le système utilisait une logique pour détecter et **exclure les items "oversized"** (notes ou assets trop volumineux pour tenir dans une seule requête HTTP).

Ces items étaient :

- Détectés par `batchByBytes()`
- Marqués dans un tableau `oversized[]`
- **Skipped** (jamais uploadés)
- Comptabilisés dans les stats (`notesOversized`, `assetsOversized`)

## Problème

Avec l'implémentation du **chunked upload** (compression + découpage en chunks), cette limitation n'a plus de raison d'être :

- ✅ Les notes JSON compressées peuvent maintenant être uploadées en plusieurs chunks
- ✅ Les assets binaires (images, vidéos, PDFs...) peuvent être uploadés en plusieurs chunks
- ✅ Il n'y a plus de limite théorique sur la taille individuelle d'un item

**Résultat** : La logique "oversize" était devenue obsolète et contre-productive.

## Changements apportés (PR #XXX)

### 1. **Simplification de `batchByBytes()`**

**Avant** :

```typescript
type BatchResult<T> = {
  batches: T[][];
  oversized: T[]; // Items exclus
};

function batchByBytes<T>(...): BatchResult<T> {
  // Si un item seul dépasse maxBytes → oversized
}
```

**Après** :

```typescript
function batchByBytes<T>(...): T[][] {
  // Si un item seul dépasse maxBytes → son propre batch (sera chunké)
}
```

**Comportement** :

- Items regroupés tant que la limite du batch n'est pas dépassée
- Item trop gros **placé dans son propre batch** (pas exclu)
- Le chunked upload gère automatiquement le découpage

### 2. **Suppression des champs `oversized` des stats**

**Fichier** : `libs/core-domain/src/lib/entities/publishing-stats.ts`

**Supprimé** :

```typescript
notesOversized: number; // ❌ Retiré
assetsOversized: number; // ❌ Retiré
```

**Raison** : Ces compteurs n'ont plus de sens puisque tous les items sont uploadés.

### 3. **Suppression du logging d'exclusion**

**Avant** (dans `notes-uploader.adapter.ts`) :

```typescript
if (oversized.length > 0) {
  this._logger.warn('Some notes will be skipped', { oversizedCount });
  this.advanceProgress(oversized.length); // Comptabiliser comme "traités"
}
```

**Après** :

```typescript
// Plus de warning, tous les items sont uploadés
```

### 4. **Mise à jour de `getBatchInfo()`**

**Avant** :

```typescript
getBatchInfo(): { batchCount: number; oversizedCount: number }
```

**Après** :

```typescript
getBatchInfo(): { batchCount: number }
```

### 5. **Adaptation de `main.ts`**

**Avant** :

```typescript
stats.notesOversized = notesBatchInfo.oversizedCount;
stats.notesUploaded = publishableCount - stats.notesOversized; // ❌
```

**Après** :

```typescript
stats.notesUploaded = publishableCount; // ✅ Tous uploadés
```

### 6. **Tests mis à jour**

**Fichier** : `apps/obsidian-vps-publish/src/_tests/batch-by-bytes.util.test.ts`

**Nouveau test** :

```typescript
it('met un élément trop volumineux dans son propre batch (sera chunké)', () => {
  const huge = 'x'.repeat(1024);
  const small = 'y';
  const maxBytes = 50;

  const result = batchByBytes([small, huge, small], maxBytes, wrap);

  expect(result.length).toBe(3);
  expect(result[0]).toEqual([small]);
  expect(result[1]).toEqual([huge]); // ✅ Dans son propre batch
  expect(result[2]).toEqual([small]);
});
```

## Impact utilisateur

### Avant cette PR

**Scénario** : Note avec très long contenu (ex: 5MB de JSON) ou asset vidéo de 50MB

**Résultat** :

```
⚠️ Some notes exceed maxBytesPerRequest and will be skipped
📊 Publishing Summary:
  • Notes:
    • Uploaded: 42
    • Oversized (skipped): 1  ❌
```

→ L'utilisateur devait **manuellement découper** ou **exclure** le contenu

### Après cette PR

**Même scénario** :

**Résultat** :

```
✅ Notes batch 1/3
✅ Notes batch 2/3 (chunked: 5 chunks)  ← Gros item
✅ Notes batch 3/3

📊 Publishing Summary:
  • Notes:
    • Uploaded: 43  ✅ Tous uploadés
```

→ **Transparent pour l'utilisateur**, tout est uploadé automatiquement

## Avantages

1. **Simplicité** : Code plus simple, moins de cas d'erreur à gérer
2. **Robustesse** : Plus d'exclusions silencieuses, tous les contenus sont publiés
3. **Expérience utilisateur** : Pas de surprise ("Pourquoi ma note n'est pas publiée ?")
4. **Maintenabilité** : Moins de branches conditionnelles, moins de stats à tracker

## Note technique

La limite `maxBytesPerRequest` reste **pertinente** pour le **batching** :

- Elle définit la taille maximale d'un **groupe d'items** dans une requête
- Elle permet d'optimiser le réseau (regrouper plusieurs petites notes ensemble)
- Mais elle ne **limite plus** la taille d'un item individuel

**Exemple** :

- `maxBytesPerRequest = 10MB`
- 10 notes de 500KB → 1 batch de 10 notes (5MB total)
- 1 note de 15MB → 1 batch de 1 note (sera chunkée en 3 chunks de ~5MB)

## Migration

### Pour les contributeurs

Si vous avez du code qui référence :

- `BatchResult<T>` → utilisez `T[][]` directement
- `.oversized` → supprimez cette logique
- `notesOversized` / `assetsOversized` → supprimez de vos tests/mocks

### Pour les utilisateurs

✅ **Aucune action requise** - les changements sont transparents et rétrocompatibles.

Les contenus précédemment "trop gros" seront maintenant uploadés automatiquement.

## Voir aussi

- [Chunked Upload System](./chunked-upload-system.md) - Documentation du système de découpage
- [Architecture](./architecture.md) - Vue d'ensemble du pipeline d'upload
