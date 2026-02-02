# Quick Start Artillery Load Testing

## Prérequis

1. Backend en cours d'exécution (`npm run start node`)
2. Artillery installé globalement (`npm install -g artillery`)

## Setup en 3 Étapes

### 1️⃣ Copier la configuration

```bash
cp .env.artillery.example .env.artillery
```

### 2️⃣ Éditer `.env.artillery` avec votre API_KEY

```bash
# Afficher la clé depuis .env.dev
grep API_KEY .env.dev

# Éditer .env.artillery et coller la MÊME valeur
# ⚠️ Pas d'espaces, pas de guillemets !
# ✅ Correct: API_KEY=abc123xyz
# ❌ Incorrect: API_KEY = "abc123xyz"
```

### 3️⃣ Lancer le test

```bash
# ✅ CORRECT - Charge automatiquement .env.artillery
npm run loadtest

# Test avec rapport HTML auto-ouvert
npm run loadtest:report

# ❌ INCORRECT - Ne charge PAS .env.artillery
artillery run artillery-load-test.yml
```

## ✅ Test Réussi

Dans le terminal Artillery, vous verrez :

```
http.codes.200: .............. 2340  ← Succès !
http.codes.429: .............. 45    ← Backpressure (normal sous charge)
```

## 🚨 Troubleshooting : Tous les 401 Unauthorized

### Symptômes

**Dans le terminal Artillery** :

```
http.codes.401: .............. 2340  ← Problème d'authentification
```

**Dans les logs backend** :

```
status:401 ... url:"/api/session/start"
status:401 ... url:"/api/session/start"
status:401 ... url:"/api/session/start"
```

### Cause

L'API_KEY n'est pas chargée depuis `.env.artillery`

### Solution

#### 1. Vérifier que le fichier existe

```bash
# Doit afficher le contenu du fichier
cat .env.artillery

# Doit afficher (avec votre vraie clé) :
# API_KEY=votre-clé-ici
```

#### 2. Vérifier le format

```bash
# ✅ CORRECT
API_KEY=abc123xyz

# ❌ INCORRECT - Espaces autour du =
API_KEY = abc123xyz

# ❌ INCORRECT - Guillemets
API_KEY="abc123xyz"

# ❌ INCORRECT - Ligne commentée
#API_KEY=abc123xyz
```

#### 3. Tester l'API_KEY manuellement

```bash
# Remplacer YOUR_KEY par votre vraie clé
curl -H "x-api-key: YOUR_KEY" \
     -H "Content-Type: application/json" \
     -d '{"notesPlanned":5,"assetsPlanned":2}' \
     http://localhost:3000/api/session/start

# ✅ Si 200 : API_KEY correcte
# ❌ Si 401 : API_KEY incorrecte ou manquante
```

#### 4. Utiliser les scripts npm (pas artillery directement)

```bash
# ✅ CORRECT - Les scripts npm chargent .env.artillery automatiquement
npm run loadtest
npm run loadtest:report

# ❌ INCORRECT - Artillery ne lit PAS .env.artillery sans --dotenv
artillery run artillery-load-test.yml
```

## 📊 Interpréter les Résultats

- **p95 < 2000ms** : ✅ Performance acceptable
- **p95 > 5000ms** : ⚠️ Lenteur, vérifier logs backend
- **429 responses** : ✅ Normal en phase Peak (backpressure fonctionne)
- **500 responses** : ❌ Erreurs serveur, vérifier logs

## 📝 Notes Importantes

- **Ne jamais committer `.env.artillery`** (déjà dans `.gitignore`)
- L'API_KEY doit être **identique** dans `.env.artillery` et `.env.dev`
- Artillery charge `.env.artillery` grâce à l'option `--dotenv` dans les scripts npm
- Sans `--dotenv`, Artillery ne lit QUE les variables d'environnement système

## 📖 Documentation Complète

- [Load Testing Artillery](./load-testing-artillery.md) - Guide complet avec scénarios détaillés
- [Load Testing](./load-testing.md) - Tests de charge multi-scénarios
