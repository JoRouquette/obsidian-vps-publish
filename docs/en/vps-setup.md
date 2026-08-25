# Deploying on a VPS (reference guide)

> **Version française :** [docs/vps-setup.md](../vps-setup.md)

## Purpose

Deploy the self-hosted stack (API + site) on a VPS, ready to receive publications from the **Publish to VPS** Obsidian plugin. This guide describes the reference architecture used by the project's original deployment: a native nginx TLS front, the application container bound to loopback only, and automatic image updates via Watchtower.

**Audience**: ops / self-hosters. For image contents and variables, see [Docker](../docker.md).

## When to use

- First-time setup of the server that will receive your Obsidian publications.
- Rebuilding an existing deployment on a proven pattern.

## Key concepts — reference architecture

```
Internet
  │  443 (TLS Let's Encrypt) / 80 (301 redirect)
  ▼
native nginx (vhost publish.example.com)
  │  proxy_pass → 127.0.0.1:3000 (loopback only)
  ▼
obsidian-vps-publish container  (Node API + Angular SPA)
  ├── volume ./content  → /content   (rendered HTML + manifests)
  └── volume ./assets   → /assets    (published images and files)
```

Principles:

- **The container never exposes a public port**: it listens on `127.0.0.1:3000`; only nginx is exposed (80/443). No application port to open in the firewall.
- **One folder per application** under `/srv/apps/<app>/` (compose file + volumes side by side).
- **TLS terminated by nginx** with Let's Encrypt certificates renewed by certbot.
- **Automatic image updates** (optional) with Watchtower.

## Prerequisites

- A Linux VPS (tested on Ubuntu, works on Debian) with SSH and sudo access.
- A domain name with an `A` record (e.g. `publish.example.com`) pointing to the VPS IP.
- Docker + the compose plugin, nginx, and certbot:

  ```bash
  sudo apt update
  sudo apt install -y docker.io docker-compose-v2 nginx certbot python3-certbot-nginx
  ```

## Configuration

### 1. Directory layout and API key

```bash
sudo mkdir -p /srv/apps/personal-publish/{content,assets}
cd /srv/apps/personal-publish
# Generate a strong API key (you will paste it into the Obsidian plugin):
openssl rand -base64 32
```

### 2. `docker-compose.yml`

`/srv/apps/personal-publish/docker-compose.yml` (adapted from [`docker-compose.prod.yml`](../../docker-compose.prod.yml) — see that file for the full list of variables):

```yaml
services:
  personal-publish:
    image: jorouquette/obsidian-vps-publish:latest
    pull_policy: always
    restart: unless-stopped
    ports:
      - '127.0.0.1:3000:3000' # loopback only — never 0.0.0.0
    environment:
      NODE_ENV: 'production'
      PORT: '3000'
      CONTENT_ROOT: /content
      ASSETS_ROOT: /assets
      UI_ROOT: /ui
      API_KEY: 'REPLACE_WITH_GENERATED_KEY'
      BASE_URL: https://publish.example.com
      ALLOWED_ORIGINS: https://publish.example.com,app://obsidian.md
      SITE_NAME: 'My site'
      AUTHOR: 'Your name'
      LOGGER_LEVEL: 'warn'
    volumes:
      - ./content:/content
      - ./assets:/assets
```

```bash
sudo docker compose up -d
curl -fsS http://127.0.0.1:3000/health   # must respond before you continue
```

### 3. nginx vhost

`/etc/nginx/sites-available/publish.example.com`:

```nginx
server {
  listen 443 ssl;
  http2 on;

  server_name publish.example.com;

  ssl_certificate     /etc/letsencrypt/live/publish.example.com/fullchain.pem;
  ssl_certificate_key /etc/letsencrypt/live/publish.example.com/privkey.pem;

  # Plugin uploads (uploads are chunked; 20m leaves headroom)
  client_max_body_size 20m;

  # Proxy to the app (Angular SPA + API) on loopback
  location / {
    proxy_pass         http://127.0.0.1:3000/;
    proxy_set_header   Host              $host;
    proxy_set_header   X-Real-IP         $remote_addr;
    proxy_set_header   X-Forwarded-For   $proxy_add_x_forwarded_for;
    proxy_set_header   X-Forwarded-Proto $scheme;
    proxy_read_timeout 30s;
  }

  # Strict CORS for the API, restricted to the Obsidian client
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
sudo certbot renew --dry-run   # make sure automatic renewal works
```

