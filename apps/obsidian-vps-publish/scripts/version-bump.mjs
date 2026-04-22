import fs from 'node:fs';
import path from 'node:path';

const next = process.env.RELEASE_VERSION;
const rootDir = process.cwd();

if (!next) {
  throw new Error('RELEASE_VERSION is not set');
}

const stringify = (value) => JSON.stringify(value, null, 2) + '\n';

const readJson = (rel) => {
  const abs = path.join(rootDir, rel);
  return { abs, value: JSON.parse(fs.readFileSync(abs, 'utf8')) };
};

const writeJson = (abs, value) => {
  fs.writeFileSync(abs, stringify(value));
  console.log(`updated ${path.relative(rootDir, abs)} → ${next}`);
};

// package.json
const pkg = readJson('package.json');
writeJson(pkg.abs, { ...pkg.value, version: next });

// manifest.json
const manifest = readJson('manifest.json');
if (!manifest.value.minAppVersion) throw new Error('minAppVersion missing in manifest.json');
writeJson(manifest.abs, { ...manifest.value, version: next });

// versions.json
const versions = readJson('versions.json');
writeJson(versions.abs, { ...versions.value, [next]: manifest.value.minAppVersion });
