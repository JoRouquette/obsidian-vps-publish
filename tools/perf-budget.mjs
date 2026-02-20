#!/usr/bin/env node

/**
 * Performance Budget Validation Script
 *
 * Runs Lighthouse CI to validate performance budgets.
 * Can be run locally or in CI.
 *
 * Usage:
 *   node tools/perf-budget.mjs [--ci]
 *
 * Options:
 *   --ci    Run in CI mode (fail on budget violations)
 *
 * Requirements:
 *   - Built application in dist/apps/node and dist/apps/site
 *   - Node.js with Puppeteer-compatible Chrome
 *   - Environment variables: BASE_URL, API_KEY (for server startup)
 *
 * Exit codes:
 *   0 - All budgets passed
 *   1 - Budget violations or errors
 */

import { execSync, spawn } from 'child_process';
import { existsSync, mkdirSync, writeFileSync, rmSync } from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');

const COLORS = {
  reset: '\x1b[0m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  cyan: '\x1b[36m',
  dim: '\x1b[2m',
};

function log(msg, color = '') {
  console.log(`${color}${msg}${COLORS.reset}`);
}

function error(msg) {
  console.error(`${COLORS.red}✗ ${msg}${COLORS.reset}`);
}

function success(msg) {
  console.log(`${COLORS.green}✓ ${msg}${COLORS.reset}`);
}

function warn(msg) {
  console.warn(`${COLORS.yellow}⚠ ${msg}${COLORS.reset}`);
}

/**
 * Check if required build artifacts exist
 */
function checkBuildArtifacts() {
  const requiredPaths = [
    'dist/apps/node/main.js',
    'dist/apps/site/browser/index.html',
    'dist/apps/site/server/main.server.mjs',
  ];

  for (const p of requiredPaths) {
    const fullPath = path.join(ROOT, p);
    if (!existsSync(fullPath)) {
      error(`Missing build artifact: ${p}`);
      log('Run `npm run build` first to generate build artifacts.');
      return false;
    }
  }

  return true;
}

/**
 * Create test content for Lighthouse to test
 */
function createTestContent() {
  const contentDir = path.join(ROOT, 'tmp/site-content');
  mkdirSync(contentDir, { recursive: true });

  // Create minimal manifest
  const manifest = {
    version: '1.0.0',
    generatedAt: new Date().toISOString(),
    pages: [
      {
        id: 'test-content',
        title: 'Test Content Page',
        slug: 'test-content',
        route: '/test-content',
        description: 'A test page for Lighthouse CI performance validation',
        publishedAt: new Date().toISOString(),
      },
      {
        id: 'index',
        title: 'Home',
        slug: 'index',
        route: '/',
        description: 'Homepage',
        publishedAt: new Date().toISOString(),
        isCustomIndex: true,
      },
    ],
    canonicalMap: {},
  };

  writeFileSync(path.join(contentDir, '_manifest.json'), JSON.stringify(manifest, null, 2));

  // Create test HTML content
  const testHtml = `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <title>Test Content Page</title>
</head>
<body>
  <h1>Test Content Page</h1>
  <p>This is a test page for Lighthouse CI performance validation.</p>
  <p>Lorem ipsum dolor sit amet, consectetur adipiscing elit. Sed do eiusmod tempor incididunt ut labore et dolore magna aliqua.</p>
</body>
</html>
`.trim();

  writeFileSync(path.join(contentDir, 'test-content.html'), testHtml);

  // Create index.html
  const indexHtml = `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <title>Home</title>
</head>
<body>
  <h1>Welcome</h1>
  <p>This is the homepage for Lighthouse CI performance validation.</p>
</body>
</html>
`.trim();

  writeFileSync(path.join(contentDir, 'index.html'), indexHtml);

  success('Created test content in tmp/site-content/');
}

/**
 * Start the server in the background
 */
function startServer() {
  log('Starting server...', COLORS.cyan);

  const env = {
    ...process.env,
    NODE_ENV: 'production',
    PORT: '3000',
    BASE_URL: 'http://localhost:3000',
    API_KEY: 'test-api-key',
    CONTENT_ROOT: path.join(ROOT, 'tmp/site-content'),
    ASSETS_ROOT: path.join(ROOT, 'tmp/assets'),
    UI_ROOT: path.join(ROOT, 'dist/apps/site/browser'),
    UI_SERVER_ROOT: path.join(ROOT, 'dist/apps/site/server'),
    SSR_ENABLED: 'true',
    LOGGER_LEVEL: 'warn',
  };

  const server = spawn('node', ['dist/apps/node/main.js'], {
    cwd: ROOT,
    env,
    stdio: ['ignore', 'pipe', 'pipe'],
    detached: false,
  });

  // Wait for server to be ready
  return new Promise((resolve, reject) => {
    const timeout = setTimeout(() => {
      server.kill();
      reject(new Error('Server startup timeout'));
    }, 30000);

    server.stdout.on('data', (data) => {
      const output = data.toString();
      if (output.includes('listening on port') || output.includes('Server listening')) {
        clearTimeout(timeout);
        success('Server started on port 3000');
        resolve(server);
      }
    });

    server.stderr.on('data', (data) => {
      const output = data.toString();
      // Some debug output goes to stderr, only reject on actual errors
      if (output.includes('Error') || output.includes('FATAL')) {
        clearTimeout(timeout);
        reject(new Error(`Server error: ${output}`));
      }
    });

    server.on('error', (err) => {
      clearTimeout(timeout);
      reject(err);
    });

    server.on('exit', (code) => {
      if (code !== 0 && code !== null) {
        clearTimeout(timeout);
        reject(new Error(`Server exited with code ${code}`));
      }
    });
  });
}

/**
 * Run Lighthouse CI
 */
function runLighthouse(ciMode = false) {
  log('\nRunning Lighthouse CI...', COLORS.cyan);

  // Create output directory
  const outputDir = path.join(ROOT, '.lighthouseci');
  mkdirSync(outputDir, { recursive: true });

  try {
    // Run LHCI with autorun
    execSync('npx @lhci/cli@0.14.x autorun', {
      cwd: ROOT,
      stdio: 'inherit',
      env: {
        ...process.env,
        LHCI_BUILD_CONTEXT__CURRENT_HASH: 'local',
        // Skip server start (we start it ourselves)
        LHCI_COLLECT__START_SERVER_COMMAND: '',
        LHCI_COLLECT__URL: 'http://localhost:3000/,http://localhost:3000/test-content',
      },
    });

    success('Lighthouse CI completed successfully');
    return true;
  } catch (err) {
    if (ciMode) {
      error('Lighthouse CI failed - budget violations detected');
      return false;
    } else {
      warn('Lighthouse CI completed with warnings');
      return true;
    }
  }
}

/**
 * Run simple curl-based checks
 */
async function runCurlChecks() {
  log('\nRunning curl checks...', COLORS.cyan);

  const checks = [
    {
      name: 'SSR response headers',
      url: 'http://localhost:3000/',
      expected: ['Server-Timing', 'Cache-Control', 'Content-Type: text/html'],
    },
    {
      name: 'ETag present',
      url: 'http://localhost:3000/',
      expected: ['ETag'],
    },
    {
      name: 'X-SSR-Cache header',
      url: 'http://localhost:3000/',
      expected: ['X-SSR-Cache'],
    },
  ];

  let allPassed = true;

  for (const check of checks) {
    try {
      const result = execSync(`curl -sI "${check.url}"`, { encoding: 'utf-8' });
      const missing = check.expected.filter((h) => !result.includes(h));

      if (missing.length === 0) {
        success(`${check.name}: OK`);
      } else {
        warn(`${check.name}: Missing headers: ${missing.join(', ')}`);
        allPassed = false;
      }
    } catch (err) {
      error(`${check.name}: Failed to fetch`);
      allPassed = false;
    }
  }

  // Test 304 Not Modified
  try {
    // First request to get ETag
    const headers = execSync('curl -sI "http://localhost:3000/"', { encoding: 'utf-8' });
    const etagMatch = headers.match(/ETag:\s*"([^"]+)"/i);

    if (etagMatch) {
      const etag = etagMatch[0].split(':')[1].trim();
      // Second request with If-None-Match
      const conditionalResult = execSync(
        `curl -sI -H "If-None-Match: ${etag}" "http://localhost:3000/"`,
        { encoding: 'utf-8' }
      );

      if (conditionalResult.includes('304')) {
        success('304 Not Modified: OK');
      } else {
        warn('304 Not Modified: Not working (expected 304 response)');
      }
    } else {
      warn('304 Not Modified: No ETag found');
    }
  } catch {
    warn('304 Not Modified: Test failed');
  }

  return allPassed;
}

