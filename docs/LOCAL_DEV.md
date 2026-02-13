# Guide de Développement Local (sans Docker)

Ce guide explique comment développer le projet en local sur Windows sans avoir à gérer Docker.

## Prérequis

- **Node.js 22+** et npm
- Git Bash ou un terminal compatible (WSL, PowerShell, etc.)

## Installation

```bash
# Cloner le projet si ce n'est pas déjà fait
git clone https://github.com/JoRouquette/obsidian-vps-publish.git
cd obsidian-vps-publish

# Installer les dépendances
npm install --no-audit --no-fund
```

## Configuration

Le projet utilise deux fichiers de configuration d'environnement :

- **`.env`** - Fichier principal chargé automatiquement par l'application Node
- **`.env.dev`** - Fichier de référence (identique à `.env` pour le dev local)

Les deux fichiers contiennent les mêmes variables pour le développement local :

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

> **Note** : Les fichiers `.env` et `.env.dev` sont ignorés par git (dans `.gitignore`). Ils sont créés automatiquement lors du setup initial.

Les dossiers `tmp/*` seront créés automatiquement au premier lancement.

## Démarrage

### Option 1 : Tout en un (recommandé pour commencer)

Lance le backend (qui sert aussi le frontend buildé) :

```bash
npm run start node
```

Accéder à l'application : **http://localhost:3000**

### Option 2 : Backend + Frontend séparés (hot-reload Angular)

Cette option est plus pratique pour développer le frontend car elle permet le hot-reload d'Angular.

> **Note** : Le SSR (Server-Side Rendering) est désactivé en mode développement pour éviter les erreurs de configuration. Le site fonctionne en mode SPA (Single Page Application) uniquement lors du développement local.

**Terminal 1 - Backend :**

```bash
npm run start node
```

**Terminal 2 - Frontend Angular :**

```bash
npm run start site
```

Accéder à l'application : **http://localhost:4200**

> Le frontend Angular utilise un proxy (configuré dans `apps/site/proxy.conf.json`) pour rediriger les appels `/content`, `/assets`, `/api`, `/public-config` vers le backend sur le port 3000.

### Option 3 : Utiliser les tasks VS Code

Si tu utilises VS Code, tu peux utiliser les tasks prédéfinies :

1. `Ctrl+Shift+B` → Sélectionner **"Launch all"**
2. Cela lance à la fois le backend (port 3000) et le frontend (port 4200)

## Scripts utiles

```bash
# Build tout le projet
npm run build

# Linter
npm run lint
npm run lint:fix

# Tests
npm run test

# Format du code
npm run format

# Build du plugin Obsidian
npm run build:plugin
npm run package:plugin
```

## Structure des dossiers de développement local

Après le premier lancement, tu verras ces dossiers créés :

```
tmp/
  ├── site-content/    # Contenu HTML rendu + _manifest.json
  ├── assets/          # Assets uploadés (images, fichiers)
  └── ui/              # Frontend Angular buildé (si backend sert le frontend)
```

Ces dossiers sont dans `.gitignore` et sont uniquement pour le développement local.

## Tester l'upload de contenu

Pour tester la fonctionnalité d'upload (simulation du plugin Obsidian) :

1. Lance le backend : `npm run start node`
2. Utilise un outil comme Postman, cURL ou le plugin Obsidian configuré en local
3. L'API key de dev est : `devkeylocal`

Exemple avec cURL :

```bash
# Créer une session
curl -X POST http://localhost:3000/api/session/start \
  -H "x-api-key: devkeylocal" \
  -H "Content-Type: application/json" \
  -d '{"noteCount": 1, "assetCount": 0}'

# (La réponse contient un sessionId à utiliser pour les étapes suivantes)
```

## Configuration du plugin Obsidian pour localhost

Pour tester le plugin Obsidian complet en développement local, tu dois le configurer pour qu'il cible ton backend localhost.

### 1. Build et installer le plugin

```bash
# Build le plugin
npm run package:plugin

# Copier ou créer un lien symbolique vers ton vault Obsidian
# Windows (cmd en admin):
mklink /D "C:\chemin\vers\ton-vault\.obsidian\plugins\vps-publish" "C:\Users\jonathan.rouquette\_projects\obsidian-vps-publish\dist\vps-publish"

# Ou copie manuelle:
# Copier le dossier dist/vps-publish/ vers ton-vault/.obsidian/plugins/vps-publish/
```

### 2. Activer le plugin dans Obsidian

1. Ouvrir Obsidian
2. Aller dans **Settings** → **Community plugins**
3. Désactiver le "Restricted mode" si nécessaire
4. Cliquer sur **"Reload plugins"** ou redémarrer Obsidian
5. Activer le plugin **"VPS Publish"**

### 3. Configurer le VPS localhost

