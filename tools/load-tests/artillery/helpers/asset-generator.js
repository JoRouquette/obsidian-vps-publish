/**
 * Artillery payload generator for DTO-compliant asset payloads
 * Generates synthetic binary assets with variable sizes conforming to ApiAssetDto
 */

const crypto = require('crypto');

/**
 * Size profiles for assets (in KB)
 * small: 50 KB (70%)
 * medium: 500 KB (25%)
 * large: 2-8 MB (5%)
 */
const SIZE_PROFILES = {
  small: { min: 50, max: 50 },
  medium: { min: 500, max: 500 },
  large: { min: 2048, max: 8192 },
};

const DISTRIBUTION = {
  small: 0.7,
  medium: 0.25,
  large: 0.05,
};

const MIME_TYPES = ['image/png', 'image/jpeg', 'image/webp', 'application/pdf', 'image/svg+xml'];

/**
 * Seeded random number generator (same as note-generator)
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
 * Generate base64-encoded synthetic binary data
 */
function generateBinaryData(targetKB, rng) {
  const targetBytes = targetKB * 1024;
  // Generate random bytes
  const buffer = crypto.randomBytes(targetBytes);
  return buffer.toString('base64');
}

/**
 * Generate a single ApiAsset conforming to DTO
 */
function generateAsset(index, sizeProfile, rng) {
  const mimeType = rng.choice(MIME_TYPES);
  const extension = mimeType.split('/')[1].split('+')[0];
  const fileName = `asset-${index}.${extension}`;
  const relativePath = `assets/${fileName}`;
  const vaultPath = `LoadTest/assets/${fileName}`;

  // Generate content of appropriate size
  const { min, max } = SIZE_PROFILES[sizeProfile];
  const targetKB = rng.range(min, max);
  const contentBase64 = generateBinaryData(targetKB, rng);

  return {
    relativePath,
    vaultPath,
    fileName,
    mimeType,
    contentBase64,
  };
}

/**
 * Generate array of assets with size distribution
 */
function generateAssets(userContext, events, done) {
  const count = parseInt(process.env.ASSETS_COUNT || '20', 10);
  const seed = parseInt(process.env.SEED || Date.now().toString(), 10);
  const rng = new SeededRandom(seed + 1000 + (userContext.vars.$loopCount || 0));

  const assets = [];
  for (let i = 0; i < count; i++) {
    const sizeProfile = rng.weighted();
    assets.push(generateAsset(i, sizeProfile, rng));
  }

  userContext.vars.assets = assets;
  userContext.vars.assetsCount = count;

  return done();
}

module.exports = {
  generateAssets,
};
