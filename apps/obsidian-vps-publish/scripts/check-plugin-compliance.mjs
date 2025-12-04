#!/usr/bin/env node
/**
 * Quick compliance check for Obsidian community plugin requirements.
 * - Validates manifest fields and allowed keys.
 * - Ensures README exists.
 * - Ensures versions.json has current version mapping (if present).
 * - Warns if packaged assets are missing.
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const PLUGIN_ROOT = path.resolve(__dirname, '..');
const MANIFEST_PATH = path.join(PLUGIN_ROOT, 'manifest.json');
const README_PATH = path.join(PLUGIN_ROOT, 'README.md');
const VERSIONS_PATH = path.join(PLUGIN_ROOT, 'versions.json');

const requiredKeys = [
  'id',
  'name',
  'description',
  'author',
  'version',
  'minAppVersion',
  'isDesktopOnly',
];
const optionalKeys = ['authorUrl', 'fundingUrl', 'helpUrl'];
const allowedKeys = new Set([...requiredKeys, ...optionalKeys]);
const semverRe = /^\d+\.\d+\.\d+$/;

const errors = [];
const warnings = [];

function readJson(filePath) {
  try {
    return JSON.parse(fs.readFileSync(filePath, 'utf8'));
  } catch (err) {
    errors.push(`Unable to parse JSON: ${filePath} (${err.message})`);
    return null;
  }
}

if (!fs.existsSync(MANIFEST_PATH)) {
  errors.push(`Missing manifest.json at ${MANIFEST_PATH}`);
} else {
  const manifest = readJson(MANIFEST_PATH);
  if (manifest) {
    // Required keys
    requiredKeys.forEach((key) => {
      if (!(key in manifest)) errors.push(`manifest.json missing required key: ${key}`);
    });

    // Allowed keys
    Object.keys(manifest).forEach((key) => {
      if (!allowedKeys.has(key)) warnings.push(`manifest.json has non-standard key: ${key}`);
    });

    // Semver validations
    if (manifest.version && !semverRe.test(manifest.version)) {
      errors.push(`manifest.json version must be semver (x.y.z). Found: ${manifest.version}`);
    }
    if (manifest.minAppVersion && !semverRe.test(manifest.minAppVersion)) {
      errors.push(
        `manifest.json minAppVersion must be semver (x.y.z). Found: ${manifest.minAppVersion}`
      );
    }
    if (typeof manifest.isDesktopOnly !== 'boolean') {
      errors.push('manifest.json isDesktopOnly must be a boolean.');
    }

    // versions.json maintenance (optional but recommended)
    if (fs.existsSync(VERSIONS_PATH)) {
      const versions = readJson(VERSIONS_PATH) || {};
      if (manifest.minAppVersion && manifest.version && versions) {
        if (versions[manifest.version] !== manifest.minAppVersion) {
          warnings.push(
            `versions.json does not map ${manifest.version} -> ${manifest.minAppVersion}; updating.`
          );
          versions[manifest.version] = manifest.minAppVersion;
          fs.writeFileSync(VERSIONS_PATH, JSON.stringify(versions, null, 2) + '\n', 'utf8');
        }
      }
    }

    // Packaged assets check (best-effort)
    const packagedDir = path.resolve(PLUGIN_ROOT, '..', '..', 'dist', manifest.id);
    const packagedMain = path.join(packagedDir, 'main.js');
    const packagedManifest = path.join(packagedDir, 'manifest.json');
    if (!fs.existsSync(packagedMain) || !fs.existsSync(packagedManifest)) {
      warnings.push(
        `Packaged assets not found under dist/${manifest.id}. Run "npm run package:plugin" before release.`
      );
    }
  }
}

if (!fs.existsSync(README_PATH)) {
  errors.push(`Missing README.md at ${README_PATH}`);
}

if (errors.length) {
  console.error('✖ Compliance check failed:');
  errors.forEach((e) => console.error(` - ${e}`));
} else {
  console.log('✔ manifest and README present with required keys.');
}

if (warnings.length) {
  console.warn('⚠ Warnings:');
  warnings.forEach((w) => console.warn(` - ${w}`));
}

if (errors.length) {
  process.exitCode = 1;
}
