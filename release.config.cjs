module.exports = {
  branches: [{ name: 'main' }],
  plugins: [
    [
      '@semantic-release/commit-analyzer',
      {
        preset: 'conventionalcommits',
        releaseRules: [
          { type: 'feat', release: 'minor' },
          { type: 'fix', release: 'patch' },
          { type: 'hotfix', release: 'patch' },
          { type: 'perf', release: 'patch' },
          { type: 'refactor', release: 'patch' },
          { type: 'build', release: false },
          { type: 'ci', release: false },
          { type: 'docs', release: false },
          { type: 'style', release: false },
          { type: 'test', release: false },
          { type: 'chore', release: false },
        ],
      },
    ],
    ['@semantic-release/release-notes-generator', { preset: 'conventionalcommits' }],
    ['@semantic-release/changelog', { changelogFile: 'CHANGELOG.md' }],
    [
      '@semantic-release/exec',
      {
        prepareCmd:
          'RELEASE_VERSION=${nextRelease.version} node scripts/sync-version.mjs && node apps/obsidian-vps-publish/scripts/update-obsidian-version.mjs ${nextRelease.version} && npx nx run obsidian-vps-publish:build --skip-nx-cache && node apps/obsidian-vps-publish/scripts/package-plugin.mjs && cd dist && zip -r obsidian-vps-publish.zip obsidian-vps-publish',
      },
    ],
    [
      '@semantic-release/git',
      {
        assets: [
          'CHANGELOG.md',
          'package.json',
          'package-lock.json',
          'apps/site/src/version.ts',
          'apps/node/src/version.ts',
          'apps/obsidian-vps-publish/manifest.json',
          'apps/obsidian-vps-publish/versions.json',
        ],
        message: 'chore(release): ${nextRelease.version} [skip ci]\n\n${nextRelease.notes}',
      },
    ],
    [
      '@semantic-release/github',
      {
        assets: [{ path: 'dist/obsidian-vps-publish.zip', label: 'Obsidian plugin bundle' }],
      },
    ],
    ['@semantic-release/npm', { npmPublish: false }],
  ],
};
