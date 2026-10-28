# Release and versioning

## Release flow

- CI workflow: `.github/workflows/ci-release.yml`
  - `quality`: lint, Obsidian directory review lint (`obsidian-vps-publish:lint:directory`), test, build (Nx), upload `dist` artifact. The directory review lint fails above a warning ceiling (`--max-warnings` in `apps/obsidian-vps-publish/project.json`); lower the ceiling in the same commit whenever a change brings the count down.
  - `semantic-release`: syncs versions (workspace + plugin manifests), rebuilds and packages the plugin, zips it, creates the GitHub release and attaches the plugin asset.
  - `docker-images`: builds and pushes the Docker image to the private registry and Docker Hub `jorouquette/obsidian-vps-publish` (tags: version, short SHA, `latest`).
- Release config: `release.config.cjs` (version sync, changelog, git commits/tags, plugin packaging, GitHub assets).

## Conventional Commits and version bumps

- `feat` triggers a `minor` release.
- `fix`, `hotfix`, `perf`, and `refactor` trigger a `patch` release.
- Any commit with `!` in the header or a `BREAKING CHANGE:` footer must trigger a `major` release.

Examples:

```txt
feat(api): add finalization retry endpoint
```

```txt
feat(publishing)!: make api-owned deterministic transforms the only path

BREAKING CHANGE: remove the client-owned deterministic transform path.
```

This `breaking: true => major` rule must remain explicit in `release.config.cjs` because custom
`releaseRules` are configured. Without that explicit rule, a breaking `feat` can be downgraded to
`minor` by the custom `feat => minor` mapping.

## Marketplace release and build verification

The Obsidian directory reviews the mirror repository `JoRouquette/vps-publish`, not this monorepo. For every stable release, `.github/workflows/sync-mirrors.yml` regenerates the mirror tree (`tools/mirror/regenerate.sh vps-publish`), then publishes the release assets there.

The directory review clones the mirror, runs a bare `npm ci` and `npm run build`, and compares the resulting `main.js` with the released asset. To keep that comparison true, the `build-assets` job builds the assets from the same regenerated tree with the same two commands (no `--legacy-peer-deps`), instead of the Nx build of the monorepo. It has no secret and no write permission, because it runs the install and build scripts of the dependencies. The `mirror-release` job then downloads the built files, signs the attestation and creates the release with the token. It reads the version from this repository, never from the built tree. The mirror lockfile (`tools/mirror/templates/vps-publish/package-lock.json`) must stay in sync with its `package.json`, and `NODE_VERSION` must match the version the review uses.

The directory review also looks for a build provenance attestation on the mirror repository itself. The mirror CI (`tools/mirror/ci/vps-publish-release.yml`) signs one for `main.js`, `styles.css` and `manifest.json` after each push to the mirror (an `attest` job apart from the build, so the job that runs the dependency scripts holds no signing right), and the monorepo job signs the same files on its side. As the build is reproducible, both carry the digest of the released assets: `gh attestation verify main.js --repo JoRouquette/vps-publish`. The mirror attestation is produced by the mirror CI after the push, so it can appear a few minutes after the release; a newer push cancels an older run, and the digest then still comes from the newest run.

To check a release by hand:

```bash
git clone https://github.com/JoRouquette/vps-publish.git && cd vps-publish
npm ci && npm run build
sha256sum main.js   # must equal the digest of the released main.js
```

## Tagging and artifacts

- Create an annotated tag that matches `manifest.json` (root), e.g.:

  ```bash
  git tag v3.2.2 && git push origin v3.2.2
  ```

- CI packages `dist/vps-publish/` and uploads `dist/vps-publish.zip` to GitHub Releases (ready for manual install).
- `apps/obsidian-vps-publish/versions.json` must map each plugin version to the required `minAppVersion`.

## Manifest and version guidelines

- Keep `manifest.json` (root) version in lockstep with tags and release notes.
- When bumping versions, update `apps/obsidian-vps-publish/versions.json` to reflect the new `minAppVersion`.
- Ensure the plugin `id` stays `vps-publish` to match the published assets and marketplace entry.

## Obsidian Community Plugins submission

1. Fork `obsidianmd/obsidian-releases`.
2. Append to `community-plugins.json`:

   ```json
   {
     "id": "vps-publish",
     "name": "Publish to VPS",
     "author": "Jonathan ROUQUETTE",
     "description": "Publish selected vault folders to your personal VPS with property-based filtering and remote upload.",
     "repo": "JoRouquette/obsidian-vps-publish"
   }
   ```

3. Ensure `id` matches `manifest.json` (root).
4. Open a PR against `obsidianmd/obsidian-releases`.

## Required secrets/vars (CI)

- `REGISTRY_URL`, `IMAGE_NAME`, `REGISTRY_USER`, `REGISTRY_PASSWORD`
- `DOCKERHUB_USERNAME`, `DOCKERHUB_TOKEN`
- `GITHUB_TOKEN` (Actions-provided)
- Any additional registry credentials for private pushes (if applicable).
