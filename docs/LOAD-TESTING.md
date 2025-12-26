# Load Testing avec Artillery - Un Seul Utilisateur

Ce guide explique comment exécuter des tests de montée en charge progressifs simulant **un seul utilisateur** qui envoie des publications de plus en plus volumineuses.

## Concept

Contrairement aux tests multi-utilisateurs, ce test simule un utilisateur unique qui :

- Commence avec de petites publications (10-20 notes)
- Augmente progressivement la taille des publications (50, 100, 200 notes)
- Atteint un pic avec de très grosses publications (500-1000 notes)
- Revient à une charge normale

**Objectif** : Mesurer la capacité du système à gérer des publications volumineuses d'un seul utilisateur, détecter les seuils de backpressure, et vérifier la récupération.

## Installation

### Prérequis

- Node.js 18+
- API backend en cours d'exécution (`npm run start node`)
- Clé API valide

### Installer Artillery

```bash
# Global (recommandé)
npm install -g artillery@latest

# Ou local au projet
npm install --save-dev artillery
```

## Configuration

### 1. Créer le fichier d'environnement

```bash
cp .env.artillery.example .env.artillery
```

### 2. Éditer `.env.artillery`

```env
API_KEY=your-actual-api-key-here
```

**⚠️ CRITIQUE** :

- L'API_KEY est **OBLIGATOIRE** - sans elle, toutes les requêtes retourneront 401 (Unauthorized)
- Utilisez la même clé que dans votre backend (variable `API_KEY` dans `.env.dev`)
- Ne commitez JAMAIS `.env.artillery` (déjà dans `.gitignore`)

### 3. Vérifier que le backend est lancé

```bash
# Terminal 1: Démarrer le backend
npm run start node

# Vérifier que l'API répond
curl -H "x-api-key: your-api-key" http://localhost:3000/api/health
# Doit retourner 200 OK
```

## Exécution des Tests

### ⚠️ Problème Courant : 401 Unauthorized

**Symptôme** : Tous les logs backend montrent `status:401` pour `/api/session/start`

**Cause** : L'API_KEY n'est pas chargée depuis `.env.artillery`

**Solution** : Utiliser les scripts npm qui chargent automatiquement `.env.artillery` :

```bash
# ✅ CORRECT - Utilise --dotenv .env.artillery automatiquement
npm run loadtest

# ✅ CORRECT - Avec rapport HTML auto-ouvert
npm run loadtest:report

# ❌ INCORRECT - Ne charge pas .env.artillery
artillery run artillery-load-test.yml
```

### Test Rapide (Dev)

```bash
# Charge légère pour dev (1 minute)
artillery quick --count 10 --num 100 http://localhost:3000/api/health
```

### Test Complet (Montée en Charge)

```bash
# Via npm script (recommandé - charge .env.artillery automatiquement)
npm run loadtest

# Avec rapport HTML
npm run loadtest:report
```

### Test Manuel (si nécessaire)

```bash
# Charge explicitement .env.artillery
artillery run artillery-load-test.yml --dotenv .env.artillery

# Avec rapport HTML
artillery run --output report.json artillery-load-test.yml --dotenv .env.artillery && \
  artillery report report.json --output report.html && \
  npx open-cli report.html
```

### Test avec Target Custom

```bash
# Tester un serveur distant
API_KEY=your-key artillery run --target https://api.example.com artillery-load-test.yml
```

## Phases du Test

Le test suit 5 phases avec **1 seul utilisateur virtuel**, mais des **publications de plus en plus volumineuses** :

```
Phase 1: Warmup (60s)
  └─ 10-20 notes par publication
  └─ 5-10 assets
  └─ 1 chunk par type
  └─ Objectif: Établir baseline

Phase 2: Ramp Up (2min)
  └─ 50-100 notes par publication
  └─ 20-40 assets
  └─ 3-5 chunks pour notes, 2-4 pour assets
  └─ Objectif: Montée progressive

Phase 3: Sustained Load (3min)
  └─ 200-300 notes par publication
  └─ 50-100 assets
  └─ 10-15 chunks pour notes, 5-10 pour assets
  └─ Objectif: Charge soutenue significative

Phase 4: Peak Load (2min)
  └─ 500-1000 notes par publication 🔥
  └─ 200-400 assets
  └─ 25-50 chunks pour notes, 20-40 pour assets
  └─ Objectif: Tester limites, déclencher backpressure

Phase 5: Cool Down (1min)
  └─ 50-100 notes par publication
  └─ 20-40 assets
  └─ Retour à charge normale
  └─ Objectif: Vérifier récupération
```

**Durée totale** : ~9 minutes  
**Utilisateurs simultanés** : 1 seul  
**Progression** : Volume des publications (notes + assets)

## Scénario Testé

