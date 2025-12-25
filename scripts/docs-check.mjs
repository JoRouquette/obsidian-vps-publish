#!/usr/bin/env node

/**
 * Documentation Validation Script
 *
 * Enforces documentation structure rules:
 * 1. All .md files must be in allowed locations
 * 2. All .md files (except _archive/) must be referenced in an index README
 * 3. Plugin changes affecting parsing/rendering must update internal help
 *
 * Usage: node scripts/docs-check.mjs
 * Exit code: 0 (success), 1 (validation errors)
 */

import { readFileSync, readdirSync, statSync } from 'fs';
import { join, relative, sep } from 'path';
import { fileURLToPath } from 'url';
import { dirname } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const projectRoot = join(__dirname, '..');

// ANSI colors
const colors = {
  reset: '\x1b[0m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  cyan: '\x1b[36m',
};

function log(message, color = 'reset') {
  console.log(`${colors[color]}${message}${colors.reset}`);
}

function error(message) {
  log(`❌ ERROR: ${message}`, 'red');
}

function warn(message) {
  log(`⚠️  WARNING: ${message}`, 'yellow');
}

function success(message) {
  log(`✅ ${message}`, 'green');
}

function info(message) {
  log(`ℹ️  ${message}`, 'cyan');
}

// -------------------------------------------------------------------
// 1. Check documentation structure compliance
// -------------------------------------------------------------------

/**
 * Get all .md files recursively in a directory
 */
function getAllMarkdownFiles(dir, fileList = []) {
  const files = readdirSync(dir);

  files.forEach((file) => {
    const filePath = join(dir, file);
    const stat = statSync(filePath);

    if (stat.isDirectory()) {
      if (file !== 'node_modules' && file !== '.git' && file !== 'dist' && file !== 'coverage') {
        getAllMarkdownFiles(filePath, fileList);
      }
    } else if (file.endsWith('.md')) {
      fileList.push(filePath);
    }
  });

  return fileList;
}

/**
 * Check if a file is in an allowed location
 */
function isAllowedLocation(filePath) {
  const relativePath = relative(join(projectRoot, 'docs'), filePath);
  const parts = relativePath.split(sep);

  // Root level docs (architecture.md, development.md, etc.) are allowed
  if (parts.length === 1) {
    return true;
  }

  // docs/_archive/ is allowed (non-indexed historical content)
  if (parts[0] === '_archive') {
    return true;
  }

  // docs/site/, docs/api/, docs/plugin/
  if (['site', 'api', 'plugin'].includes(parts[0])) {
    return true;
  }

  // docs/en/ mirror structure
  if (parts[0] === 'en') {
    if (parts.length === 1) {
      return false; // docs/en/ alone not allowed
    }
    if (parts.length === 2) {
      return true; // docs/en/README.md, architecture.md, etc.
    }
    if (['site', 'api', 'plugin'].includes(parts[1])) {
      return true; // docs/en/site/, docs/en/api/, docs/en/plugin/
    }
  }

  return false;
}

function checkStructureCompliance() {
  info('Checking documentation structure compliance...');

  const docsDir = join(projectRoot, 'docs');
  const allMdFiles = getAllMarkdownFiles(docsDir);
  const violations = [];

  allMdFiles.forEach((filePath) => {
    if (!isAllowedLocation(filePath)) {
      violations.push(relative(projectRoot, filePath));
    }
  });

  if (violations.length > 0) {
    error('Documentation structure violations detected:');
    violations.forEach((file) => {
      console.log(`  - ${file}`);
    });
    console.log('');
    console.log('Allowed locations:');
    console.log('  - docs/*.md (root level)');
    console.log('  - docs/site/**/*.md');
    console.log('  - docs/api/**/*.md');
    console.log('  - docs/plugin/**/*.md');
    console.log('  - docs/en/*.md (root level)');
    console.log('  - docs/en/site/**/*.md');
    console.log('  - docs/en/api/**/*.md');
    console.log('  - docs/en/plugin/**/*.md');
    console.log('  - docs/_archive/**/*.md (not indexed)');
    return false;
  }

  success('Documentation structure is compliant.');
  return true;
}

// -------------------------------------------------------------------
// 2. Check that all .md files are referenced in an index README
// -------------------------------------------------------------------

/**
 * Extract all markdown links from a README file
 */
function extractLinksFromReadme(readmePath) {
  try {
    const content = readFileSync(readmePath, 'utf-8');
    const linkRegex = /\[([^\]]+)\]\(([^)]+)\)/g;
    const links = [];
    let match;

    while ((match = linkRegex.exec(content)) !== null) {
      const linkPath = match[2];
      // Filter out external links and anchors
      if (!linkPath.startsWith('http') && !linkPath.startsWith('#')) {
        links.push(linkPath);
      }
    }

    return links;
  } catch (err) {
    return [];
  }
}

