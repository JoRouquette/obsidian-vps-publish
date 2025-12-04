# Publish to VPS

## Description

Publish selected folders from your vault to your own VPS (self-hosted alternative to Obsidian Publish). Notes are filtered with frontmatter rules, routed per folder, and uploaded over HTTPS along with assets. Multi-language UI, ignore rules, and assets handling are included.

## Requirements

- Node.js 18+ locally (CI uses Node 22).
- Obsidian 1.5.0+ (desktop; mobile not tested).
- A VPS endpoint that accepts uploads (see `libs` and `apps/node` in this repo for the backend pieces).

## Installation

### From release (recommended)

1. Download the latest release assets (`manifest.json`, `main.js`, `styles.css`, `versions.json`) from GitHub Releases.
2. Create `<your-vault>/.obsidian/plugins/vps-publish/` and drop the files there.
3. Reload plugins in Obsidian and enable **Publish to VPS**.

### Local development

```bash
npm install
npm run package:plugin          # builds via Nx + esbuild and packages to dist/vps-publish
```

Then copy or symlink `dist/vps-publish` to `<your-vault>/.obsidian/plugins/vps-publish`.

## Usage

1. In plugin settings, configure VPS URL, API key, target folders, routes, and ignore rules.
2. Run the command **Publish to VPS** from the command palette.
3. (Optional) Use **Test VPS connection** if enabled.

## Build and release

- Create an annotated tag matching `apps/obsidian-vps-publish/manifest.json`, e.g. `git tag v3.0.2 && git push origin v3.0.2`.
- CI packages to `dist/vps-publish` and uploads release assets (`manifest.json`, `main.js`, `styles.css`, `versions.json`).
- `versions.json` maps plugin versions to `minAppVersion`; keep it in sync when bumping versions.

## Publish to Obsidian Community Plugins

1. Fork `obsidianmd/obsidian-releases`.
2. Append to `community-plugins.json`:
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

## License

This project is licensed under the terms of the repository’s root `LICENSE`.
