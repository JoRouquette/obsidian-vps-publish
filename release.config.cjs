const pluginManifest = require('./manifest.json');
const PLUGIN_ID = pluginManifest.id;

module.exports = {
  branches: [{ name: 'main' }, { name: 'develop', prerelease: 'alpha' }],
  tagFormat: '${version}',
  plugins: [
    [
      '@semantic-release/commit-analyzer',
      {
        preset: 'conventionalcommits',
        releaseRules: [
          { breaking: true, release: 'major' },
          { type: 'feat', release: 'minor' },
          { type: 'fix', release: 'patch' },
          { type: 'hotfix', release: 'patch' },
          { type: 'perf', release: 'patch' },
          { type: 'refactor', release: 'patch' },
          { type: 'build', release: false },
          { type: 'ci', release: false },
          { type: 'docs', scope: 'readme', release: 'patch' },
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
        prepareCmd: [
          'RELEASE_VERSION=${nextRelease.version} node scripts/sync-version.mjs',
          'npx nx run obsidian-vps-publish:build --skip-nx-cache',
          'npm run package:plugin',
          `cd dist && zip -r ${PLUGIN_ID}.zip ${PLUGIN_ID}`,
        ].join(' && '),
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
          'manifest.json',
          'manifest-beta.json',
          'apps/obsidian-vps-publish/manifest.json',
          'apps/obsidian-vps-publish/versions.json',
          'apps/obsidian-vps-publish/package.json',
          'libs/core-application/package.json',
          'libs/core-domain/package.json',
        ],
        message: 'chore(release): ${nextRelease.version} [skip ci]\n\n${nextRelease.notes}',
      },
    ],
    [
      '@semantic-release/github',
      {
        assets: [
          { path: `dist/${PLUGIN_ID}.zip`, label: 'Plugin bundle' },
          { path: `dist/${PLUGIN_ID}/main.js`, label: 'main.js' },
          { path: `dist/${PLUGIN_ID}/manifest.json`, label: 'manifest.json' },
          { path: `dist/${PLUGIN_ID}/styles.css`, label: 'styles.css' },
        ],
      },
    ],
  ],
};
