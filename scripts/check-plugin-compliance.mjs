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
const WORKSPACE_ROOT = path.resolve(__dirname, '..');
const PLUGIN_ROOT = path.join(WORKSPACE_ROOT, 'apps', 'obsidian-vps-publish');
const MANIFEST_PATH = path.join(WORKSPACE_ROOT, 'manifest.json'); // single source of truth
const README_PATH = path.join(WORKSPACE_ROOT, 'README.md');
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
    const packagedDir = path.join(WORKSPACE_ROOT, 'dist', manifest.id);
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

// Check for hardcoded UI strings in plugin source
console.log('\\nChecking for hardcoded UI strings in plugin source...');
const PLUGIN_SRC = path.join(PLUGIN_ROOT, 'src');
const hardcodedStringsErrors = checkHardcodedStrings(PLUGIN_SRC);
if (hardcodedStringsErrors.length > 0) {
  errors.push(...hardcodedStringsErrors);
}

if (errors.length) {
  console.error('\\nCompliance check failed:');
  errors.forEach((e) => console.error(` - ${e}`));
} else {
  console.log('\\nManifest and README present with required keys.');
  console.log('No hardcoded UI strings detected.');
}

if (warnings.length) {
  console.warn('\\nWarnings:');
  warnings.forEach((w) => console.warn(` - ${w}`));
}

if (errors.length) {
  process.exitCode = 1;
}

/**
 * Check for hardcoded UI strings in plugin source files
 * @param {string} dir - Directory to scan
 * @returns {string[]} Array of error messages
 */
function checkHardcodedStrings(dir) {
  const errors = [];
  const forbiddenPatterns = [
    {
      pattern: /new\s+Notice\s*\(\s*["'`][^"'`]+["'`]/g,
      message: 'Hardcoded string in Notice constructor',
      // Allow Notice('', ...) for empty progress notices
      allowPattern: /new\s+Notice\s*\(\s*["'`]["'`]/,
    },
    {
      pattern: /\.setPlaceholder\s*\(\s*["'`][^"'`]+["'`]/g,
      message: 'Hardcoded placeholder text',
    },
    {
      pattern: /\.setName\s*\(\s*["'`][^"'`]{10,}["'`]/g,
      message: 'Hardcoded setting name (consider i18n)',
      // Allow template strings containing translate() calls
      allowPattern: /\.setName\s*\(\s*`[^`]*translate\([^)]+\)[^`]*`/,
    },
    {
      pattern: /\.setDesc\s*\(\s*["'`][^"'`]{20,}["'`]/g,
      message: 'Hardcoded setting description (consider i18n)',
    },
  ];

  function scanFile(filePath) {
    const content = fs.readFileSync(filePath, 'utf8');
    const relativePath = path.relative(PLUGIN_ROOT, filePath);

    // Skip test files and i18n files themselves
    if (filePath.includes('/_tests/') || filePath.includes('/i18n/')) {
      return;
    }

    forbiddenPatterns.forEach(({ pattern, message, allowPattern }) => {
      const matches = content.matchAll(pattern);
      for (const match of matches) {
        // Skip if allow pattern matches (e.g., empty strings)
        if (allowPattern && allowPattern.test(match[0])) {
          continue;
        }

        // Skip template strings that contain translate() calls (extract a larger context)
        const matchStart = match.index;
        const matchEnd = matchStart + match[0].length;
        // Look for the closing parenthesis of setName/setDesc/etc. (up to 200 chars ahead)
        const contextEnd = Math.min(matchEnd + 200, content.length);
        const fullContext = content.substring(matchStart, contextEnd);
        if (/translate\s*\(/.test(fullContext)) {
          continue;
        }

        const lineNumber = content.substring(0, match.index).split('\n').length;
        errors.push(`${relativePath}:${lineNumber} - ${message}: ${match[0].substring(0, 60)}...`);
      }
    });
  }

  function scanDir(dir) {
    if (!fs.existsSync(dir)) return;

    const entries = fs.readdirSync(dir, { withFileTypes: true });
    for (const entry of entries) {
      const fullPath = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        scanDir(fullPath);
      } else if (entry.isFile() && entry.name.endsWith('.ts') && !entry.name.endsWith('.d.ts')) {
        scanFile(fullPath);
      }
    }
  }

  scanDir(dir);
  return errors;
}
