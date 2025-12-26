#!/usr/bin/env node

/**
 * Synthetic Vault Generator
 * Generates a test vault with configurable number of notes and assets for performance testing
 *
 * Usage:
 *   node scripts/generate-test-vault.mjs --notes 500 --assets 100 --output test-files/synthetic-vault
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Parse command line arguments
function parseArgs() {
  const args = {
    notes: 100,
    assets: 50,
    output: path.join(__dirname, '../test-files/synthetic-vault'),
  };

  for (let i = 2; i < process.argv.length; i += 2) {
    const key = process.argv[i].replace(/^--/, '');
    const value = process.argv[i + 1];

    if (key === 'notes') args.notes = parseInt(value, 10);
    else if (key === 'assets') args.assets = parseInt(value, 10);
    else if (key === 'output') args.output = value;
  }

  return args;
}

// Generate random string for content
function randomText(minWords = 50, maxWords = 200) {
  const words = [
    'lorem',
    'ipsum',
    'dolor',
    'sit',
    'amet',
    'consectetur',
    'adipiscing',
    'elit',
    'sed',
    'do',
    'eiusmod',
    'tempor',
    'incididunt',
    'labore',
    'dolore',
    'magna',
    'aliqua',
    'enim',
    'minim',
    'veniam',
    'quis',
    'nostrud',
    'exercitation',
    'ullamco',
    'laboris',
    'nisi',
    'aliquip',
    'commodo',
    'consequat',
    'duis',
    'aute',
    'irure',
    'reprehenderit',
    'voluptate',
    'velit',
    'esse',
    'cillum',
    'fugiat',
    'nulla',
    'pariatur',
    'excepteur',
    'sint',
    'occaecat',
    'cupidatat',
    'proident',
    'sunt',
    'culpa',
    'qui',
    'officia',
    'deserunt',
    'mollit',
    'anim',
  ];

  const wordCount = Math.floor(Math.random() * (maxWords - minWords)) + minWords;
  const result = [];

  for (let i = 0; i < wordCount; i++) {
    result.push(words[Math.floor(Math.random() * words.length)]);
  }

  return result.join(' ');
}

// Generate frontmatter
function generateFrontmatter(noteIndex) {
  const shouldPublish = Math.random() > 0.1; // 90% publishable
  const tags = [];
  const tagCount = Math.floor(Math.random() * 4);

  for (let i = 0; i < tagCount; i++) {
    tags.push(`tag${Math.floor(Math.random() * 10)}`);
  }

  const fm = ['---'];
  fm.push(`title: "Test Note ${noteIndex}"`);

  if (!shouldPublish) {
    fm.push('publish: false');
  }

  if (tags.length > 0) {
    fm.push(`tags: [${tags.join(', ')}]`);
  }

  fm.push(`date: ${new Date().toISOString()}`);
  fm.push('---');
  fm.push('');

  return fm.join('\n');
}

// Generate note content with optional assets
function generateNoteContent(noteIndex, hasAssets = false, assetCount = 0) {
  const lines = [];

  // Frontmatter
  lines.push(generateFrontmatter(noteIndex));

  // Title
  lines.push(`# Test Note ${noteIndex}`);
  lines.push('');

  // Introduction
  lines.push(randomText(30, 80));
  lines.push('');

  // Add some sections
  const sectionCount = Math.floor(Math.random() * 3) + 1;
  for (let i = 0; i < sectionCount; i++) {
    lines.push(`## Section ${i + 1}`);
    lines.push('');
    lines.push(randomText(50, 150));
    lines.push('');

    // Add wikilinks (internal links)
    if (Math.random() > 0.5) {
      const targetNote = Math.floor(Math.random() * 500) + 1;
      lines.push(`See also: [[Test Note ${targetNote}]]`);
      lines.push('');
    }
  }

  // Add assets if requested
  if (hasAssets && assetCount > 0) {
    lines.push('## Images');
    lines.push('');
    for (let i = 0; i < assetCount; i++) {
      const assetId = Math.floor(Math.random() * 1000);
      lines.push(`![[test-image-${assetId}.png]]`);
      lines.push('');
    }
  }

  // Add dataview block occasionally
  if (Math.random() > 0.8) {
    lines.push('## Dataview');
    lines.push('');
    lines.push('```dataview');
    lines.push('TABLE file.name, file.mtime');
    lines.push('FROM "Notes"');
    lines.push('LIMIT 10');
    lines.push('```');
    lines.push('');
  }

  return lines.join('\n');
}

// Generate a dummy image file (1x1 PNG)
function generateDummyImage() {
  // Minimal 1x1 transparent PNG (base64)
  const base64PNG =
    'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==';
  return Buffer.from(base64PNG, 'base64');
}

// Main generator function
function generateVault(config) {
  const { notes: noteCount, assets: assetCount, output: outputPath } = config;

  console.log('🔧 Generating synthetic vault...');
  console.log(`   Notes: ${noteCount}`);
  console.log(`   Assets: ${assetCount}`);
  console.log(`   Output: ${outputPath}`);

  // Create output directory
  fs.mkdirSync(outputPath, { recursive: true });

  // Create folders structure
  const notesDir = path.join(outputPath, 'Notes');
  const assetsDir = path.join(outputPath, 'assets');

  fs.mkdirSync(notesDir, { recursive: true });
  fs.mkdirSync(assetsDir, { recursive: true });

  // Generate notes
  console.log('📝 Generating notes...');
  const notesWithAssets = Math.min(assetCount, noteCount);

  for (let i = 1; i <= noteCount; i++) {
    const hasAssets = i <= notesWithAssets;
    const noteAssetCount = hasAssets ? Math.floor(Math.random() * 3) + 1 : 0;

    const content = generateNoteContent(i, hasAssets, noteAssetCount);
    const fileName = `Test Note ${i}.md`;
    const filePath = path.join(notesDir, fileName);

    fs.writeFileSync(filePath, content, 'utf8');

    if (i % 50 === 0) {
      console.log(`   Generated ${i}/${noteCount} notes...`);
    }
  }

  console.log(`✅ Generated ${noteCount} notes`);

  // Generate assets
  console.log('🖼️  Generating assets...');
  const imageBuffer = generateDummyImage();

  for (let i = 0; i < assetCount; i++) {
    const fileName = `test-image-${i}.png`;
    const filePath = path.join(assetsDir, fileName);
    fs.writeFileSync(filePath, imageBuffer);

    if ((i + 1) % 50 === 0) {
      console.log(`   Generated ${i + 1}/${assetCount} assets...`);
    }
  }

  console.log(`✅ Generated ${assetCount} assets`);

  // Generate README
  const readme = [
    '# Synthetic Test Vault',
    '',
    'This vault was generated for performance testing.',
    '',
    `- **Notes**: ${noteCount}`,
    `- **Assets**: ${assetCount}`,
    `- **Generated**: ${new Date().toISOString()}`,
    '',
    '## Structure',
    '',
    '- `Notes/`: Contains all test notes',
    '- `assets/`: Contains dummy image assets',
    '',
    '## Usage',
    '',
    '1. Open this folder as an Obsidian vault',
    '2. Configure the VPS Publish plugin',
    '3. Run a full publish to test performance',
    '',
  ].join('\n');

  fs.writeFileSync(path.join(outputPath, 'README.md'), readme, 'utf8');

  console.log('');
  console.log('✨ Vault generation complete!');
  console.log(`📂 Location: ${outputPath}`);
  console.log('');
  console.log('To use this vault:');
  console.log('  1. Open Obsidian');
  console.log('  2. "Open folder as vault" → select the generated folder');
  console.log('  3. Enable the VPS Publish plugin');
  console.log('  4. Configure VPS settings');
  console.log('  5. Run publish with debug logging enabled');
}

// Run the generator
const config = parseArgs();
generateVault(config);
