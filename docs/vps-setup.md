# Déployer sur un VPS (guide de référence)

> **English version:** [docs/en/vps-setup.md](./en/vps-setup.md)

## Objectif

Déployer la stack auto-hébergée (API + site) sur un VPS, prête à recevoir les publications du plugin Obsidian **Publish to VPS**. Ce guide décrit l'architecture de référence utilisée par le déploiement d'origine du projet : un nginx natif en frontal TLS, le conteneur applicatif lié à la loopback, et des mises à jour automatiques via Watchtower.

**Audience** : ops / self-hosters. Pour le contenu de l'image et ses variables, voir [Docker](./docker.md).

## Quand l'utiliser

- Première installation du serveur qui recevra vos publications Obsidian.
- Remise à plat d'un déploiement existant sur un pattern éprouvé.

## Concepts clés — architecture de référence

```
Internet
  │  443 (TLS Let's Encrypt) / 80 (redirection 301)
  ▼
nginx natif (vhost publish.example.com)
  │  proxy_pass → 127.0.0.1:3000 (loopback uniquement)
  ▼
Conteneur obsidian-vps-publish  (API Node + SPA Angular)
  ├── volume ./content  → /content   (HTML rendu + manifestes)
  └── volume ./assets   → /assets    (images et fichiers publiés)
```

Principes :

- **Le conteneur n'expose jamais de port public** : il écoute sur `127.0.0.1:3000`, seul nginx est exposé (80/443). Aucun port applicatif à ouvrir dans le pare-feu.
- **Un dossier par application** sous `/srv/apps/<app>/` (compose + volumes côte à côte).
- **TLS terminé par nginx** avec des certificats Let's Encrypt renouvelés par certbot.
- **Mises à jour d'image automatiques** (optionnel) avec Watchtower.

## Prérequis

- Un VPS Linux (testé sur Ubuntu, fonctionne sur Debian) avec accès SSH et sudo.
- Un nom de domaine avec un enregistrement `A` (ex. `publish.example.com`) pointant vers l'IP du VPS.
- Docker + le plugin compose, nginx et certbot installés :

  ```bash
  sudo apt update
  sudo apt install -y docker.io docker-compose-v2 nginx certbot python3-certbot-nginx
  ```

## Configuration

### 1. Arborescence et clé d'API

```bash
sudo mkdir -p /srv/apps/personal-publish/{content,assets}
cd /srv/apps/personal-publish
# Générer une clé d'API forte (à reporter dans le plugin Obsidian) :
openssl rand -base64 32
```

### 2. `docker-compose.yml`

`/srv/apps/personal-publish/docker-compose.yml` (adapté de [`docker-compose.prod.yml`](../docker-compose.prod.yml) — voir ce fichier pour la liste complète des variables) :

```yaml
services:
  personal-publish:
    image: jorouquette/obsidian-vps-publish:latest
    pull_policy: always
    restart: unless-stopped
    ports:
      - '127.0.0.1:3000:3000' # loopback uniquement — jamais 0.0.0.0
    environment:
      NODE_ENV: 'production'
      PORT: '3000'
      CONTENT_ROOT: /content
      ASSETS_ROOT: /assets
      UI_ROOT: /ui
      API_KEY: 'REMPLACER_PAR_LA_CLE_GENEREE'
      BASE_URL: https://publish.example.com
      ALLOWED_ORIGINS: https://publish.example.com,app://obsidian.md
      SITE_NAME: 'Mon site'
      AUTHOR: 'Votre nom'
      LOGGER_LEVEL: 'warn'
    volumes:
      - ./content:/content
      - ./assets:/assets
```

```bash
sudo docker compose up -d
curl -fsS http://127.0.0.1:3000/health   # doit répondre avant de continuer
```

### 3. vhost nginx

`/etc/nginx/sites-available/publish.example.com` :

```nginx
server {
  listen 443 ssl;
  http2 on;

  server_name publish.example.com;

  ssl_certificate     /etc/letsencrypt/live/publish.example.com/fullchain.pem;
  ssl_certificate_key /etc/letsencrypt/live/publish.example.com/privkey.pem;

  # Uploads du plugin (l'upload est découpé en chunks ; 20m laisse de la marge)
  client_max_body_size 20m;

  # Proxy vers l'app (SPA Angular + API) sur la loopback
  location / {
    proxy_pass         http://127.0.0.1:3000/;
    proxy_set_header   Host              $host;
    proxy_set_header   X-Real-IP         $remote_addr;
    proxy_set_header   X-Forwarded-For   $proxy_add_x_forwarded_for;
    proxy_set_header   X-Forwarded-Proto $scheme;
    proxy_read_timeout 30s;
  }

  # CORS strict pour l'API, réservé au client Obsidian
  location ^~ /api/ {
    proxy_pass         http://127.0.0.1:3000/api/;
    proxy_set_header   Host              $host;
    proxy_set_header   X-Real-IP         $remote_addr;
    proxy_set_header   X-Forwarded-For   $proxy_add_x_forwarded_for;
    proxy_set_header   X-Forwarded-Proto $scheme;

    add_header Access-Control-Allow-Origin "app://obsidian.md" always;
    add_header Access-Control-Allow-Methods "GET, POST, OPTIONS" always;
    add_header Access-Control-Allow-Headers "Content-Type, x-api-key" always;
    if ($request_method = OPTIONS) { return 204; }
  }
}

server {
  listen 80;
  server_name publish.example.com;
  return 301 https://$host$request_uri;
}
```

