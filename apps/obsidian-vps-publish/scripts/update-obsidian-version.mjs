import { readFileSync, writeFileSync, existsSync } from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const ROOT = path.resolve(__dirname, '..');

const manifestPath = path.join(ROOT, 'manifest.json');
const versionsPath = path.join(ROOT, 'versions.json');

const newVersion = process.argv[2];

if (!newVersion) {
  console.error('Usage: node scripts/update-obsidian-version.mjs <version>');
  process.exit(1);
}

function readJson(file) {
  return JSON.parse(readFileSync(file, 'utf8'));
}

function writeJson(file, value) {
  writeFileSync(file, JSON.stringify(value, null, 2) + '\n', 'utf8');
}

if (!existsSync(manifestPath)) {
  console.error(`manifest.json introuvable à la racine: ${manifestPath}`);
  process.exit(1);
}

const manifest = readJson(manifestPath);
manifest.version = newVersion;
writeJson(manifestPath, manifest);

let versions = {};
if (existsSync(versionsPath)) {
  versions = readJson(versionsPath);
}

const minAppVersion = manifest.minAppVersion;

if (minAppVersion) {
  versions[newVersion] = minAppVersion;
  writeJson(versionsPath, versions);
} else {
  console.warn(
    'minAppVersion manquant dans manifest.json, versions.json non mis à jour.'
  );
}

console.log(`✓ Version mise à jour à ${newVersion}
  - manifest.json (racine)
  - versions.json ${
    minAppVersion ? `(minAppVersion = ${minAppVersion})` : '(inchangé)'
  }`);