/**
 * Print usage summary
 */
function printSummary() {
  log('\n' + '='.repeat(60), COLORS.cyan);
  log('Performance Validation Commands', COLORS.cyan);
  log('='.repeat(60), COLORS.cyan);

  log('\nManual validation with curl:');
  log('  # Check SSR response headers:');
  log('  curl -I http://localhost:3000/', COLORS.dim);
  log('\n  # Test ETag / 304 response:');
  log('  ETAG=$(curl -sI http://localhost:3000/ | grep -i etag | cut -d" " -f2)', COLORS.dim);
  log('  curl -I -H "If-None-Match: $ETAG" http://localhost:3000/', COLORS.dim);
  log('\n  # Check Server-Timing:');
  log('  curl -sI http://localhost:3000/ | grep -i server-timing', COLORS.dim);

  log('\nExpected headers:');
  log('  Cache-Control: public, max-age=0, s-maxage=60, stale-while-revalidate=300');
  log('  ETag: "..."');
  log('  Server-Timing: ssr;dur=..., ssr_cache;desc=HIT/MISS/STALE');
  log('  X-SSR-Cache: HIT/MISS/STALE');

  log('\n' + '='.repeat(60) + '\n', COLORS.cyan);
}

async function main() {
  const args = process.argv.slice(2);
  const ciMode = args.includes('--ci');

  log('='.repeat(60), COLORS.cyan);
  log('Performance Budget Validation', COLORS.cyan);
  log('='.repeat(60), COLORS.cyan);

  // Check build artifacts
  if (!checkBuildArtifacts()) {
    process.exit(1);
  }

  // Create test content
  createTestContent();

  let server = null;
  let exitCode = 0;

  try {
    // Start server
    server = await startServer();

    // Wait a bit for server to stabilize
    await new Promise((resolve) => setTimeout(resolve, 2000));

    // Run curl checks first (quick validation)
    const curlPassed = await runCurlChecks();

    // Run Lighthouse (only if we have the dependency)
    try {
      const lhciPassed = runLighthouse(ciMode);
      if (!lhciPassed && ciMode) {
        exitCode = 1;
      }
    } catch (err) {
      warn('Lighthouse CI not available. Install with: npm install -D @lhci/cli');
    }

    if (!curlPassed && ciMode) {
      exitCode = 1;
    }

    printSummary();
  } catch (err) {
    error(err.message || String(err));
    exitCode = 1;
  } finally {
    // Cleanup
    if (server) {
      log('Stopping server...');
      server.kill('SIGTERM');
    }
  }

  process.exit(exitCode);
}

main().catch((err) => {
  error(err.message || String(err));
  process.exit(1);
});