```bash
sudo ln -s /etc/nginx/sites-available/publish.example.com /etc/nginx/sites-enabled/
sudo nginx -t && sudo systemctl reload nginx
```

### 4. TLS (certbot)

```bash
sudo certbot --nginx -d publish.example.com
sudo certbot renew --dry-run   # vérifier que le renouvellement automatique passe
```

Le challenge HTTP-01 exige que le port 80 soit ouvert. Si votre hébergeur filtre le 80, utilisez un challenge DNS-01.

### 5. Pare-feu (ufw)

```bash
sudo ufw default deny incoming
sudo ufw default allow outgoing
sudo ufw allow OpenSSH
sudo ufw allow 'Nginx Full'   # 80 + 443
sudo ufw enable
```

Rien d'autre : les ports applicatifs (3000, …) restent sur la loopback.

### 6. Mises à jour automatiques (optionnel — Watchtower)

`/srv/apps/watchtower/docker-compose.yml` :

```yaml
services:
  watchtower:
    image: containrrr/watchtower:1.7.1
    restart: unless-stopped
    volumes:
      - /var/run/docker.sock:/var/run/docker.sock
    command: --interval 300 --cleanup
```

Watchtower tirera automatiquement chaque nouveau tag `latest` publié par la CI (chaque release stable). Sans Watchtower, mettre à jour à la main :

```bash
cd /srv/apps/personal-publish && sudo docker compose pull && sudo docker compose up -d
```

### 7. Registre privé (optionnel)

Le déploiement de référence tire l'image d'un registre privé (`registry:2` sur `127.0.0.1:5000`, exposé par un vhost nginx dédié avec `auth_basic` et `client_max_body_size 0` pour les gros layers). C'est utile si vous forkez le projet et construisez vos propres images ; sinon, l'image publique Docker Hub suffit.

## Utilisation — configurer le plugin

Dans Obsidian → **Réglages → Publish to VPS** :

- **Base URL** : `https://publish.example.com`
- **API key** : la clé générée à l'étape 1 (celle du `docker-compose.yml`)
- Configurer ensuite routes, dossiers et règles d'exclusion, puis lancer **Publish to VPS**.

## Matrice de compatibilité

Le plugin, l'image Docker et les bibliothèques partagées sont versionnés **en lockstep** : une release `X.Y.Z` publie simultanément les assets du plugin et l'image `jorouquette/obsidian-vps-publish:X.Y.Z` (+ `latest`). Règles :

| Composant       | Version                          | Contrainte                                          |
| --------------- | -------------------------------- | --------------------------------------------------- |
| Plugin Obsidian | `X.Y.Z`                          | Obsidian desktop `>= 1.5.0` (`isDesktopOnly`)       |
| Image Docker    | `X.Y.Z`, `latest`, `<short-sha>` | Aligner l'image sur la version du plugin (lockstep) |

En pratique : plugin et image d'une même version mineure fonctionnent ensemble ; en cas de doute (nouvelle syntaxe non rendue, erreur d'API), aligner les deux sur la même version `X.Y.Z`.

## Troubleshooting

| Symptôme                             | Cause probable & remède                                                                                            |
| ------------------------------------ | ------------------------------------------------------------------------------------------------------------------ | --------------- |
| `401 Unauthorized` à la publication  | `API key` du plugin ≠ `API_KEY` du conteneur. Vérifier aussi que le header `x-api-key` est autorisé côté CORS.     |
| Erreur CORS dans la console Obsidian | `app://obsidian.md` absent de `ALLOWED_ORIGINS` (conteneur) ou du header `Access-Control-Allow-Origin` (nginx).    |
| `413 Request Entity Too Large`       | `client_max_body_size` nginx trop bas pour vos assets (défaut nginx : 1m). Passer à `20m` ou plus.                 |
| `502 Bad Gateway`                    | Conteneur arrêté ou unhealthy : `docker ps`, `curl 127.0.0.1:3000/health`, `docker logs personal-publish`.         |
| Site vide après publication          | Volumes non persistés (`./content`, `./assets`) ou publication filtrée par les règles d'exclusion du plugin.       |
| Certificat expiré                    | `sudo certbot renew --dry-run`, vérifier le timer (`systemctl list-timers                                          | grep certbot`). |
| Disque plein                         | `df -h /` ; purger les vieilles images : `docker image prune -a` (Watchtower `--cleanup` le fait automatiquement). |

## Références

- [Docker](./docker.md) — contenu de l'image, variables d'environnement, tags publiés.
- [`docker-compose.prod.yml`](../docker-compose.prod.yml) — gabarit complet des variables d'environnement.
- Image Docker Hub : <https://hub.docker.com/r/jorouquette/obsidian-vps-publish>
- Monorepo (source + issues) : <https://github.com/JoRouquette/obsidian-vps-publish>
