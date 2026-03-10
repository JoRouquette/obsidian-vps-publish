#!/usr/bin/env node
/**
 * E2E Test Setup Script
 *
 * This script prepares the environment for E2E tests:
 * 1. Creates temporary content and assets directories
 * 2. Copies E2E fixtures to the temp directories
 * 3. Creates a test image asset
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
  // Minimal valid PNG: 1x1 red pixel
  const pngData = Buffer.from([
    0x89,
    0x50,
    0x4e,
    0x47,
    0x0d,
    0x0a,
    0x1a,
    0x0a, // PNG signature
    0x00,
    0x00,
    0x00,
    0x0d,
    0x49,
    0x48,
    0x44,
    0x52, // IHDR chunk
    0x00,
    0x00,
    0x00,
    0x01,
    0x00,
    0x00,
    0x00,
    0x01, // 1x1
    0x08,
    0x02,
    0x00,
    0x00,
    0x00,
    0x90,
    0x77,
    0x53, // 8-bit RGB
    0xde,
    0x00,
    0x00,
    0x00,
    0x0c,
    0x49,
    0x44,
    0x41, // IDAT chunk
    0x54,
    0x08,
    0xd7,
    0x63,
    0xf8,
    0xcf,
    0xc0,
    0x00, // compressed data (red)
    0x00,
    0x00,
    0x03,
    0x00,
    0x01,
    0x00,
    0x18,
    0xdd,
    0x8d,
    0xb4,
    0x00,
    0x00,
    0x00,
    0x00,
    0x49,
    0x45, // IEND chunk
    0x4e,
    0x44,
    0xae,
    0x42,
    0x60,
    0x82,
  ]);
  return pngData;
}

/**
 * Copy directory recursively
 */
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

/**
 * Clean and recreate directories
 */
function prepareDirectories() {
  console.log('📁 Preparing E2E test directories...');

  // Clean existing directories
  if (fs.existsSync(E2E_CONTENT_DIR)) {
    fs.rmSync(E2E_CONTENT_DIR, { recursive: true, force: true });
  }
  if (fs.existsSync(E2E_ASSETS_DIR)) {
    fs.rmSync(E2E_ASSETS_DIR, { recursive: true, force: true });
  }

  // Create fresh directories
  fs.mkdirSync(E2E_CONTENT_DIR, { recursive: true });
  fs.mkdirSync(E2E_ASSETS_DIR, { recursive: true });
}

/**
 * Copy fixtures to temp directories
 */
function copyFixtures() {
  console.log('📋 Copying E2E fixtures...');

  const fixturesContent = path.join(FIXTURES_DIR, 'content');
  const manifestFile = path.join(FIXTURES_DIR, 'manifest.json');

  // Copy content files
  if (fs.existsSync(fixturesContent)) {
    copyDirSync(fixturesContent, E2E_CONTENT_DIR);
    console.log(`  ✓ Copied content from ${fixturesContent}`);
  } else {
    console.warn(`  ⚠ Content directory not found: ${fixturesContent}`);
  }

  // Copy manifest
  if (fs.existsSync(manifestFile)) {
    fs.copyFileSync(manifestFile, path.join(E2E_CONTENT_DIR, '_manifest.json'));
    console.log(`  ✓ Copied manifest`);
  } else {
    console.warn(`  ⚠ Manifest not found: ${manifestFile}`);
  }
}

/**
 * Create test assets
 */
function createAssets() {
  console.log('🖼️  Creating test assets...');

  // Create test image
  const testImage = createTestImage();
  fs.writeFileSync(path.join(E2E_ASSETS_DIR, 'test-image.png'), testImage);
  console.log('  ✓ Created test-image.png');

  // Create gallery images (same test image)
  fs.writeFileSync(path.join(E2E_ASSETS_DIR, 'gallery-1.jpg'), testImage);
  fs.writeFileSync(path.join(E2E_ASSETS_DIR, 'gallery-2.jpg'), testImage);
  console.log('  ✓ Created gallery images');

  // Create a dummy PDF (text file with .pdf extension for simplicity)
  fs.writeFileSync(
    path.join(E2E_ASSETS_DIR, 'test-document.pdf'),
    '%PDF-1.4\n1 0 obj\n<<>>\nendobj\ntrailer\n<<>>\n%%EOF'
  );
  console.log('  ✓ Created test-document.pdf');
}

/**
 * Main setup function - runs the full setup
 */
async function setup() {
  console.log('🚀 Setting up E2E test environment\n');

  try {
    prepareDirectories();
    copyFixtures();
    createAssets();

    console.log('\n✅ E2E setup complete!');
    console.log('\nEnvironment variables for E2E tests:');
    console.log(`  CONTENT_ROOT=${E2E_CONTENT_DIR}`);
    console.log(`  ASSETS_ROOT=${E2E_ASSETS_DIR}`);
    console.log(`  NODE_ENV=test`);
    console.log(`  API_KEY=e2e-test-key`);
    console.log(`  SSR_ENABLED=false`);
  } catch (error) {
    console.error('❌ E2E setup failed:', error.message);
    throw error;
  }
}

/**
 * Playwright globalSetup entry point
 * @see https://playwright.dev/docs/test-global-setup-teardown
 */
export default async function globalSetup() {
  await setup();
}

// Run directly if not imported
const isMainModule =
  process.argv[1] && fileURLToPath(import.meta.url) === path.resolve(process.argv[1]);
if (isMainModule) {
  setup().catch(() => process.exit(1));
}
