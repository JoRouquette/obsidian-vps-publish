# Background Throttle Analysis - Résultats de Test

**Date** : 13 février 2026  
**Test** : Commande `Publish (Debug: Background Throttle)`  
**Durée** : ~100 secondes  
**Vault** : ~2000 notes

---

## 📊 Résumé des Résultats

### ✅ Hypothèse Confirmée : Background Throttling Détecté

| Métrique                     | Valeur Mesurée  | Seuil Critique | Status                   |
| ---------------------------- | --------------- | -------------- | ------------------------ |
| **Stalls totaux**            | 42 heartbeats   | >0             | ⚠️ **CONFIRMÉ**          |
| **Drift moyen (background)** | 700-800ms       | 250ms attendu  | ⚠️ **3x ralentissement** |
| **Max drift (background)**   | 13,606ms (~14s) | <500ms         | 🔴 **CRITIQUE**          |
| **Max drift (foreground)**   | 47,693ms (~48s) | <500ms         | 🔴 **TRÈS CRITIQUE**     |
| **Stalls en hidden**         | 40/42 (95%)     | -              | ⚠️ Browser throttling    |
| **Stalls en visible**        | 2/42 (5%)       | -              | 🔴 Blocage CPU           |

---

## 🔍 Analyse Détaillée

### 1. Browser Throttling en Background (95% des stalls)

**Pattern observé** :

```
[14:01:00] drift: 752ms, state: hidden
[14:01:01] drift: 747ms, state: hidden
[14:01:02] drift: 752ms, state: hidden
...
[14:01:17] drift: 748ms, state: hidden
```

**Interprétation** :

- Timer de 250ms ralenti à ~1000ms (facteur 3-4x)
- **Cause** : Browser throttling natif (Chrome/Electron)
- **Contournable** : ❌ **NON** (limitation OS/browser intentionnelle pour économiser batterie)

**Documentation officielle** :

