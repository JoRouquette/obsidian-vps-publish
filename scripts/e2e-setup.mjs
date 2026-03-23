#!/usr/bin/env node
/**
 * E2E Test Setup Script
 *
 * This script prepares the environment for E2E tests:
 * 1. Creates temporary content and assets directories
 * 2. Copies E2E fixtures to the temp directories
 * 3. Creates test assets
 *
 * Can be run standalone: node scripts/e2e-setup.mjs
 * Or as Playwright globalSetup (exports default function)
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const rootDir = path.resolve(__dirname, '..');

const E2E_CONTENT_DIR = path.join(rootDir, 'tmp', 'e2e-content');
const E2E_ASSETS_DIR = path.join(rootDir, 'tmp', 'e2e-assets');
const FIXTURES_DIR = path.join(rootDir, 'apps', 'site', 'e2e', 'fixtures');

/**
 * Creates a simple 1x1 PNG image for testing
 * This is a valid minimal PNG: 1x1 red pixel
 */
function createTestImage() {
  const pngData = Buffer.from([
    0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0x00, 0x00, 0x00, 0x0d, 0x49, 0x48, 0x44, 0x52,
    0x00, 0x00, 0x00, 0x01, 0x00, 0x00, 0x00, 0x01, 0x08, 0x02, 0x00, 0x00, 0x00, 0x90, 0x77, 0x53,
    0xde, 0x00, 0x00, 0x00, 0x0c, 0x49, 0x44, 0x41, 0x54, 0x08, 0xd7, 0x63, 0xf8, 0xcf, 0xc0, 0x00,
    0x00, 0x03, 0x00, 0x01, 0x00, 0x18, 0xdd, 0x8d, 0xb4, 0x00, 0x00, 0x00, 0x00, 0x49, 0x45, 0x4e,
    0x44, 0xae, 0x42, 0x60, 0x82,
  ]);
  return pngData;
}

function copyDirSync(src, dest) {
  fs.mkdirSync(dest, { recursive: true });
  const entries = fs.readdirSync(src, { withFileTypes: true });

  for (const entry of entries) {
    const srcPath = path.join(src, entry.name);
    const destPath = path.join(dest, entry.name);

    if (entry.isDirectory()) {
      copyDirSync(srcPath, destPath);
    } else {
      fs.copyFileSync(srcPath, destPath);
    }
  }
}

function prepareDirectories() {
  console.log('Preparing E2E test directories...');

  if (fs.existsSync(E2E_CONTENT_DIR)) {
    fs.rmSync(E2E_CONTENT_DIR, { recursive: true, force: true });
  }
  if (fs.existsSync(E2E_ASSETS_DIR)) {
    fs.rmSync(E2E_ASSETS_DIR, { recursive: true, force: true });
  }

  fs.mkdirSync(E2E_CONTENT_DIR, { recursive: true });
  fs.mkdirSync(E2E_ASSETS_DIR, { recursive: true });
}

function copyFixtures() {
  console.log('Copying E2E fixtures...');

  const fixturesContent = path.join(FIXTURES_DIR, 'content');
  const manifestFile = path.join(FIXTURES_DIR, 'manifest.json');

  if (fs.existsSync(fixturesContent)) {
    copyDirSync(fixturesContent, E2E_CONTENT_DIR);
    console.log(`  copied content from ${fixturesContent}`);
  } else {
    console.warn(`  content directory not found: ${fixturesContent}`);
  }

  if (fs.existsSync(manifestFile)) {
    fs.copyFileSync(manifestFile, path.join(E2E_CONTENT_DIR, '_manifest.json'));
    console.log('  copied manifest');
  } else {
    console.warn(`  manifest not found: ${manifestFile}`);
  }
}

function createAssets() {
  console.log('Creating E2E assets...');

  const testImage = createTestImage();
  fs.writeFileSync(path.join(E2E_ASSETS_DIR, 'test-image.png'), testImage);
  console.log('  created test-image.png');

  fs.writeFileSync(path.join(E2E_ASSETS_DIR, 'gallery-1.jpg'), testImage);
  fs.writeFileSync(path.join(E2E_ASSETS_DIR, 'gallery-2.jpg'), testImage);
  console.log('  created gallery images');

  fs.writeFileSync(
    path.join(E2E_ASSETS_DIR, 'debug-map.svg'),
    `<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="800" viewBox="0 0 1200 800">
      <rect width="1200" height="800" fill="#e8f0ff"/>
      <rect x="50" y="50" width="1100" height="700" fill="#c14343" opacity="0.18" stroke="#c14343" stroke-width="8"/>
      <circle cx="600" cy="400" r="160" fill="#0055aa" opacity="0.25"/>
      <text x="600" y="390" text-anchor="middle" font-size="72" fill="#18222c" font-family="Arial">Leaflet Debug Map</text>
      <text x="600" y="470" text-anchor="middle" font-size="36" fill="#18222c" font-family="Arial">1200 x 800</text>
    </svg>`
  );
  console.log('  created debug-map.svg');

  fs.writeFileSync(
    path.join(E2E_ASSETS_DIR, 'test-document.pdf'),
    '%PDF-1.4\n1 0 obj\n<<>>\nendobj\ntrailer\n<<>>\n%%EOF'
  );
  console.log('  created test-document.pdf');
}

async function setup() {
  console.log('Setting up E2E test environment\n');

  try {
    prepareDirectories();
    copyFixtures();
    createAssets();

    console.log('\nE2E setup complete');
    console.log('\nEnvironment variables for E2E tests:');
    console.log(`  CONTENT_ROOT=${E2E_CONTENT_DIR}`);
    console.log(`  ASSETS_ROOT=${E2E_ASSETS_DIR}`);
    console.log('  NODE_ENV=test');
    console.log('  API_KEY=e2e-test-key');
    console.log('  SSR_ENABLED=false');
  } catch (error) {
    console.error('E2E setup failed:', error.message);
    throw error;
  }
}

export default async function globalSetup() {
  await setup();
}

const isMainModule =
  process.argv[1] && fileURLToPath(import.meta.url) === path.resolve(process.argv[1]);
if (isMainModule) {
  setup().catch(() => process.exit(1));
}
