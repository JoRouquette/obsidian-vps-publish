const pluginManifest = require('./manifest.json');
const PLUGIN_ID = pluginManifest.id;

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
          'RELEASE_VERSION=${nextRelease.version} node scripts/sync-version.mjs && ' +
          "node -e \"const fs=require('fs');const path=require('path');const root=process.cwd();const manifestPath=path.join(root,'manifest.json');const versionsPath=path.join(root,'apps','obsidian-vps-publish','versions.json');const manifest=JSON.parse(fs.readFileSync(manifestPath,'utf8'));manifest.version='${nextRelease.version}';fs.writeFileSync(manifestPath,JSON.stringify(manifest,null,2)+'\\n');let versions={};if(fs.existsSync(versionsPath))versions=JSON.parse(fs.readFileSync(versionsPath,'utf8'));if(manifest.minAppVersion){versions[manifest.version]=manifest.minAppVersion;fs.writeFileSync(versionsPath,JSON.stringify(versions,null,2)+'\\n');}\" && " +
          'npx nx run obsidian-vps-publish:build --skip-nx-cache && ' +
          'npm run package:plugin && cd dist && zip -r ' +
          `${PLUGIN_ID}.zip ${PLUGIN_ID}`,
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
          'apps/obsidian-vps-publish/versions.json',
        ],
        message: 'chore(release): ${nextRelease.version} [skip ci]\n\n${nextRelease.notes}',
      },
    ],
    [
      '@semantic-release/github',
      {
        assets: [{ path: `dist/${PLUGIN_ID}.zip`, label: 'Plugin bundle' }],
      },
    ],
    ['@semantic-release/npm', { npmPublish: false }],
  ],
};
