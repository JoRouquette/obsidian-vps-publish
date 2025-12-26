#!/usr/bin/env node

/**
 * Quick validation script for Artillery payload generators
 * Tests that generators produce DTO-compliant payloads
 */

const noteGenerator = require('../tools/load-tests/artillery/helpers/note-generator');
const assetGenerator = require('../tools/load-tests/artillery/helpers/asset-generator');

console.log('🧪 Testing Artillery Payload Generators\n');

// Mock userContext for Artillery
const mockUserContext = {
  vars: {
    $loopCount: 0,
  },
};

// Mock events
const mockEvents = {};

// Test note generation
console.log('1. Testing Note Generator...');
process.env.NOTES_COUNT = '5';
process.env.SEED = '12345';

noteGenerator.generateNotes(mockUserContext, mockEvents, (err) => {
  if (err) {
    console.error('❌ Note generation failed:', err);
    process.exit(1);
  }

  const notes = mockUserContext.vars.notes;
  const count = mockUserContext.vars.notesCount;

  if (!notes || notes.length !== 5) {
    console.error('❌ Expected 5 notes, got:', notes?.length);
    process.exit(1);
  }

  // Validate first note structure (DTO compliance)
  const firstNote = notes[0];
  const requiredFields = [
    'noteId',
    'title',
    'vaultPath',
    'relativePath',
    'content',
    'frontmatter',
    'folderConfig',
    'publishedAt',
    'routing',
    'eligibility',
  ];

  for (const field of requiredFields) {
    if (!(field in firstNote)) {
      console.error(`❌ Missing required field: ${field}`);
      process.exit(1);
    }
  }

  // Check frontmatter structure
  if (!firstNote.frontmatter.flat || !firstNote.frontmatter.nested || !firstNote.frontmatter.tags) {
    console.error('❌ Invalid frontmatter structure');
    process.exit(1);
  }

  // Check routing structure
  if (!firstNote.routing.slug || !firstNote.routing.path || !firstNote.routing.routeBase) {
    console.error('❌ Invalid routing structure');
    process.exit(1);
  }

  console.log(`✅ Generated ${count} notes with correct DTO structure`);
  console.log(
    `   Note sizes: ${notes.map((n) => `${(n.content.length / 1024).toFixed(1)}KB`).join(', ')}`
  );
});

// Test cleanup rules generation
console.log('\n2. Testing Cleanup Rules Generator...');
noteGenerator.generateCleanupRules(mockUserContext, mockEvents, (err) => {
  if (err) {
    console.error('❌ Cleanup rules generation failed:', err);
    process.exit(1);
  }

  const rules = mockUserContext.vars.cleanupRules;
  if (!rules || !Array.isArray(rules)) {
    console.error('❌ Cleanup rules not generated');
    process.exit(1);
  }

  console.log(`✅ Generated ${rules.length} cleanup rule(s)`);
});

// Test asset generation
console.log('\n3. Testing Asset Generator...');
process.env.ASSETS_COUNT = '3';

assetGenerator.generateAssets(mockUserContext, mockEvents, (err) => {
  if (err) {
    console.error('❌ Asset generation failed:', err);
    process.exit(1);
  }

  const assets = mockUserContext.vars.assets;
  const count = mockUserContext.vars.assetsCount;

  if (!assets || assets.length !== 3) {
    console.error('❌ Expected 3 assets, got:', assets?.length);
    process.exit(1);
  }

  // Validate first asset structure (DTO compliance)
  const firstAsset = assets[0];
  const requiredFields = ['relativePath', 'vaultPath', 'fileName', 'mimeType', 'contentBase64'];

  for (const field of requiredFields) {
    if (!(field in firstAsset)) {
      console.error(`❌ Missing required field: ${field}`);
      process.exit(1);
    }
  }

  // Check base64 content
  if (!firstAsset.contentBase64 || firstAsset.contentBase64.length === 0) {
    console.error('❌ Asset has no base64 content');
    process.exit(1);
  }

  console.log(`✅ Generated ${count} assets with correct DTO structure`);
  console.log(
    `   Asset sizes: ${assets.map((a) => `${(a.contentBase64.length / 1024).toFixed(0)}KB`).join(', ')}`
  );
});

// Test reproducibility
console.log('\n4. Testing Reproducibility (SEED)...');
const seed1Context = { vars: { $loopCount: 0 } };
const seed2Context = { vars: { $loopCount: 0 } };
process.env.SEED = '99999';
process.env.NOTES_COUNT = '2';

noteGenerator.generateNotes(seed1Context, mockEvents, (err) => {
  if (err) {
    console.error('❌ First seeded generation failed:', err);
    process.exit(1);
  }

  noteGenerator.generateNotes(seed2Context, mockEvents, (err) => {
    if (err) {
      console.error('❌ Second seeded generation failed:', err);
      process.exit(1);
    }

    const notes1 = seed1Context.vars.notes;
    const notes2 = seed2Context.vars.notes;

    // Compare content lengths (should be identical with same seed)
    if (notes1[0].content.length !== notes2[0].content.length) {
      console.error('❌ Seeded generation not reproducible');
      process.exit(1);
    }

    console.log('✅ Seeded generation is reproducible');
  });
});

// Wait a bit for all async operations
setTimeout(() => {
  console.log('\n✨ All payload generator tests passed!\n');
  console.log('Next steps:');
  console.log('  1. Configure .env.artillery with your API_KEY');
  console.log('  2. Start the API: npm run start node');
  console.log('  3. Run quick test: npm run load:api:quick');
}, 100);