1. Dans Obsidian, ouvrir **Settings** → **VPS Publish**
2. Dans la section **"VPS Configuration"**, cliquer sur **"Add VPS"**
3. Configurer comme suit :

   | Paramètre   | Valeur                              |
   | ----------- | ----------------------------------- |
   | **Name**    | `Localhost` (ou n'importe quel nom) |
   | **VPS URL** | `http://localhost:3000`             |
   | **API Key** | `devkeylocal`                       |

4. Configurer au moins un dossier à publier :
   - Cliquer sur **"Add folder"** dans la configuration du VPS
   - Sélectionner un dossier de ton vault (ex: `Notes/`)
   - Définir la route (ex: `/notes`)

5. Cliquer sur **"Save"** ou fermer les settings (sauvegarde automatique)

### 4. Tester la connexion

1. Dans le ruban latéral d'Obsidian, chercher l'icône du plugin VPS Publish
2. Utiliser la commande **"Test VPS Connection"** (Ctrl+P → chercher "test")
3. Tu devrais voir une notification de succès si le backend tourne sur localhost:3000

### 5. Publier du contenu

**Option A : Publier tout le vault**

- Commande : **"Publish full vault"** (Ctrl+P)
- Sélectionner le VPS "Localhost" dans le sélecteur
- Le contenu sera envoyé à `http://localhost:3000`

**Option B : Publier la note courante**

- Ouvrir une note
- Commande : **"Publish current note"**
- La note sera envoyée uniquement si elle fait partie d'un dossier configuré

### 6. Visualiser le résultat

Après publication :

- **Backend direct** : http://localhost:3000 (liste les routes disponibles)
- **Frontend Angular** : http://localhost:4200 (si tu as lancé `npm run start site`)
- **Contenu rendu** : http://localhost:3000/content/ ou http://localhost:4200/content/

### Configuration avancée du plugin

#### Fichiers à ignorer

Dans les settings du VPS, tu peux ajouter des règles d'ignorance :

- `**/_templates/**` - Ignore tous les fichiers dans `_templates/`
- `**/brouillon-*.md` - Ignore les notes commençant par "brouillon-"
- `assets/temp/**` - Ignore le dossier temp dans assets

#### Performance

Dans les settings généraux du plugin :

- **Max Concurrent Dataview Notes** : 5 (par défaut, augmente si ton PC le supporte)
- **Max Concurrent Uploads** : 3 (conservateur, augmente pour aller plus vite)
- **Max Concurrent File Reads** : 5

#### Debug

Active les logs détaillés pour voir ce qui se passe :

1. Settings → VPS Publish → **Log Level** : `Debug`
2. Ouvrir la console d'Obsidian : `Ctrl+Shift+I`
3. Onglet **Console** pour voir les logs du plugin

### Hot-reload du plugin pendant le développement

Pour éviter de recharger Obsidian à chaque modification du plugin :

```bash
# Terminal dédié - Watch mode
npm run dev:plugin

# Après chaque modification, dans Obsidian :
# Ctrl+P → "Reload app without saving" (ou Ctrl+R)
```

### Structure de test recommandée

Crée un vault de test avec cette structure :

```
TestVault/
├── .obsidian/
│   └── plugins/
│       └── vps-publish/    # Symlink vers dist/vps-publish/
├── Notes/
│   ├── Index.md
│   ├── Article 1.md
│   └── Article 2.md
├── _assets/
│   └── image.png
└── _templates/             # Ignoré
```

Configure le VPS dans Obsidian :

- Dossier : `Notes/` → Route : `/`
- Dossier assets : `_assets/`

### Exemple complet de workflow

1. **Lance le backend** : `npm run start node` (port 3000)
2. **Lance le frontend** (optionnel) : `npm run start site` (port 4200)
3. **Ouvre Obsidian** avec ton vault de test
4. **Publie du contenu** via le plugin
5. **Vérifie dans le browser** :
   - http://localhost:3000/content/\_manifest.json (voir le contenu publié)
   - http://localhost:4200 (voir le site Angular)
6. **Modifie une note** dans Obsidian
7. **Republie** et vois les changements immédiatement

### URLs importantes en mode dev

| Endpoint        | URL                                           | Description          |
| --------------- | --------------------------------------------- | -------------------- |
| Health check    | http://localhost:3000/health                  | Santé du backend     |
| Config publique | http://localhost:3000/public-config           | Métadonnées du site  |
| Manifest        | http://localhost:3000/content/\_manifest.json | Catalogue du contenu |
| Contenu HTML    | http://localhost:3000/content/{slug}.html     | Page rendue          |
| Assets          | http://localhost:3000/assets/{file}           | Fichiers uploadés    |
| Site Angular    | http://localhost:4200                         | Interface principale |

## Troubleshooting

### Le backend ne démarre pas

**Symptômes** : Erreur au démarrage, port déjà utilisé, ou erreur de configuration

**Solutions** :

1. **Vérifier que le port 3000 n'est pas déjà utilisé** :

   ```bash
   # Windows
   netstat -ano | findstr :3000

   # Si le port est utilisé, tuer le processus ou changer le PORT dans .env
   ```

   **Cause** : Le backend ne trouve pas l'API key dans les variables d'environnement.

**Solution** :

1. **Vérifier que le fichier `.env` existe** :

   ```bash
   cat .env | grep API_KEY
   # Doit afficher : API_KEY=devkeylocal
   ```

2. **Si le fichier n'existe pas, le créer** :

   ```bash
   cp .env.dev .env
   ```

3. **Redémarrer le backend** :

   ```bash
   # Ctrl+C pour arrêter, puis :
   npm run start node
   ```

4. **Vérifier les logs** au démarrage :
   ```
   Server listening on port 3000
   ```

> **Note technique** : Depuis la version actuelle, l'application charge automatiquement les variables depuis `.env` (ou `.env.dev` si `NODE_ENV=development`) grâce au package `dotenv`.# Si absent, copier depuis .env.dev :
> cp .env.dev .env

````

3. **Vérifier que l'API_KEY est définie** :
```bash
cat .env | grep API_KEY
# Doit afficher : API_KEY=devkeylocal
````

4. **Rebuild l'application** :
   ```bash
   npm run build:node
   npm run start node
   ```

### Le frontend ne trouve pas l'API

- S'assurer que le backend tourne sur le port 3000
- Vérifier que le fichier `apps/site/proxy.conf.json` existe
- Redémarrer le dev server Angular

### Erreur "API_KEY is not set"

Le backend nécessite une API key. Elle est définie dans `.env.dev` :

```dotenv
API_KEY=devkeylocal
```

### Erreur de permissions sur les dossiers tmp/

Sur Windows, les dossiers sont créés avec les permissions par défaut. Si tu as des problèmes, supprime le dossier `tmp/` et relance l'application.

### Le plugin ne se connecte pas au backend

**Symptômes** : Erreur de connexion, timeout, ou "Failed to connect"

**Solutions** :

1. **Vérifier que le backend tourne** :

   ```bash
   curl http://localhost:3000/health
   # Devrait retourner : {"status":"ok"}
   ```

2. **Vérifier l'URL du VPS** :
   - Dans Obsidian Settings → VPS Publish
   - L'URL doit être **exactement** : `http://localhost:3000`
   - Pas de `/` à la fin
   - Pas de `https://`

3. **Vérifier l'API Key** :
   - Doit correspondre à celle dans `.env.dev` : `devkeylocal`

4. **Vérifier les logs** :
   - Backend : regarde le terminal où tourne `npm run start node`
   - Plugin : `Ctrl+Shift+I` dans Obsidian, onglet Console

5. **CORS** :
   - Vérifie dans `.env.dev` que `ALLOWED_ORIGINS` contient `app://obsidian`
   - Redémarre le backend après modification

### Le plugin upload mais rien n'apparaît

1. **Vérifier le manifest** :

   ```bash
   curl http://localhost:3000/content/_manifest.json
   ```

   - Devrait contenir les notes publiées

2. **Vérifier que le dossier est configuré** :
   - Settings → VPS Publish → Configuration VPS
   - Au moins un dossier doit être configuré avec une route

3. **Vérifier les règles d'ignorance** :
   - Peut-être que tes notes sont ignorées par une règle
   - Regarde les logs du plugin en mode Debug

### Erreur "Session not found"

Le backend a été redémarré pendant un upload. Solution :

- Réessayer la publication
- Les sessions sont en mémoire pendant le dev

### Le hot-reload ne fonctionne pas

Pour que les modifications du plugin soient prises en compte :

1. Sauvegarder le fichier modifié
2. `npm run build:plugin` ou laisser tourner `npm run dev:plugin` (watch mode)
3. Dans Obsidian : `Ctrl+R` (Reload app)

### Erreur SSR / Bootstrap Context

**Symptômes** : `NG0401: Missing Platform` ou erreur liée à `bootstrapApplication` sur le serveur

**Cause** : Le SSR (Server-Side Rendering) est activé mais mal configuré pour le développement.

**Solution** : Le SSR est désactivé par défaut en mode développement dans `apps/site/project.json` :

```json
{
  "build": {
    "configurations": {
      "development": {
        "ssr": false
      }
    }
  }
}
```

Si tu veux réactiver le SSR en développement :

1. Retirer `"ssr": false` de la configuration ci-dessus
2. Utiliser `npm run serve-ssr site` à la place de `npm run start site`

### Performances lentes pendant le développement

### Performances lentes pendant le développement

Si la publication est lente :

1. **Réduire la taille du vault de test** : moins de notes = plus rapide
2. **Augmenter la concurrence** (Settings → VPS Publish) :
   - Max Concurrent Uploads : 5-10
   - Max Concurrent File Reads : 10
3. **Désactiver le debug** : Log Level → Info ou Warn

## Passer de dev local à Docker

Pour revenir au développement avec Docker si besoin :

```bash
# Utiliser les tasks VS Code
"Docker: dev up"

# Ou manuellement
docker compose -f docker-compose.yml -f docker-compose.dev.yml up --build
```

Dans ce cas, le fichier `.env.dev` sera monté dans le container et les chemins Linux (`/content`, etc.) seront utilisés.

## Note sur les performances

Le développement local (sans Docker) est généralement **plus rapide** que dans un container pour :

- Le hot-reload du code
- Les tests
- Le linter

Les seules raisons d'utiliser Docker en développement :

- Tester l'image Docker finale
- Reproduire exactement l'environnement de production
- Tester les volumes et les mappings de ports