/**
 * Resolve relative link to absolute path
 */
function resolveLinkPath(readmePath, link) {
  const readmeDir = dirname(readmePath);
  return join(readmeDir, link).replace(/\\/g, '/');
}

/**
 * Check if all .md files are referenced
 */
function checkIndexCompleteness() {
  info('Checking that all .md files are referenced in index READMEs...');

  const docsDir = join(projectRoot, 'docs');
  const allMdFiles = getAllMarkdownFiles(docsDir)
    .map((f) => f.replace(/\\/g, '/'))
    .filter((f) => {
      // Exclude _archive/ (not indexed by design)
      const rel = relative(docsDir, f).replace(/\\/g, '/');
      return !rel.startsWith('_archive/');
    })
    .filter((f) => {
      // Exclude README.md files themselves
      return !f.endsWith('README.md');
    });

  // Find all README.md files
  const readmeFiles = getAllMarkdownFiles(docsDir).filter((f) => f.endsWith('README.md'));

  // Collect all referenced files from all READMEs
  const referencedFiles = new Set();

  readmeFiles.forEach((readmePath) => {
    const links = extractLinksFromReadme(readmePath);
    links.forEach((link) => {
      const resolvedPath = resolveLinkPath(readmePath, link).replace(/\\/g, '/');
      referencedFiles.add(resolvedPath);
    });
  });

  const orphanedFiles = allMdFiles.filter((file) => !referencedFiles.has(file));

  if (orphanedFiles.length > 0) {
    error('Orphaned documentation files detected (not referenced in any README index):');
    orphanedFiles.forEach((file) => {
      console.log(`  - ${relative(projectRoot, file)}`);
    });
    console.log('');
    console.log('Action required:');
    console.log('  1. Add a reference to these files in the appropriate README.md');
    console.log('  2. Or move them to docs/_archive/ if they are obsolete');
    console.log('  3. Or delete them if they are no longer needed');
    return false;
  }

  success('All .md files are properly indexed.');
  return true;
}

// -------------------------------------------------------------------
// 3. Check plugin help sync (if plugin files changed)
// -------------------------------------------------------------------

/**
 * This check is more relevant in CI when we have git history.
 * For now, we just verify that key files exist and are non-empty.
 */
function checkPluginHelpSync() {
  info('Checking plugin help component sync...');

  const localesPath = join(projectRoot, 'apps/obsidian-vps-publish/src/i18n/locales.ts');
  const syntaxesDocPath = join(projectRoot, 'docs/plugin/syntaxes.md');

  try {
    const localesContent = readFileSync(localesPath, 'utf-8');
    const syntaxesContent = readFileSync(syntaxesDocPath, 'utf-8');

    // Basic check: ensure help sections are defined
    if (!localesContent.includes('help:') || !localesContent.includes('sections:')) {
      error('locales.ts is missing help sections definition.');
      return false;
    }

    // Basic check: ensure syntaxes doc mentions key syntaxes
    const requiredSyntaxes = ['wikilinks', 'footnotes', 'dataview', 'leaflet', '^no-publishing'];
    const missingSyntaxes = requiredSyntaxes.filter(
      (syntax) => !syntaxesContent.toLowerCase().includes(syntax.toLowerCase())
    );

    if (missingSyntaxes.length > 0) {
      error('docs/plugin/syntaxes.md is missing key syntaxes:');
      missingSyntaxes.forEach((syntax) => {
        console.log(`  - ${syntax}`);
      });
      return false;
    }

    success('Plugin help component appears synchronized.');
    return true;
  } catch (err) {
    error(`Failed to read plugin files: ${err.message}`);
    return false;
  }
}

// -------------------------------------------------------------------
// Main
// -------------------------------------------------------------------

async function main() {
  log('========================================', 'blue');
  log('  Documentation Validation', 'blue');
  log('========================================', 'blue');
  console.log('');

  const checks = [checkStructureCompliance, checkIndexCompleteness, checkPluginHelpSync];

  let allPassed = true;

  for (const check of checks) {
    const passed = check();
    if (!passed) {
      allPassed = false;
    }
    console.log('');
  }

  if (allPassed) {
    log('========================================', 'green');
    log('  ✅ All documentation checks passed!', 'green');
    log('========================================', 'green');
    process.exit(0);
  } else {
    log('========================================', 'red');
    log('  ❌ Documentation validation failed!', 'red');
    log('========================================', 'red');
    process.exit(1);
  }
}

main();