### Single User - Progressive Load (100% du trafic)

Simule un workflow complet de publication avec volume croissant :

1. **Calcul dynamique** : Détermine le nombre de notes/assets selon la phase
2. **`POST /api/session/start`** : Démarrer session avec `notesPlanned` et `assetsPlanned`
3. **`POST /api/session/{id}/notes/upload`** (boucle) : Upload notes en plusieurs chunks si nécessaire
4. **`POST /api/session/{id}/assets/upload`** (boucle) : Upload assets en plusieurs chunks
5. **`POST /api/session/{id}/finish`** : Finaliser session
6. **Pause** : 3-7 secondes avant prochaine publication

### 2. Health Check (20% du trafic)

```
GET /api/health
```

### 3. Ping API (10% du trafic)

```
GET /api/ping
```

## Métriques Collectées

### Métriques Standard Artillery

- **http.request_rate** : Requêtes/sec
- **http.response_time** : Latence (min/max/median/p95/p99)
- **http.responses** : Distribution codes HTTP (200, 429, 500, etc.)
- **http.codes.200** : Succès
- **http.codes.429** : Backpressure déclenché (NORMAL sous forte charge)
- **vusers.created** : Utilisateurs virtuels créés
- **vusers.completed** : Scénarios complétés

### Métriques Personnalisées (artillery-processor.js)

- **batch.notesCount** : Nombre de notes par publication (histogram)
- **batch.assetsCount** : Nombre d'assets par publication (histogram)
- **batch.totalChunks** : Total de chunks envoyés par session
- **backpressure.triggered** : Nombre de 429 reçus
- **backpressure.retryAfterMs** : Distribution des délais de retry
- **session.started** : Sessions démarrées avec succès
- **session.finished** : Sessions finalisées avec succès
- **upload.success** : Uploads réussis
- **upload.backpressure** : Uploads rejetés (429)
- **upload.failed** : Uploads échoués (autres erreurs)
- **request.slow** : Requêtes > 2s
- **scenario.duration** : Durée des scénarios complets

**Logs en temps réel** :

```
[BATCH SIZE] Phase: Warmup | Notes: 15 | Assets: 7 | Chunks: 2
[BATCH SIZE] Phase: Peak | Notes: 847 | Assets: 312 | Chunks: 74
[BACKPRESSURE] /api/session/abc123/notes/upload returned 429 - retry after 5000ms
[SLOW REQUEST] /api/session/abc123/finish took 3245ms
```

## Interpréter les Résultats

### Rapport Console

```
Summary report @ 14:32:15(+0100)
──────────────────────────────────────────
  Scenarios launched:  90  ← UN SEUL utilisateur, 90 publications
  Scenarios completed: 88
  Requests completed:  2340  ← Notes + assets + start/finish
  Mean response/sec:   26.14
  Response time (msec):
    min: 45
    max: 8230  ← Plus lent (grosses publications)
    median: 189
    p95: 1420
    p99: 4180
  Scenario counts:
    Single User - Progressive Load: 88 (100%)
  Codes:
    200: 2187
    429: 142 ← Backpressure déclenché en phase Peak (NORMAL)
    500: 11  ← Erreurs serveur (À INVESTIGUER)
  Custom metrics:
    batch.notesCount (p50): 127, (p95): 784, (p99): 978
    batch.assetsCount (p50): 51, (p95): 328, (p99): 389
    batch.totalChunks: 1847 chunks total
```

**Interprétation** :

- **1 seul utilisateur** a effectué 88 publications complètes
- Les publications sont passées de ~15 notes (phase 1) à ~800 notes (phase 4)
- Le backpressure s'est déclenché 142 fois, principalement en phase Peak (ATTENDU)

### Indicateurs de Santé

✅ **SUCCÈS** si :

- Taux d'erreurs 500 < 1%
- p95 < 2000ms (2s)
- p99 < 5000ms (5s)
- 429 uniquement pendant phase "Peak Load"
- Serveur récupère après Cool Down

⚠️ **ATTENTION** si :

- p95 > 2000ms
- 429 dès phase "Sustained Load"
- Taux d'erreurs 500 > 1%

❌ **ÉCHEC** si :

- p95 > 5000ms
- Taux d'erreurs 500 > 5%
- Serveur ne répond plus (timeouts)
- 429 dès phase "Warmup"

### 429 (Backpressure) : Normal ou Problème ?

**Normal** :

- Apparaît uniquement en phase "Peak Load" (50 users/sec)
- `retryAfterMs` < 10s
- Taux 429 < 10% du total
- Logs montrent `[BACKPRESSURE]` warnings

**Problème** :

- 429 dès phase "Sustained Load" (10 users/sec)
- `retryAfterMs` > 30s
- Taux 429 > 20%
- Serveur ne récupère pas après Cool Down