The HTTP-01 challenge requires port 80 to be open. If your provider filters port 80, use a DNS-01 challenge instead.

### 5. Firewall (ufw)

```bash
sudo ufw default deny incoming
sudo ufw default allow outgoing
sudo ufw allow OpenSSH
sudo ufw allow 'Nginx Full'   # 80 + 443
sudo ufw enable
```

Nothing else: application ports (3000, …) stay on loopback.

### 6. Automatic updates (optional — Watchtower)

`/srv/apps/watchtower/docker-compose.yml`:

```yaml
services:
  watchtower:
    image: containrrr/watchtower:1.7.1
    restart: unless-stopped
    volumes:
      - /var/run/docker.sock:/var/run/docker.sock
    command: --interval 300 --cleanup
```

Watchtower automatically pulls every new `latest` tag published by CI (each stable release). Without Watchtower, update manually:

```bash
cd /srv/apps/personal-publish && sudo docker compose pull && sudo docker compose up -d
```

### 7. Private registry (optional)

The reference deployment pulls its image from a private registry (`registry:2` on `127.0.0.1:5000`, exposed through a dedicated nginx vhost with `auth_basic` and `client_max_body_size 0` for large layers). Useful if you fork the project and build your own images; otherwise the public Docker Hub image is all you need.

## Usage — configure the plugin

In Obsidian → **Settings → Publish to VPS**:

- **Base URL**: `https://publish.example.com`
- **API key**: the key generated at step 1 (the one in `docker-compose.yml`)
- Then configure routes, folders, and ignore rules, and run **Publish to VPS**.

## Compatibility matrix

The plugin, the Docker image, and the shared libraries are versioned **in lockstep**: a release `X.Y.Z` simultaneously publishes the plugin assets and the `jorouquette/obsidian-vps-publish:X.Y.Z` image (+ `latest`). Rules:

| Component       | Version                          | Constraint                                        |
| --------------- | -------------------------------- | ------------------------------------------------- |
| Obsidian plugin | `X.Y.Z`                          | Obsidian desktop `>= 1.5.0` (`isDesktopOnly`)     |
| Docker image    | `X.Y.Z`, `latest`, `<short-sha>` | Keep the image aligned with the plugin (lockstep) |

In practice: a plugin and an image from the same minor version work together; when in doubt (new syntax not rendered, API error), align both on the same `X.Y.Z`.

## Troubleshooting

| Symptom                            | Likely cause & fix                                                                                            |
| ---------------------------------- | ------------------------------------------------------------------------------------------------------------- | --------------- |
| `401 Unauthorized` when publishing | Plugin `API key` ≠ container `API_KEY`. Also check the `x-api-key` header is allowed in CORS.                 |
| CORS error in the Obsidian console | `app://obsidian.md` missing from `ALLOWED_ORIGINS` (container) or from `Access-Control-Allow-Origin` (nginx). |
| `413 Request Entity Too Large`     | nginx `client_max_body_size` too low for your assets (nginx default: 1m). Raise to `20m` or more.             |
| `502 Bad Gateway`                  | Container stopped or unhealthy: `docker ps`, `curl 127.0.0.1:3000/health`, `docker logs personal-publish`.    |
| Empty site after publishing        | Volumes not persisted (`./content`, `./assets`) or publication filtered out by the plugin's ignore rules.     |
| Expired certificate                | `sudo certbot renew --dry-run`, check the timer (`systemctl list-timers                                       | grep certbot`). |
| Disk full                          | `df -h /`; prune old images: `docker image prune -a` (Watchtower `--cleanup` does it automatically).          |

## References

- [Docker](../docker.md) — image contents, environment variables, published tags.
- [`docker-compose.prod.yml`](../../docker-compose.prod.yml) — full environment variable template.
- Docker Hub image: <https://hub.docker.com/r/jorouquette/obsidian-vps-publish>
- Monorepo (source + issues): <https://github.com/JoRouquette/obsidian-vps-publish>
