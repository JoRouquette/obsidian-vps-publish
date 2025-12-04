import fs from 'node:fs';
import path from 'node:path';

const next = process.env.RELEASE_VERSION;
const rootDir = process.cwd();

if (!next) {
  throw new Error('RELEASE_VERSION manquant');
}

const pkgFiles = [
  'package.json',
  'apps/obsidian-vps-publish/package.json',
  'libs/core-application/package.json',
  'libs/core-domain/package.json',
];
const lockFiles = ['package-lock.json'];
const versionFiles = ['apps/site/src/version.ts', 'apps/node/src/version.ts'];
const manifestPath = 'manifest.json';
const versionsPath = 'apps/obsidian-vps-publish/versions.json';

const stringifyJson = (value) => JSON.stringify(value, null, 2) + '\n';

const readJson = (relativePath, { required = true } = {}) => {
  const filePath = path.join(rootDir, relativePath);
  if (!fs.existsSync(filePath)) {
    if (required) throw new Error(`Fichier introuvable: ${relativePath}`);
    return null;
  }

  try {
    return {
      filePath,
      value: JSON.parse(fs.readFileSync(filePath, 'utf8')),
    };
  } catch (error) {
    throw new Error(`JSON invalide dans ${relativePath}: ${error.message}`);
  }
};

const updateJson = (relativePath, updater, options = {}) => {
  const parsed = readJson(relativePath, options);
  if (!parsed) return null;

  const updated = updater(parsed.value);
  fs.writeFileSync(parsed.filePath, stringifyJson(updated));
  console.log(`updated ${relativePath} -> ${next}`);
  return updated;
};

const writeVersionFile = (relativePath) => {
  const filePath = path.join(rootDir, relativePath);
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, `export const APP_VERSION = '${next}';\n`);
  console.log(`updated ${relativePath} -> ${next}`);
};

pkgFiles.forEach((file) => updateJson(file, (json) => ({ ...json, version: next })));

lockFiles.forEach((file) =>
  updateJson(file, (json) => {
    const updated = { ...json, version: next };
    if (updated.packages?.['']) {
      updated.packages[''] = { ...updated.packages[''], version: next };
    }
    return updated;
  })
);

const manifest = updateJson(
  manifestPath,
  (json) => ({
    ...json,
    version: next,
  }),
  { required: true }
);

if (!manifest?.minAppVersion) {
  throw new Error(`minAppVersion manquant dans ${manifestPath}`);
}

versionFiles.forEach(writeVersionFile);

updateJson(
  versionsPath,
  (json) => {
    if (json === null || Array.isArray(json) || typeof json !== 'object') {
      throw new Error(`${versionsPath} doit etre un objet JSON { [version]: minAppVersion }`);
    }

    return { ...json, [manifest.version]: manifest.minAppVersion };
  },
  { required: true }
);
