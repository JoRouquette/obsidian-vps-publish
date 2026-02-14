# Background Throttle Detection - Test Guide

## Objectif

Ce guide permet de **vérifier factuellement** si le plugin Obsidian subit des ralentissements ou pauses lorsque l'utilisateur perd le focus (onglet en arrière-plan, fenêtre minimisée, etc.).

## Préalables

1. **Build du plugin** :

   ```bash
   npm run build:plugin
   # ou
   npm run package:plugin
   ```

2. **Installation** : Copier `dist/vps-publish/` vers `<vault>/.obsidian/plugins/vps-publish/`

3. **Recharger** : Dans Obsidian, Settings → Community plugins → Reload, ou `Ctrl+R`

## Nouvelle commande de test

Une commande spéciale a été ajoutée pour faciliter les tests :

**Commande** : `Publish (Debug: Background Throttle)`  
**ID** : `vps-publish-debug`

### Ce qu'elle fait

1. Active **temporairement** les flags suivants :
   - `enablePerformanceDebug: true`
   - `enableBackgroundThrottleDebug: true`

2. Affiche un Notice instructif pendant 8 secondes :

   > 🔍 Debug mode enabled: Background throttle monitoring active.  
   > Switch tabs or minimize window during publishing to test.

3. Lance la publication normale

4. Restaure les flags originaux à la fin

### Avantage

Pas besoin de modifier `data.json` manuellement — utilisez simplement cette commande pour tester.

## Scénario de test reproductible

### Étape 1 : Préparation

1. Ouvrir Obsidian avec le vault de test
2. Ouvrir DevTools (Ctrl+Shift+I) → onglet Console
3. Configurer un VPS (ou localhost pour test local)

### Étape 2 : Lancement du test

1. **Lancer** la commande : `Publish (Debug: Background Throttle)`
   - Palette de commandes (Ctrl+P) → chercher "Background Throttle"
   - Ou configuration d'un raccourci clavier

2. **Attendre** 2-3 secondes le début de la publication (observe le Notice)

### Étape 3 : Simulation de perte de focus

Pendant que la publication est **en cours**, effectuer l'une de ces actions :

- **Alt+Tab** vers une autre application (naviguer quelques secondes)
- **Minimiser** la fenêtre Obsidian (attendre 5-10 secondes)
- **Changer d'onglet** si Obsidian est dans un navigateur (rare mais possible dans certains setups)
- **Revenir** à Obsidian après un délai

### Étape 4 : Analyse des logs

À la fin de la publication, consulter **Console DevTools** (filtre : `ObsidianVpsPublish`).

#### Logs à rechercher

**1. Background Throttle Monitor Summary** :

```
🔍 === Background Throttle Monitor Summary ===
Total heartbeats: 120
Visibility events: 4

Time in foreground: 8.50s (70.8%)
Time in background: 3.50s (29.2%)

Max heartbeat drift: 1245.60ms
Avg heartbeat drift: 12.35ms
Stalled heartbeats (>500ms): 2

Visibility Events Timeline:
  [+0.00s] visible (visible)
  [+3.20s] blur (visible)
  [+3.21s] hidden (hidden)
  [+7.85s] visible (visible)
  [+7.86s] focus (visible)

⚠️ WARNING: 2 stalled heartbeats detected
   This indicates the event loop was significantly delayed,
   possibly due to background throttling or CPU blocking.

⚠️ WARNING: Very large heartbeat drift detected (1245.60ms)
   Publishing may have been severely throttled or paused.

ℹ️ INFO: Publishing ran 3.5s in background.
   Check if background throttling affected performance.
```

**2. Event Loop Lag Statistics** :

```
⏱️ Event Loop Lag Statistics {
  samples: 120,
  minLagMs: "0.05",
  maxLagMs: "145.30",
  avgLagMs: "8.25",
  p50LagMs: "5.10",
  p95LagMs: "32.45",
  p99LagMs: "98.60"
}
```

**3. Notice utilisateur** (si debug activé) :

Le Notice de fin affichera :

```
✅ Publication completed!
Notes: 25/25 uploaded
Assets: 12/12 uploaded

🔍 Performance Debug:
Total: 12.35s
Top steps: parse-content: 5.20s, upload-notes: 3.10s, ...
Event loop p95 lag: 32ms

🔍 Background Throttle Debug:
Stalled heartbeats: 2
Max drift: 1245ms
Time in background: 3.5s
```

## Interprétation des résultats

### Scénario A : Pas de pause détectée ✅

