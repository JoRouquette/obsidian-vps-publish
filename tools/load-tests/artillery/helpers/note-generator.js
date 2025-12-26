/**
 * Artillery payload generator for DTO-compliant note payloads
 * Generates realistic notes with variable sizes conforming to PublishableNoteDto
 */

const crypto = require('crypto');

/**
 * Size profiles for notes (in KB)
 * small: 1-5 KB (70%)
 * medium: 20-80 KB (25%)
 * large: 200-800 KB (5%)
 */
const SIZE_PROFILES = {
  small: { min: 1, max: 5 },
  medium: { min: 20, max: 80 },
  large: { min: 200, max: 800 },
};

const DISTRIBUTION = {
  small: 0.7,
  medium: 0.25,
  large: 0.05,
};

/**
 * Seeded random number generator for reproducibility
 */
class SeededRandom {
  constructor(seed) {
    this.seed = seed || Date.now();
  }

  next() {
    this.seed = (this.seed * 9301 + 49297) % 233280;
    return this.seed / 233280;
  }

  range(min, max) {
    return Math.floor(this.next() * (max - min + 1)) + min;
  }

  choice(array) {
    return array[this.range(0, array.length - 1)];
  }

  weighted() {
    const rand = this.next();
    if (rand < DISTRIBUTION.small) return 'small';
    if (rand < DISTRIBUTION.small + DISTRIBUTION.medium) return 'medium';
    return 'large';
  }
}

/**
 * Generate markdown content of specific size
 */
function generateMarkdownContent(targetKB, rng) {
  const targetBytes = targetKB * 1024;
  let content = '';

  const paragraphs = [];
  const sentences = [
    'This is a test note for load testing the API.',
    'The content is generated synthetically to match realistic patterns.',
    'We simulate various note structures including headers, lists, and code blocks.',
    'Performance testing helps identify bottlenecks and optimize the system.',
    'Each note contains frontmatter, content, and metadata.',
  ];

  // Add headers and content until target size reached
  let headerCount = 1;
  while (content.length < targetBytes) {
    // Add a header every ~2KB
    if (content.length % 2048 < 100) {
      content += `\n## Section ${headerCount++}\n\n`;
    }

    // Add paragraph
    const sentenceCount = rng.range(3, 8);
    const paragraph = [];
    for (let i = 0; i < sentenceCount; i++) {
      paragraph.push(rng.choice(sentences));
    }
    content += paragraph.join(' ') + '\n\n';

    // Occasionally add code block or list
    if (rng.next() < 0.2 && content.length < targetBytes - 500) {
      if (rng.next() < 0.5) {
        content += '```typescript\nconst example = { test: "data" };\n```\n\n';
      } else {
        content += '- Item one\n- Item two\n- Item three\n\n';
      }
    }
  }

  return content.substring(0, targetBytes);
}

/**
 * Generate a single PublishableNote conforming to DTO
 */
function generateNote(index, sizeProfile, folderConfig, rng) {
  const noteId = `note-${crypto.randomBytes(8).toString('hex')}`;
  const slug = `test-note-${index}`;
  const title = `Test Note ${index}`;
  const vaultPath = `${folderConfig.vaultFolder}/test-note-${index}.md`;
  const relativePath = `test-note-${index}.md`;

  // Generate content of appropriate size
  const { min, max } = SIZE_PROFILES[sizeProfile];
  const targetKB = rng.range(min, max);
  const content = generateMarkdownContent(targetKB, rng);

  return {
    noteId,
    title,
    vaultPath,
    relativePath,
    content,
    frontmatter: {
      flat: {
        title,
        publish: true,
        draft: false,
      },
      nested: {},
      tags: ['loadtest', `size-${sizeProfile}`],
    },
    folderConfig,
    publishedAt: new Date().toISOString(),
    routing: {
      slug,
      path: relativePath.replace('.md', ''),
      routeBase: folderConfig.routeBase,
      fullPath: `${folderConfig.routeBase}/${slug}`,
    },
    eligibility: {
      isPublishable: true,
    },
    assets: [],
    wikilinks: [],
    resolvedWikilinks: [],
    leafletBlocks: [],
  };
}

/**
 * Generate array of notes with size distribution
 */
function generateNotes(userContext, events, done) {
  const count = parseInt(process.env.NOTES_COUNT || '50', 10);
  const seed = parseInt(process.env.SEED || Date.now().toString(), 10);
  const rng = new SeededRandom(seed + userContext.vars.$loopCount || 0);

  const folderConfig = {
    id: 'folder-loadtest',
    vaultFolder: 'LoadTest',
    routeBase: '/loadtest',
    vpsId: 'loadtest-vps',
    ignoredCleanupRuleIds: [],
  };

  const notes = [];
  for (let i = 0; i < count; i++) {
    const sizeProfile = rng.weighted();
    notes.push(generateNote(i, sizeProfile, folderConfig, rng));
  }

  userContext.vars.notes = notes;
  userContext.vars.notesCount = count;

  return done();
}

/**
 * Generate cleanup rules (optional)
 */
function generateCleanupRules(userContext, events, done) {
  userContext.vars.cleanupRules = [
    {
      id: 'rule-1',
      name: 'Remove comments',
      regex: '<!--.*?-->',
      replacement: '',
      isEnabled: true,
    },
  ];

  return done();
}

module.exports = {
  generateNotes,
  generateCleanupRules,
};
