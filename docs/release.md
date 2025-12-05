# Release and versioning

## Release flow

- CI workflow: `.github/workflows/ci-release.yml`
  - `quality`: lint, test, build (Nx), upload `dist` artifact.
  - `semantic-release`: syncs versions (workspace + plugin manifests), rebuilds and packages the plugin, zips it, creates the GitHub release and attaches the plugin asset.
  - `docker-images`: builds and pushes the Docker image to the private registry and Docker Hub `jorouquette/obsidian-vps-publish` (tags: version, short SHA, `latest`).
- Release config: `release.config.cjs` (version sync, changelog, git commits/tags, plugin packaging, GitHub assets).

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
