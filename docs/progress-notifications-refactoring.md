# Refonte de la gestion du Progress et des Notifications

## 🎯 Objectif

Améliorer la visibilité du flux d'upload en introduisant un système de progress par étape avec notifications claires à chaque phase du pipeline, du parsing du vault jusqu'à la finalisation de la session.

---

## 🏗️ Architecture de la solution

### Nouveaux composants (Domain Layer)

#### 1. **`ProgressStep`** (`libs/core-domain/src/lib/entities/progress-step.ts`)

Entité représentant une étape du pipeline avec son état et son avancement.

**Énumérations** :

- `ProgressStepId` : identifiants des étapes (`PARSE_VAULT`, `UPLOAD_NOTES`, `UPLOAD_ASSETS`, `FINALIZE_SESSION`)
- `ProgressStepStatus` : états possibles (`PENDING`, `IN_PROGRESS`, `COMPLETED`, `FAILED`, `SKIPPED`)

**Métadonnées** :

```typescript
interface ProgressStepMetadata {
  id: ProgressStepId;
  label: string;
  status: ProgressStepStatus;
  total: number; // Nombre total d'items à traiter
  current: number; // Nombre d'items traités
  errorMessage?: string;
  startedAt?: string; // ISO 8601
  completedAt?: string;
}
```

#### 2. **`NotificationPort`** (`libs/core-domain/src/lib/ports/notification-port.ts`)

Port pour envoyer des notifications à l'utilisateur (info, success, warning, error).

```typescript
interface NotificationPort {
  notify(data: NotificationData): void;
  info(message: string, duration?: number): void;
  success(message: string, duration?: number): void;
  warning(message: string, duration?: number): void;
  error(message: string, details?: string, duration?: number): void;
}
```

#### 3. **`StepProgressManagerPort`** (`libs/core-domain/src/lib/ports/step-progress-manager-port.ts`)

Port pour gérer le progress et les notifications par étape.

**Méthodes principales** :