**Action** : Ajuster seuils dans [backpressure.middleware.ts](../apps/node/src/infra/http/express/middleware/backpressure.middleware.ts) :

```typescript
{
  maxEventLoopLagMs: 200,  // Augmenter si 429 trop fréquents
  maxMemoryUsageMB: 500,   // Augmenter si serveur a plus de RAM
  maxActiveRequests: 50,   // Augmenter si CPU supporte plus
}
```

## Rapport HTML

Le rapport HTML (`report.html`) contient :

- 📊 Graphiques latence vs temps
- 📈 Throughput (req/sec) vs temps
- 🎯 Distribution codes HTTP
- 📉 Percentiles (p50, p95, p99)
- ⏱️ Timeline détaillée

**Exemple de graphique attendu** :

```
Latency (ms) over time (un seul utilisateur, volume croissant)
  ↑
5000│                                    ╱╲  ← Peak: 500-1000 notes
4000│                                ╱╲╱  ╲
3000│                            ╱╲╱      ╲
2000│                        ╱╲╱          ╲╱╲
1000│              ╱╲    ╱╲╱
 500│      ────╱╲──  ──╱                    ──── ← Cool down
   0└──────┴────┴────┴────┴────┴────┴────┴────┴──→
      Warmup  Ramp  Sustained  Peak    Cool
      10-20  50-100  200-300  500-1K  50-100 notes
                              ↑
                         Backpressure
                         triggered
```

**Note** : La latence augmente avec le volume de données, pas avec le nombre d'utilisateurs.

### ⚠️ Erreur Critique : "All requests return 401 Unauthorized"

**Symptôme dans les logs backend** :

```
{"level":"info","message":"[PERF] Request completed","method":"POST","url":"/api/session/start","status":401,...}
{"level":"info","message":"[PERF] Request completed","method":"POST","url":"/api/session/start","status":401,...}
{"level":"info","message":"[PERF] Request completed","method":"POST","url":"/api/session/start","status":401,...}
```

**Cause** : L'API_KEY n'est pas transmise ou est incorrecte

**Solutions** :

1. **Vérifier que `.env.artillery` existe et contient la bonne clé** :

```bash
# Vérifier le contenu
cat .env.artillery
# Doit afficher: API_KEY=votre-clé-ici

# Copier depuis l'exemple si manquant
cp .env.artillery.example .env.artillery
# Éditer avec votre vraie clé
```

2. **Utiliser les scripts npm (recommandé)** :

```bash
# ✅ CORRECT - Charge automatiquement .env.artillery
npm run loadtest

# ❌ INCORRECT - Ne charge PAS .env.artillery
artillery run artillery-load-test.yml
```

3. **Vérifier que la clé correspond au backend** :

```bash
# Comparer les deux fichiers
grep API_KEY .env.artillery
grep API_KEY .env.dev
# Les deux doivent avoir la MÊME valeur
```

4. **Test manuel de l'API_KEY** :

```bash
# Remplacer YOUR_KEY par votre vraie clé
curl -H "x-api-key: YOUR_KEY" \
     -H "Content-Type: application/json" \
     -d '{"notesPlanned":5,"assetsPlanned":2}' \
     http://localhost:3000/api/session/start

# Doit retourner 200 avec {"sessionId":"..."}
# Si 401, votre API_KEY est incorrecte
```

5. **Tester Artillery avec variable inline** :

```bash
# Test direct avec clé en dur (pour debug uniquement)
API_KEY=your-actual-key artillery run artillery-load-test.yml --dotenv .env.artillery

# Si ça marche, le problème est dans .env.artillery
```

### Erreur: "connect ECONNREFUSED"

**Cause** : Backend pas démarré

**Solution** :

```bash
npm run start node
# Attendre "Server listening on port 3000"
```

### Erreur: "401 Unauthorized" (avec backend qui répond)

**Cause** : API_KEY invalide ou mal formatée dans `.env.artillery`

**Solution** :

```bash
# Vérifier .env.artillery (pas d'espaces, pas de guillemets)
cat .env.artillery
# ✅ Correct: API_KEY=abc123xyz
# ❌ Incorrect: API_KEY = "abc123xyz"
# ❌ Incorrect: API_KEY='abc123xyz'

# Vérifier backend .env
cat .env.dev  # ou .env.prod

# Les deux API_KEY doivent être identiques
```

### Erreur: "Too many 500 errors"

**Cause** : Serveur sous-dimensionné ou bug

**Solution** :

1. Vérifier logs backend : `npm run start node`
2. Réduire charge : éditer `artillery-load-test.yml` → réduire `arrivalRate`
3. Profiler avec Chrome DevTools

### Backpressure Immédiat (429 dès Warmup)

**Cause** : Seuils backpressure trop stricts OU problème de performance

