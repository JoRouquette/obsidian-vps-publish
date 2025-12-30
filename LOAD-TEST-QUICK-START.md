# Quick Start Artillery Load Testing

## Prérequis

1. Backend en cours d'exécution
2. Artillery installé globalement (`npm install -g artillery`)

## Setup en 3 Étapes

### 1️⃣ Copier la configuration

```bash
cp .env.artillery.example .env.artillery
```

### 2️⃣ Éditer `.env.artillery` avec votre API_KEY

```bash
# Copier la clé depuis .env.dev
grep API_KEY .env.dev

# Éditer .env.artillery et remplacer "your-api-key-here"
# Par exemple : API_KEY=devkeylocal
```

### 3️⃣ Lancer le test

```bash
# Test simple (console uniquement)
npm run loadtest

# Test avec rapport HTML auto-ouvert
npm run loadtest:report
```

## ✅ Test Réussi

Dans le terminal Artillery, vous verrez :

```
http.codes.200: .............. 2340  ← Succès !
http.codes.429: .............. 45    ← Backpressure (normal sous charge)
```

## ❌ Problème : Tous les 401

**Symptôme dans le terminal Artillery** :

```
http.codes.401: .............. 2340  ← Problème d'authentification
```

**Solution** : Voir [.env.artillery.README.md](.env.artillery.README.md)

## 📊 Interpréter les Résultats

- **p95 < 2000ms** : ✅ Performance acceptable
- **p95 > 5000ms** : ⚠️ Lenteur, vérifier logs backend
- **429 responses** : ✅ Normal en phase Peak (backpressure fonctionne)
- **500 responses** : ❌ Erreurs serveur, vérifier logs

## 📖 Documentation Complète

- [docs/LOAD-TESTING.md](docs/LOAD-TESTING.md) - Guide complet
- [.env.artillery.README.md](.env.artillery.README.md) - Troubleshooting 401
