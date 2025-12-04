# Publish to VPS

Publish selected folders from your vault to your own VPS (self-hosted alternative to Obsidian Publish). Notes are filtered with frontmatter rules, routed per folder, and uploaded over HTTPS along with assets.

## What it does

- Publish one or more vault folders to a personal VPS using your API key.
- Route content per folder (`/blog`, `/docs`, etc.) and keep relative paths intact.
- Apply frontmatter ignore rules before upload (publish flags, tags, custom fields).
- Upload assets and optionally fall back to an assets vault folder.
- Multi-language UI (locale stored in plugin settings).

## Requirements

- Node.js 18+ locally (CI uses Node 22).
- Obsidian 1.5.0+ (desktop; mobile not tested).
- A VPS endpoint that accepts uploads (see `libs` and `apps/node` in this repo for the backend pieces).

## Build and bundle the plugin

At the workspace root:

```bash
npm install
npm run package:plugin          # builds via Nx + esbuild and packages to dist/vps-publish
```

Outputs:

- `dist/vps-publish/main.js`
- `dist/vps-publish/manifest.json`
- `dist/vps-publish/styles.css`
- `dist/vps-publish/versions.json`

## Install locally in Obsidian

1. Build the bundle (`npm run package:plugin`).
2. Copy or symlink `dist/vps-publish` to `<your-vault>/.obsidian/plugins/vps-publish`.
3. Restart Obsidian or reload plugins, then enable **Publish to VPS**.
4. In the plugin settings, configure VPS URL, API key, target folders, routes, and ignore rules.
5. Run the command **Publish to VPS** from the command palette.

## Release workflow (tags -> GitHub Release)

- Create an annotated tag that matches the plugin version in `apps/obsidian-vps-publish/manifest.json`, e.g.:
  ```bash
  git tag v3.0.2
  git push origin v3.0.2
  ```
- Workflow: `.github/workflows/obsidian-release.yml`
  - Checks out the repo and installs dependencies.
  - Runs `npm run package:plugin` to bundle to `dist/vps-publish`.
  - Verifies the tag version matches `manifest.json`.
  - Creates a GitHub Release for the tag and uploads `manifest.json`, `main.js`, `styles.css`, and `versions.json` from `dist/vps-publish`.

## versions.json

- Maps plugin versions to the minimum Obsidian version required.
- Keep `versions.json` in sync with `manifest.json` (version and `minAppVersion`) when cutting a release.

## Publish to Obsidian Community Plugins

1. Fork `obsidianmd/obsidian-releases`.
2. In your fork, append to `community-plugins.json`:
   ```json
   {
     "id": "vps-publish",
     "name": "Publish to VPS",
     "author": "JRouquette",
     "description": "Publish selected vault folders to your personal VPS with property-based filtering and remote upload.",
     "repo": "JoRouquette/obsidian-vps-publish"
   }
   ```
3. Ensure `id` matches `apps/obsidian-vps-publish/manifest.json`.
4. Open a PR against `obsidianmd/obsidian-releases`.

## Contributing

- Branch from `main`, keep changes scoped, and add tests where it makes sense (`npm test`).
- Format/lint before pushing: `npm run lint` (or the Nx equivalents per target).
- For release changes, align the tag with `manifest.json` and `versions.json`.
