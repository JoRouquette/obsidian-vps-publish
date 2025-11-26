# PublishToPersonalVps

Publish selected folders from your Obsidian vault to your **own VPS**, similar in spirit to Obsidian Publish, but self-hosted and fully under your control.

The project is split into:

- `core-publishing/` – domain logic and “Clean Architecture” core (no Obsidian dependencies).
- `obsidian-plugin/` – the actual Obsidian plugin (UI, adapters, HTTP calls).

Everything is plain TypeScript with **relative imports only**, no Nx, no path aliases.

## Features

- Publish one or more vault folders to a personal VPS via HTTP.
- Configure **VPS URL and API key** directly from the plugin settings.
- Configure **site route** per folder (`/blog`, `/docs`, etc.).
- Filter notes based on **YAML frontmatter**:
  - Ignored when `publish: true` (example rule).
  - Ignored when `type: "tableau de bord"` (example rule).
  - Easily extendable with more rules (properties and values).
- Clean separation between:
  - Domain/use cases (`core-publishing`)
  - Infrastructure/UI (`obsidian-plugin`).

## Requirements

- **Node.js** ≥ 18
- **npm**
- **Obsidian** ≥ 1.5 (desktop; mobile is possible but untested)
- A **VPS** or server with:
  - Node.js (for the simple upload API), and/or
  - Nginx or any reverse proxy in front (optional but recommended)

## Repository Structure

```text
publish-to-personal-vps/
  core-publishing/
    src/
      lib/
        domain/
          models.ts
        ports/
          vault-port.ts
          uploader-port.ts
        usecases/
          publish-all.usecase.ts

  obsidian-plugin/
    src/
      main.ts
      lib/
        setting-tab.ts
        obsidian-vault.adapter.ts
        http-uploader.adapter.ts
    manifest.json
    styles.css

  tools/
    build-plugin.js

  tsconfig.json
  package.json
  dist/                      # created after build
```

- `core-publishing` knows nothing about Obsidian or HTTP.
- `obsidian-plugin` wires the domain to:
  - Obsidian’s vault API (reading markdown + frontmatter)
  - HTTP calls to your VPS (`/api/upload`)

## Clean Architecture Overview

### Domain (core-publishing)

**Models (`domain/models.ts`)** – example:

- `VpsConfig` – target VPS (id, name, url, apiKey).
- `FolderConfig` – vault folder + route + ignore rules.
- `IgnoreRule` – how to decide whether to skip a note based on frontmatter.
- `PublishPluginSettings` – all settings stored by the plugin.
- `PublishableNote` – note ready to be uploaded.

**Ports (`ports/*.ts`)**:

- `VaultPort`

  > Abstraction over “where notes live”.
  > Implemented by `ObsidianVaultAdapter` in the plugin.

- `UploaderPort`

  > Abstraction over “how to upload notes”.
  > Implemented by `HttpUploaderAdapter` in the plugin.

**Use Case (`usecases/publish-all.usecase.ts`)**:

- `PublishAllUseCase`:
  - Loops through configured folders.
  - Uses `VaultPort` to collect notes.
  - Applies ignore rules based on frontmatter.
  - Calls `UploaderPort.uploadNote()` for each publishable note.

This layer does **not** know:

- Obsidian’s `App`, `TFile`, `TFolder`, etc.
- `fetch`, HTTP, Node, or the filesystem.

### Plugin (obsidian-plugin)

**Adapters:**

- `ObsidianVaultAdapter`
  Implements `VaultPort` using Obsidian’s vault & metadata cache:
  - Traverses a given folder.
  - Reads `.md` files.
  - Extracts frontmatter from metadata cache.

- `HttpUploaderAdapter`
  Implements `UploaderPort` using `fetch`:
  - Sends a `POST` to `${vps.url}/api/upload`.
  - Includes `routeBase`, `relativePath`, `content`, `frontmatter` in JSON body.
  - Uses `x-api-key` header for authentication.

**Main plugin (`main.ts`):**

- Extends Obsidian’s `Plugin`.
- Loads/saves `PublishPluginSettings` from Obsidian’s data store.
- Registers:
  - Settings tab (`PublishToPersonalVpsSettingTab`).
  - Command: “Publish to personal VPS”.