**Solution 1 - Assouplir les seuils** :

```typescript
// apps/node/src/infra/http/express/middleware/backpressure.middleware.ts
{
  maxEventLoopLagMs: 500,  // Assouplir
  maxMemoryUsageMB: 1000,
  maxActiveRequests: 100,
}
```

**Solution 2 - Vérifier les optimisations** :

```bash
# Valider que toutes les optimisations sont actives
npm run perf:validate:strict
```

### Publications Échouent Systématiquement en Phase Peak

**Cause** : Volume trop élevé pour les capacités actuelles

**Actions** :

1. Réduire le pic : Éditer `artillery-processor.js` → Phase 4 à 300-500 notes au lieu de 500-1000
2. Augmenter concurrence plugin : `maxConcurrentUploads` dans settings Obsidian
3. Optimiser serveur : Plus de RAM, CPU plus rapide

## Scripts NPM

Ajouter à `package.json` :

```json
{
  "scripts": {
    "loadtest": "export $(cat .env.artillery | xargs) && artillery run artillery-load-test.yml",
    "loadtest:report": "export $(cat .env.artillery | xargs) && artillery run --output report.json artillery-load-test.yml && artillery report report.json --output report.html && open report.html"
  }
}
```

Usage :

```bash
npm run loadtest
npm run loadtest:report
```

## Intégration CI (Optionnel)

Ajouter à `.github/workflows/load-test.yml` :

```yaml
name: Load Test

on:
  workflow_dispatch: # Manuel
  schedule:
    - cron: '0 2 * * 0' # Chaque dimanche à 2h

jobs:
  load-test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4

      - name: Setup Node.js
        uses: actions/setup-node@v4
        with:
          node-version: '20'

      - name: Install dependencies
        run: npm ci

      - name: Start API server
        run: |
          npm run start node &
          sleep 10  # Attendre démarrage
        env:
          API_KEY: ${{ secrets.API_KEY }}

      - name: Install Artillery
        run: npm install -g artillery

      - name: Run load test
        run: |
          artillery run --output report.json artillery-load-test.yml
        env:
          API_KEY: ${{ secrets.API_KEY }}

      - name: Generate report
        if: always()
        run: artillery report report.json --output report.html

      - name: Upload report
        if: always()
        uses: actions/upload-artifact@v4
        with:
          name: load-test-report
          path: report.html
```

## Références

- [Artillery Documentation](https://www.artillery.io/docs)
- [Artillery Best Practices](https://www.artillery.io/docs/guides/guides/test-script-reference)
- [Performance Testing Guide](./api/performance-testing.md)
- [Performance Enhancements](./api/performance-enhancements.md)
- [Backpressure Middleware](../apps/node/src/infra/http/express/middleware/backpressure.middleware.ts)

## Métriques Cibles (Un Seul Utilisateur)

| Métrique             | Warmup (10-20) | Sustained (200-300) | Peak (500-1000) | Acceptable  |
| -------------------- | -------------- | ------------------- | --------------- | ----------- |
| p95 latency          | < 200ms        | < 1000ms            | < 3000ms        | < 5000ms    |
| p99 latency          | < 500ms        | < 2000ms            | < 8000ms        | < 15000ms   |
| Throughput           | > 5 req/s      | > 20 req/s          | > 15 req/s      | > 10 req/s  |
| Error rate (500)     | < 0.1%         | < 1%                | < 3%            | < 5%        |
| Backpressure (429)   | 0%             | < 2%                | < 15%           | < 30%       |
| Session success rate | 100%           | > 98%               | > 90%           | > 80%       |
| Memory growth        | Stable         | < 50MB/min          | < 100MB/min     | < 200MB/min |
| Event loop lag       | < 50ms         | < 150ms             | < 300ms         | < 500ms     |

**Note** : Ces cibles sont pour un seul utilisateur avec volume croissant. Les latences augmentent naturellement avec le volume de données à traiter.

## Prochaines Étapes

| Métrique           | Cible          | Acceptable  | Critique   |
| ------------------ | -------------- | ----------- | ---------- |
| p95 latency        | < 500ms        | < 2000ms    | > 5000ms   |
| p99 latency        | < 1000ms       | < 5000ms    | > 10000ms  |
| Throughput         | > 100 req/s    | > 50 req/s  | < 10 req/s |
| Error rate (500)   | < 0.1%         | < 1%        | > 5%       |
| Backpressure (429) | 0% (sustained) | < 5% (peak) | > 20%      |

## Prochaines Étapes

1. **Baseline** : Exécuter test initial pour établir métriques de référence
2. **Optimiser** : Si métriques insuffisantes, ajuster code/config
3. **Automatiser** : Intégrer dans CI pour détection régression
4. **Monitorer** : Collecter métriques en production (Prometheus/Grafana)
