# Configuration rapide : Plugin Obsidian → Localhost

Ce guide résumé te permet de configurer rapidement le plugin pour développer en local.

## ⚡ Configuration Express (5 minutes)

### 1️⃣ Lance le backend

```bash
npm run start node
```

Backend disponible sur **http://localhost:3000**

### 2️⃣ Build et installe le plugin

```bash
npm run package:plugin
```

Puis **copie** ou **symlink** `dist/vps-publish/` vers `{ton-vault}/.obsidian/plugins/vps-publish/`

### 3️⃣ Configure dans Obsidian

**Settings → VPS Publish → Add VPS**

```
Name:       Localhost
VPS URL:    http://localhost:3000
API Key:    devkeylocal
```

**Ajoute un dossier** :

```
Folder:     Notes/
Route:      /
```

### 4️⃣ Test

- Commande : **"Test VPS Connection"** → notification de succès ✅
- Commande : **"Publish full vault"** → contenu uploadé 🚀

### 5️⃣ Vérifie

- http://localhost:3000/content/\_manifest.json
- http://localhost:3000/content/{ta-note}.html

---

## 📋 Checklist de vérification

Avant de publier, vérifie :

- [ ] Backend lancé (`npm run start node`)
- [ ] Port 3000 libre
- [ ] Plugin activé dans Obsidian
- [ ] VPS "Localhost" configuré avec `http://localhost:3000`
- [ ] API Key = `devkeylocal`
- [ ] Au moins un dossier configuré
- [ ] Test de connexion réussi

---

## 🔧 Paramètres `.env`

L'application charge automatiquement les variables depuis le fichier `.env` :

```dotenv
NODE_ENV=development
PORT=3000
CONTENT_ROOT=./tmp/site-content
ASSETS_ROOT=./tmp/assets
UI_ROOT=./tmp/ui
API_KEY=devkeylocal
LOGGER_LEVEL=debug
ALLOWED_ORIGINS=*,app://obsidian,http://localhost:4200,http://localhost:3000
BASE_URL=http://localhost:3000
```

> **Important** : Le fichier `.env` est automatiquement créé lors du setup. Si absent, copier depuis `.env.dev` : `cp .env.dev .env`

---

## 🐛 Debug rapide

### Plugin ne se connecte pas ?

```bash
# Teste manuellement
curl http://localhost:3000/health

# Si erreur "API_KEY is not set", vérifie :
cat .env | grep API_KEY
# Doit afficher : API_KEY=devkeylocal

# Si absent, copie depuis .env.dev :
cp .env.dev .env

# Redémarre le backend
npm run start node
```

### Rien ne s'upload ?

1. Vérifie que le dossier est configuré dans le VPS
2. Active les logs : Settings → Log Level → Debug
3. Ouvre la console Obsidian : `Ctrl+Shift+I`

### Upload lent ?

Settings → Performance :

- Max Concurrent Uploads: **5**
- Max Concurrent File Reads: **10**

---

## 🔄 Workflow recommandé

```
┌─────────────────────┐
│   Modifie code      │
│   (apps/node, etc)  │
└──────────┬──────────┘
           │
           ▼
┌─────────────────────┐
│  npm run start node │ ← Redémarre auto (watch)
└──────────┬──────────┘
           │
           ▼
┌─────────────────────┐
│  Test dans Obsidian │
│  Publish → Vérifie  │
└─────────────────────┘
```

Pour le plugin :

```
┌─────────────────────┐
│   Modifie plugin    │
│ (apps/obsidian-...  │
└──────────┬──────────┘
           │
           ▼
┌─────────────────────┐
│ npm run dev:plugin  │ ← Watch mode (optionnel)
└──────────┬──────────┘
           │
           ▼
┌─────────────────────┐
│ Obsidian: Ctrl+R    │ ← Reload
└─────────────────────┘
```

---

## 📁 Structure test recommandée

Crée un vault séparé pour le dev :

```
DevVault/
├── .obsidian/
│   └── plugins/
│       └── vps-publish/    # Symlink vers dist/vps-publish/
├── Articles/
│   ├── Index.md
│   └── Mon article.md
├── _assets/
│   └── image.png
└── README.md
```

Configuration VPS :

- Dossier : `Articles/` → Route : `/articles`
- Assets folder : `_assets/`

---

## 🌐 URLs de dev

| Service  | URL                                           | Description          |
| -------- | --------------------------------------------- | -------------------- |
| Backend  | http://localhost:3000                         | API + contenu        |
| Angular  | http://localhost:4200                         | Frontend (optionnel) |
| Health   | http://localhost:3000/health                  | Status backend       |
| Manifest | http://localhost:3000/content/\_manifest.json | Catalogue            |
| Config   | http://localhost:3000/public-config           | Métadonnées          |

---

## 💡 Astuces

### Symlink Windows

```cmd
REM En admin
mklink /D "C:\mon-vault\.obsidian\plugins\vps-publish" "C:\projets\obsidian-vps-publish\dist\vps-publish"
```

### Watch complet

Terminal 1 :

```bash
npm run dev:plugin
```

Terminal 2 :

```bash
npm run start node
```

Terminal 3 (optionnel) :

```bash
npm run start site
```

### Tester sans Obsidian

```bash
# Démarre une session
curl -X POST http://localhost:3000/api/session/start \
  -H "x-api-key: devkeylocal" \
  -H "Content-Type: application/json" \
  -d '{"noteCount": 1, "assetCount": 0}'

# Récupère le sessionId de la réponse, puis upload une note
curl -X POST http://localhost:3000/api/session/{sessionId}/notes/upload \
  -H "x-api-key: devkeylocal" \
  -H "Content-Type: application/json" \
  -d '[{"title":"Test","content":"# Test\n\nContenu test","frontmatter":{"tags":["test"]}}]'

# Finalise
curl -X POST http://localhost:3000/api/session/{sessionId}/finish \
  -H "x-api-key: devkeylocal"
```

---

Pour plus de détails, voir **[LOCAL_DEV.md](./LOCAL_DEV.md)** 📖