- On publish:
  - Creates `ObsidianVaultAdapter` + `HttpUploaderAdapter`.
  - Instantiates `PublishAllUseCase`.
  - Calls `useCase.execute(settings)`.

**Settings UI (`setting-tab.ts`):**

- Simple UI built with Obsidian’s `Setting` class:
  - Configure a single VPS (name, URL, API key).
  - Configure a single folder:
    - Vault folder path (`Blog`, `Notes/Docs`, etc.).
    - Route base (`/blog`, `/docs`).

  - Explains default ignore rules:
    - `publish: true` → ignored.
    - `type: "tableau de bord"` → ignored.

- Styles (`styles.css`) are minimal and theme-friendly:
  - Use Obsidian CSS variables (`--background-secondary`, `--text-normal`, etc.).
  - Scoped under `.publish-to-personal-vps-settings` to avoid global pollution.

## Build & Development

> Nx is removed. Everything is driven by `npm` scripts and plain `tsc`.

### Install dependencies

At the root of the repo:

```bash
npm install
```

This installs:

- `typescript`
- `@types/node`
- `obsidian` (for types)
- plus any other dev dependencies declared in `package.json`.

### TypeScript configuration (tsconfig.json)

`tsconfig.json` defines **one global TS project**:

- Root directory: `.` (the repo root).
- Out directory: `dist`.
- Included sources:
  - `core-publishing/src/**/*.ts`
  - `obsidian-plugin/src/**/*.ts`

- Only **relative imports** across the repo.

### Build all TypeScript

```bash
npm run build
```

This runs:

```bash
tsc -p tsconfig.json
```

Output:

```text
dist/
  core-publishing/
    src/...
  obsidian-plugin/
    src/...
```

### Build plugin bundle for Obsidian

```bash
npm run build:plugin
```

This runs:

1. `npm run build` → compile all TS to JS in `dist/`.
2. `node tools/build-plugin.js` → copies plugin files into a single folder.

Result:

```text
dist/PublishToPersonalVps/
  main.js
  manifest.json
  styles.css
```

This folder is what Obsidian expects for a community plugin.

## Installing the Plugin in Obsidian

1. **Build the plugin:**

   ```bash
   npm run build:plugin
   ```

2. **Locate your vault plugins folder**
   In your Obsidian vault directory:

   ```text
   <your-vault>/.obsidian/plugins/
   ```

3. **Copy or symlink the plugin folder**

   Option A – copy:

   ```bash
   cp -r dist/PublishToPersonalVps "<path-to-your-vault>/.obsidian/plugins/PublishToPersonalVps"
   ```

   Option B – symlink (useful in dev):

   ```bash
   ln -s \
     "$(pwd)/dist/PublishToPersonalVps" \
     "<path-to-your-vault>/.obsidian/plugins/PublishToPersonalVps"
   ```

4. **Enable the plugin in Obsidian**
   - Settings → “Community plugins” → “Installed plugins”.
   - Enable **Publish To personal VPS**.

5. **Configure the plugin**

   In Obsidian’s settings → “Publish To personal VPS”:
   - **VPS configuration:**
     - Name: “Main VPS” (or whatever).
     - URL: `https://your-domain.tld` (where your backend listens).
     - API Key: the same as your backend server is configured with.

   - **Folder configuration:**
     - Vault folder: e.g. `Blog` (must match folder name in the vault).
     - Route: e.g. `/blog`.

## Backend on VPS

You need a simple HTTP API on your VPS to receive note uploads.

### Example Node/Express backend

Create a folder on your VPS, e.g. `/home/deploy/vps-backend`:

`package.json`:

```json
{
  "name": "obsidian-publish-backend",
  "version": "0.1.0",
  "private": true,
  "main": "server.js",
  "scripts": {
    "start": "node server.js"
  },
  "dependencies": {
    "express": "^4.18.0",
    "body-parser": "^1.20.0"
  }
}
```

`server.js`:

```js
const express = require('express');
const bodyParser = require('body-parser');
const fs = require('fs');
const path = require('path');

const app = express();
app.use(bodyParser.json({ limit: '10mb' }));

const PORT = process.env.PORT || 4000;
const API_KEY = process.env.API_KEY || 'CHANGE_ME';
const ROOT_DIR = process.env.ROOT_DIR || '/var/www/obsidian-sites';

app.post('/api/upload', (req, res) => {
  const apiKey = req.headers['x-api-key'];
  if (apiKey !== API_KEY) {
    return res.status(401).send('Unauthorized');
  }

  const { routeBase, relativePath, content } = req.body;

  if (!routeBase || !relativePath || typeof content !== 'string') {
    return res.status(400).send('Missing parameters');
  }

  const cleanRoute = routeBase.replace(/^\/+/, '').replace(/\/+$/, '');
  const safeRelative = relativePath.replace(/^\/+/, '');
  const targetPath = path.join(ROOT_DIR, cleanRoute, safeRelative);

  fs.mkdirSync(path.dirname(targetPath), { recursive: true });

  fs.writeFile(targetPath, content, 'utf8', (err) => {
    if (err) {
      console.error('Error writing file', err);
      return res.status(500).send('Error writing file');
    }

    console.log('Uploaded:', targetPath);
    res.send('OK');
  });
});

app.listen(PORT, () => {
  console.log(`Backend listening on port ${PORT}`);
});
```

Run it (systemd, pm2, or just `node server.js` in dev).

### Example Nginx config

Assuming:

- Domain: `notes.example.com`
- Backend Node app running on `127.0.0.1:4000`
- Root for static files: `/var/www/obsidian-sites`

Minimal `/etc/nginx/sites-available/notes.example.com`:

```nginx
server {
    listen 80;
    server_name notes.example.com;

    # API proxy
    location /api/ {
        proxy_pass http://127.0.0.1:4000;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
    }

    # Static “published” markdown files
    root /var/www/obsidian-sites;

    location / {
        try_files $uri $uri/ =404;
    }
}
```

Enable, reload, and optionally add HTTPS via certbot.

## Frontmatter & Ignore Rules

By default, the plugin is configured to **ignore**:

- Any note with `publishToVps: false`

Example ignored notes:

```yaml
---
title: 'Internal draft'
publishToVps: true
---
```

Notes **without** these frontmatter values are candidates for publishing.

The logic lives in `PublishAllUseCase`:

- Reads frontmatter.
- Applies `ignoreRules` defined in each `FolderConfig`:
  - `ignoreIfTrue` on a boolean property.
  - `ignoreValues` on property values.

You can extend `FolderConfig.ignoreRules` to support other patterns, e.g.:

- `draft: true`
- `status: "private"`
- etc.

## How to Extend / Customize

Some concrete extension ideas:

### 1. Multiple VPS configurations

Right now, a single `VpsConfig` is used. To support multiple:

- Allow adding/removing `VpsConfig` in the settings UI.
- Let each `FolderConfig` pick a `vpsId`.
- `PublishAllUseCase` already looks up the `VpsConfig` by `vpsId` for each folder.

### 2. Multiple folders in the UI

Currently, settings handle one folder. To handle many:

- Store an array of `FolderConfig` in settings (already modeled).
- Add UI controls to:
  - Append a new folder (with default ignore rules).
  - Remove existing folders.

- `PublishAllUseCase` already loops through `settings.folders`, so it scales.

### 3. Custom ignore rules per folder

Add UI elements in `setting-tab.ts` to:

- Add `<property, value>` pairs or boolean flags for ignore rules.
- Serialize them into `FolderConfig.ignoreRules`.

## Troubleshooting

### Plugin does not appear in Obsidian

- Check that the final folder structure looks like:

  ```text
  <vault>/.obsidian/plugins/PublishToPersonalVps/
    main.js
    manifest.json
    styles.css
  ```

- Ensure `manifest.json` has a valid `id`, `name`, and `minAppVersion`.

### “Publication failed” notice

- Open Obsidian’s developer console.
- Check:
  - HTTP errors (401 → wrong API key, 404/500 → backend misconfigured).
  - CORS / HTTPS issues (if you are doing something fancy).

### Files not appearing on the site

- Confirm the backend wrote files under `ROOT_DIR`:
  - e.g. `ls -R /var/www/obsidian-sites`.

- Confirm your route is what you expect:
  - Folder route `/blog` → content should end up in `/var/www/obsidian-sites/blog/`.

- Check frontmatter: maybe your ignore rules are discarding the note.