- Chrome 88+ : Timers ralentis en background ([source](https://developer.chrome.com/blog/timer-throttling-in-chrome-88/))
- Electron hérite de ce comportement

### 2. Pause Massive au Retour en Foreground (5% des stalls, impact majeur)

**Événement critique** :

```
[14:02:08] drift: 9752ms, state: hidden   ← Dernière pause normale en background
[14:02:56] drift: 47693ms, state: visible ← 48 SECONDES de blocage après retour focus
[14:03:00] drift: 1005ms, state: visible  ← Retour à la normale
```

**Analyse causale** :

1. L'utilisateur était en background ~60 secondes (14:01:58 → 14:02:56)
2. Pendant ce temps, les timers étaient throttlés (3-4x ralentis)
3. **Au retour en foreground** : Rattrapage massif de toutes les tâches accumulées
4. Event loop saturé → **48 secondes de blocage**

**Preuve** :

- Le drift de 48s apparaît **EN FOREGROUND** (`visibilityState: "visible"`)
- Ce n'est pas du throttling browser (timer aurait dû revenir à 250ms)
- C'est un **blocage CPU** causé par l'accumulation de tâches

### 3. Violation Browser Détectée

```
[Violation] 'setTimeout' handler took 165ms
[Violation] Forced reflow while executing JavaScript took 164ms
```

**Impact** :

- Blocage synchrone de 165ms
- Reflow forcé (manipulation DOM pendant exécution JS)
- Confirme le blocage de l'event loop

---

## ⚙️ Patches Implémentés

### Patch 1 : Notice UX (Avertissement Focus) ✅

**Fichiers modifiés** :

- `apps/obsidian-vps-publish/src/i18n/locales.ts` (traductions EN/FR)
- `apps/obsidian-vps-publish/src/main.ts` (affichage notice)

**Implémentation** :

```typescript
// Au démarrage de la publication
notificationAdapter.info(translate(t, 'notice.keepFocusWarning'));
```

**Traductions** :

- **EN** : `⚠️ Keep this window focused during publishing to avoid delays. Switching tabs or minimizing may slow down the process.`
- **FR** : `⚠️ Gardez cette fenêtre au premier plan pendant la publication pour éviter les ralentissements. Changer d'onglet ou minimiser peut ralentir le processus.`

**Objectif** : Informer l'utilisateur pour éviter le scénario de pause massive.

### Patch 2 : Yielding Renforcé (Anti-Accumulation) ✅

**Fichier modifié** :

- `apps/obsidian-vps-publish/src/main.ts` (ligne 1270)

**Changement** :

```typescript
// AVANT
yieldEveryN: 5, // Yield to UI every 5 notes

// APRÈS
yieldEveryN: 2, // Reduced from 5 to 2: more frequent yields to prevent task accumulation when returning from background
```

**Objectif** :

- Réduire l'accumulation de tâches en background
- Yield plus fréquent = moins de "dette" à rattraper au retour en foreground
- Impact CPU : +10% overhead théorique (yield chaque 2 notes au lieu de 5)
- Bénéfice : Réduit le risque de blocage de 48s → ~15-20s théorique

**Étape affectée** :

- **Parse Content** → Dataview processing (étape CPU-intensive)

---

## 📈 Résultats Attendus Après Patch

### Scénario Test : Perte de focus 60 secondes pendant publication

| Métrique                      | Avant Patch | Après Patch (estimé) | Amélioration                     |
| ----------------------------- | ----------- | -------------------- | -------------------------------- |
| **Drift moyen (background)**  | 750ms       | 750ms                | ❌ Inchangé (browser throttling) |
| **Max drift (background)**    | 13.6s       | 13.6s                | ❌ Inchangé (browser throttling) |
| **Blocage retour foreground** | 48s         | ~15-20s              | ✅ **60-70% réduction**          |
| **Violations setTimeout**     | Oui         | Réduit               | ✅ Moins fréquent                |

**Note** : Le throttling en background **reste** (non contournable), mais le blocage au retour est significativement réduit.

---

## 🎯 Recommandations Utilisateur

### Bonnes Pratiques

✅ **À FAIRE** :

- Garder la fenêtre Obsidian au premier plan pendant publication
- Ne pas minimiser ou changer d'onglet
- Si interruption nécessaire : attendre la fin de publication

❌ **À ÉVITER** :

- Alt+Tab vers autre application pendant publication
- Minimiser Obsidian pendant upload
- Mettre en veille l'ordinateur pendant publication

### Configuration Avancée

Pour les vaults très volumineux (>5000 notes), ajuster dans `data.json` :

```json
{
  "maxConcurrentDataviewNotes": 3,
  "maxConcurrentUploads": 2
}
```

**Impact** :

- Concurrence réduite = moins de tâches simultanées
- Yielding plus efficace (moins de "dette")
- Ralentit légèrement la publication (~10-20%), mais plus stable

---

## 🧪 Validation du Patch

### Test de Régression

**Scénario 1 : Foreground (pas de perte de focus)**

- ✅ Vérifier : Event Loop p95 lag <50ms
- ✅ Vérifier : Aucun stall en `visible`
- ✅ Vérifier : Durée totale publication ≤ +10% (overhead yielding)

**Scénario 2 : Background 30 secondes**

- ✅ Vérifier : Drift retour foreground <20s (vs 48s avant)
- ✅ Vérifier : Pas de violations setTimeout après retour
- ⚠️ Accepté : Drift moyen background ~750ms (non contournable)

### Commande de Test

```bash
# Build avec patch
npm run package:plugin

# Test dans Obsidian
1. Installer plugin
2. Lancer : "Publish (Debug: Background Throttle)"
3. À t+10s : Alt+Tab vers autre app (attendre 30s)
4. À t+40s : Revenir sur Obsidian
5. Observer Console logs
```

**Logs attendus après patch** :

```
[BackgroundThrottle] drift: 750ms, state: hidden  ← OK (throttling)
[BackgroundThrottle] drift: 15000ms, state: visible ← Amélioré (vs 48s)
```

---

## 📝 Limitations Connues

### 1. Browser Throttling (Non Contournable)

**Cause** : Politique de gestion d'énergie du browser/OS  
**Impact** : Ralentissement 3-4x en background  
**Mitigation** : ❌ Aucune technique — informer utilisateur (Notice)

**Références** :

- [Chrome Timer Throttling](https://developer.chrome.com/blog/timer-throttling-in-chrome-88/)
- [Electron Background Behavior](https://www.electronjs.org/docs/latest/api/browser-window#background-throttling)

### 2. Overhead Yielding

**Cause** : `yieldEveryN: 2` augmente fréquence de `setTimeout(..., 0)`  
**Impact** : +5-10% durée totale publication (foreground uniquement)  
**Trade-off** : Acceptable (stabilité > performance brute)

### 3. Accumulation Résiduelle

**Cause** : Même avec `yieldEveryN: 2`, un léger backlog reste en background très long (>2 minutes)  
**Impact** : Blocage résiduel de 10-20s au retour (vs 48s avant)  
**Mitigation maximale** : Utiliser Worker threads (complexe, nécessite refactor architectural)

---

## 🔄 Prochaines Étapes (Si Nécessaire)

### Si blocage retour foreground >20s persiste

**Option 1 : Yielding encore plus agressif**

```typescript
yieldEveryN: 1, // Yield CHAQUE note (impact perf +20%)
```

**Option 2 : Délai artificiel après visibilitychange**

```typescript
document.addEventListener('visibilitychange', async () => {
  if (document.visibilityState === 'visible') {
    await new Promise((r) => setTimeout(r, 100)); // Pause 100ms
    // Permet au browser de stabiliser l'event loop
  }
});
```

**Option 3 : Worker threads (long terme)**

- Parsing Markdown dans Web Worker
- Communication via `postMessage`
- Complexité : ⚠️ Élevée (nécessite refactor)
- Gain : 🎯 Blocage foreground éliminé

### Si throttling background inacceptable

**Dernière option nucléaire : Keep-alive ping**

```typescript
// Force le browser à considérer l'onglet comme "actif"
setInterval(() => {
  console.log('[KeepAlive]'); // Activité minimale
}, 1000);
```

⚠️ **Déconseillé** : Contourne intentionnellement les politiques d'économie d'énergie du browser.

---

## ✅ Conclusion

**Problème identifié** : Background throttling + accumulation de tâches  
**Cause racine** : Browser throttling (non contournable) + blocage CPU au retour (contournable)  
**Patches appliqués** :

1. ✅ Notice UX (avertir utilisateur)
2. ✅ Yielding renforcé (`yieldEveryN: 5 → 2`)

**Résultat attendu** :

- Blocage retour foreground réduit de **48s → 15-20s** (60-70% amélioration)
- Throttling background reste (limitation browser)
- UX améliorée (utilisateur informé)

**Test de validation** : Reproduire scénario avec background 30-60s et mesurer drift retour foreground.
