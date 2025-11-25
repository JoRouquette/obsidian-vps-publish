import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const PLUGIN_DIR_NAME = 'publish-to-personal-vps';
const ROOT_DIR = path.resolve(path.join(path.dirname(fileURLToPath(import.meta.url)), '..'));

const mainJs = path.join(ROOT_DIR, 'dist', 'apps', PLUGIN_DIR_NAME, 'main.js');
const manifest = path.join(ROOT_DIR, 'manifest.json');
const styles = path.join(ROOT_DIR, 'styles.css');
const versions = path.join(ROOT_DIR, 'versions.json');
const outDir = path.join(ROOT_DIR, 'dist', PLUGIN_DIR_NAME);

const ensureFile = (filePath, name) => {
  if (!fs.existsSync(filePath)) {
    throw new Error(`${name} not found at: ${filePath}`);
  }
};

const copyIfExists = (src, dest) => {
  if (fs.existsSync(src)) {
    fs.copyFileSync(src, dest);
  }
};

console.log(`[package-plugin] Packaging from ${ROOT_DIR}`);
console.log(` - main: ${mainJs}`);
console.log(` - manifest: ${manifest}`);
console.log(` - styles: ${styles}`);

ensureFile(mainJs, 'main.js');
ensureFile(manifest, 'manifest.json');

fs.rmSync(outDir, { recursive: true, force: true });
fs.mkdirSync(outDir, { recursive: true });

fs.copyFileSync(mainJs, path.join(outDir, 'main.js'));
fs.copyFileSync(manifest, path.join(outDir, 'manifest.json'));
copyIfExists(styles, path.join(outDir, 'styles.css'));
copyIfExists(versions, path.join(outDir, 'versions.json'));

console.log(`[package-plugin] Packaged to ${outDir}`);