**Indicateurs** :

- `Stalled heartbeats: 0`
- `Max heartbeat drift: <100ms`
- `Time in background: 0s` (ou très faible)

**Conclusion** : Le plugin ne subit **pas** de throttling background significatif.

### Scénario B : Pause détectée ⚠️

**Indicateurs** :

- `Stalled heartbeats: >0`
- `Max heartbeat drift: >500ms` (souvent >1000ms)
- `Time in background: >2s`
- Trous visibles dans la timeline des heartbeats (drift élevé coïncide avec événements "hidden"/"blur")

**Conclusion** : Le plugin **subit** du throttling background. Causes possibles :

1. **Browser/OS throttling** : timers ralentis en arrière-plan (navigateur ≥ Chrome 88, Firefox ≥ 88)
2. **Blocage event loop** : opérations CPU lourdes qui retardent les timers
3. **combinaison** des deux

### Comment différencier throttling vs blocage CPU ?

- **Throttling** : Les trous apparaissent **juste après** les événements `blur`/`hidden`, persistent pendant toute la durée en arrière-plan
- **Blocage CPU** : Les trous peuvent apparaître **même en foreground**, corrélés avec les étapes `parse-content` / `dataview-processing`

Vérifier aussi **Event Loop Lag p95** :

- `<50ms` → Event loop sain, pas de blocage CPU significatif
- `>100ms` → Blocage CPU présent (indépendant du throttling)

## Activation manuelle du flag (alternative)

Si vous préférez ne pas utiliser la commande debug :

1. Ouvrir `<vault>/.obsidian/plugins/vps-publish/data.json`
2. Ajouter/modifier :
   ```json
   {
     "enablePerformanceDebug": true,
     "enableBackgroundThrottleDebug": true,
     ...
   }
   ```
3. Recharger le plugin ou redémarrer Obsidian
4. Lancer la commande normale `Publish to VPS`

## Prochaines étapes (après analyse)

### Si pause détectée → Patch de yielding renforcé

Les étapes actuelles utilisent déjà `YieldScheduler` avec `yieldEveryN: 5` et `yieldEveryMs: 50`.

**Options d'amélioration** :

1. **Réduire yieldEveryN** à 3 ou même 1 pour les étapes CPU-intensives
2. **Ajouter des yields forcés** avant/après chaque batch d'upload
3. **Utiliser `setImmediate`** si disponible (Electron) au lieu de `setTimeout(..., 0)`
4. **Worker threads** pour parsing lourd (nécessite évaluation faisabilité Obsidian/Electron)

### Si pas de pause détectée → Chercher ailleurs

- Vérifier les performances réseau (uploads)
- Analyser les étapes identifiées dans `Performance Debug` (top steps)
- Vérifier la concurrence (`maxConcurrentDataviewNotes`, etc.)

## Commandes Nx pour build/test

```bash
# Build plugin uniquement
npx nx run obsidian-vps-publish:build

# Build + package (ready for Obsidian)
npx nx run obsidian-vps-publish:package

# Watch mode (dev)
npx nx run obsidian-vps-publish:dev

# Lint
npm run lint

# Tests unitaires
npm run test
```

## Fichiers modifiés (pour référence)

- `apps/obsidian-vps-publish/src/lib/infra/background-throttle-monitor.adapter.ts` (nouveau)
- `apps/obsidian-vps-publish/src/lib/settings/plugin-settings.type.ts` (flag ajouté)
- `apps/obsidian-vps-publish/src/main.ts` (intégration moniteur + commande debug)

## Troubleshooting

### Le moniteur ne démarre pas

- Vérifier que le flag `enableBackgroundThrottleDebug` est bien à `true`
- Vérifier que les imports sont corrects (build sans erreur)
- Vérifier Console DevTools pour erreurs TypeScript/runtime

### Pas de logs dans Console

- Ouvrir DevTools **avant** de lancer la commande
- Filtrer la console par `ObsidianVpsPublish` ou `BackgroundThrottle`
- Vérifier `logLevel` dans settings (doit être au moins `info`)

### Notice de fin n'affiche pas les stats debug

- Vérifier que `enablePerformanceDebug` OU `enableBackgroundThrottleDebug` est activé
- Si utilisation de la commande debug, vérifier que la Notice d'instruction apparaît au début

---

**Note** : Ce test est **non-destructif** et peut être répété autant de fois que nécessaire. Les flags de debug n'affectent **pas** le comportement fonctionnel de la publication, uniquement l'instrumentation et les logs.