- `startStep(stepId, label, total)` : démarre une étape (notification de début)
- `advanceStep(stepId, step)` : avance le progress d'une étape
- `completeStep(stepId)` : marque une étape comme terminée (notification de succès)
- `failStep(stepId, errorMessage)` : marque une étape comme échouée (notification d'erreur)
- `skipStep(stepId, reason)` : ignore une étape (ex. : pas d'assets à uploader)
- `getGlobalPercentage()` : calcule le pourcentage global de progression

---

### Nouveaux adaptateurs (Infrastructure Layer)

#### 1. **`NoticeNotificationAdapter`** (`apps/obsidian-vps-publish/src/lib/infra/notice-notification.adapter.ts`)

Implémentation du `NotificationPort` pour Obsidian Notice.

- Préfixes visuels selon le type : ✅ (success), ⚠️ (warning), ❌ (error)
- Durées par défaut : 4s pour info/success, 6s pour warning, persistant pour error

#### 2. **`StepProgressManagerAdapter`** (`apps/obsidian-vps-publish/src/lib/infra/step-progress-manager.adapter.ts`)

Orchestrateur central qui combine :

- **`ProgressPort`** (barre globale)
- **`NotificationPort`** (notifications par étape)
- **`StepMessages`** (traductions i18n)

**Responsabilités** :

1. Maintenir l'état de chaque étape
2. Déclencher les notifications au bon moment (start, success, error)
3. Mettre à jour le progress global
4. Notifier les callbacks enregistrés

#### 3. **`createStepMessages`** (`apps/obsidian-vps-publish/src/lib/infra/step-messages.factory.ts`)

Factory pour créer les messages d'étapes à partir des traductions i18n.

---

### Traductions i18n

Ajout dans `apps/obsidian-vps-publish/src/i18n/locales.ts` :

```typescript
progress: {
  parseVault: {
    start: 'Parsing vault content...',
    success: 'Vault parsed successfully',
    error: 'Failed to parse vault',
  },
  uploadNotes: {
    start: 'Uploading notes...',
    success: 'Notes uploaded successfully',
    error: 'Failed to upload notes',
  },
  uploadAssets: {
    start: 'Uploading assets...',
    success: 'Assets uploaded successfully',
    error: 'Failed to upload assets',
    skip: 'No assets to upload',
  },
  finalizeSession: {
    start: 'Finalizing publication...',
    success: 'Publication finalized',
    error: 'Failed to finalize publication',
  },
}
```

Traductions disponibles en **anglais** et **français**.

---

## 📊 Flux d'exécution refactorisé

### Avant (problèmes identifiés)

1. ❌ Le progress ne démarrait **qu'après le parsing du vault** (après `startSession`)
2. ❌ Pas de notifications intermédiaires (uniquement succès/échec global)
3. ❌ Pas de visibilité sur les étapes en cours
4. ❌ Gestion d'erreur monolithique (un seul catch global)

### Après (nouveau flux)

```typescript
async publishToSiteAsync() {
  // 1. Init progress + notifications AVANT tout traitement
  const stepProgressManager = new StepProgressManagerAdapter(
    new NoticeProgressAdapter('Publishing to VPS'),
    new NoticeNotificationAdapter(),
    createStepMessages(t.plugin)
  );

  // 2. PARSE_VAULT - Parsing du vault (sans étape formelle car synchrone)
  const vault = new ObsidianVaultAdapter(...);
  const notes = await vault.collectFromFolder(...);
  const publishables = await parseContentHandler.handle(notes);

  // 3. Démarrage du progress GLOBAL dès maintenant
  totalProgressAdapter.start(publishableCount + assetsPlanned);

  // 4. SESSION START
  sessionClient = new SessionApiClient(...);
  const started = await sessionClient.startSession(...);

  // 5. UPLOAD_NOTES
  stepProgressManager.startStep(ProgressStepId.UPLOAD_NOTES, 'Uploading notes', publishableCount);
  await notesUploader.upload(publishables);
  stepProgressManager.completeStep(ProgressStepId.UPLOAD_NOTES);

  // 6. UPLOAD_ASSETS (ou skip si aucun asset)
  if (notesWithAssets.length > 0) {
    stepProgressManager.startStep(ProgressStepId.UPLOAD_ASSETS, 'Uploading assets', assetsPlanned);
    await assetsUploader.upload(resolvedAssets);
    stepProgressManager.completeStep(ProgressStepId.UPLOAD_ASSETS);
  } else {
    stepProgressManager.skipStep(ProgressStepId.UPLOAD_ASSETS, 'No assets to upload');
  }

  // 7. FINALIZE_SESSION
  stepProgressManager.startStep(ProgressStepId.FINALIZE_SESSION, 'Finalizing', 1);
  await sessionClient.finishSession(...);
  stepProgressManager.completeStep(ProgressStepId.FINALIZE_SESSION);

  // 8. Terminer le progress global
  totalProgressAdapter.finish();

  // Gestion d'erreur : marquer l'étape en cours comme échouée
  // + abort session + notification d'erreur
}
```

---

## 🔧 Modifications des Uploaders

Les `NotesUploaderAdapter` et `AssetsUploaderAdapter` acceptent désormais :

- Soit un `ProgressPort` (pour rétrocompatibilité)
- Soit un `StepProgressManagerPort` (pour le nouveau système)

**Helper method** :

```typescript
private advanceProgress(step: number): void {
  if (!this.progress) return;

  if ('advanceStep' in this.progress) {
    // StepProgressManagerPort
    this.progress.advanceStep(ProgressStepId.UPLOAD_NOTES, step);
  } else {
    // ProgressPort (legacy)
    this.progress.advance(step);
  }
}
```

---

## ✅ Bénéfices de la refonte

1. **Visibilité améliorée** : chaque étape a sa propre notification (début, succès, erreur)
2. **Progress dès le départ** : la barre de progression démarre au tout début du flux
3. **Gestion d'erreur granulaire** : on sait quelle étape a échoué et pourquoi
4. **Extensibilité** : facile d'ajouter de nouvelles étapes (ex. : `VALIDATE_VAULT`, `OPTIMIZE_IMAGES`)
5. **Testabilité** : chaque composant est isolé et testable indépendamment
6. **i18n** : messages traduits en anglais et français
7. **Rétrocompatibilité** : les uploaders fonctionnent toujours avec l'ancien `ProgressPort`

---

## 🧪 Tests et validation

- ✅ Tous les tests passent (`npm run test`)
- ✅ Build successful (`npm run build`)
- ✅ Linting clean (`npm run lint:fix`)
- ✅ Respect des règles Clean Architecture (layer boundaries)

---

## 📝 Checklist finale

- [x] Entités et ports créés dans `core-domain`
- [x] Adapters créés dans `apps/obsidian-vps-publish/src/lib/infra`
- [x] Traductions i18n ajoutées (EN + FR)
- [x] Refactorisation de `publishToSiteAsync`
- [x] Mise à jour des uploaders (progress polymorphe)
- [x] Gestion d'erreur améliorée (failStep + abort session)
- [x] Tests validés
- [x] Documentation créée

---

## 🚀 Prochaines étapes possibles

1. **Ajout d'une étape PARSE_VAULT formelle** : notifier le début/fin du parsing
2. **Progress détaillé par batch** : afficher "Batch 1/3" dans les notifications
3. **Logs structurés** : inclure les timestamps et pourcentages dans les logs
4. **Retry automatique** : en cas d'échec d'une étape, proposer de réessayer
5. **UI améliorée** : modal avec barre de progression détaillée (si Obsidian API le permet)

---

## 📚 Fichiers modifiés/créés

### Domain Layer

- ✨ `libs/core-domain/src/lib/entities/progress-step.ts`
- ✨ `libs/core-domain/src/lib/ports/notification-port.ts`
- ✨ `libs/core-domain/src/lib/ports/step-progress-manager-port.ts`
- 🔧 `libs/core-domain/src/lib/entities/index.ts`
- 🔧 `libs/core-domain/src/lib/ports/index.ts`

### Infrastructure Layer

- ✨ `apps/obsidian-vps-publish/src/lib/infra/notice-notification.adapter.ts`
- ✨ `apps/obsidian-vps-publish/src/lib/infra/step-progress-manager.adapter.ts`
- ✨ `apps/obsidian-vps-publish/src/lib/infra/step-messages.factory.ts`
- 🔧 `apps/obsidian-vps-publish/src/lib/infra/notes-uploader.adapter.ts`
- 🔧 `apps/obsidian-vps-publish/src/lib/infra/assets-uploader.adapter.ts`

### Plugin Main

- 🔧 `apps/obsidian-vps-publish/src/main.ts`

### i18n

- 🔧 `apps/obsidian-vps-publish/src/i18n/locales.ts`

**Légende** : ✨ Nouveau fichier | 🔧 Modifié
