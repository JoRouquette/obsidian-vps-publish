#!/usr/bin/env node

/**
 * Lighthouse CI Runner
 *
 * Comprehensive Lighthouse performance testing for CI/CD.
 * Creates deterministic test fixtures, runs server, executes LHCI, and validates budgets.
 *
 * Usage:
 *   node tools/lighthouse-ci.mjs [options]
 *
 * Options:
 *   --ci            Run in CI mode (fail on budget violations)
 *   --csr           Test CSR mode (default: SSR)
 *   --verbose       Show detailed output
 *   --skip-build    Skip build check (assume artifacts exist)
 *
 * Required:
 *   - Built application in dist/apps/node and dist/apps/site
 *   - @lhci/cli installed globally or locally
 *
 * Exit codes:
 *   0 - All budgets passed
 *   1 - Budget violations or errors
 */

import { execSync, spawn } from 'node:child_process';
import {
  createWriteStream,
  existsSync,
  mkdirSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from 'node:fs';
import http from 'node:http';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');

// ============================================================
// CONSTANTS
// ============================================================

const COLORS = {
  reset: '\x1b[0m',
  bold: '\x1b[1m',
  dim: '\x1b[2m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  cyan: '\x1b[36m',
};

const PORT = 3000;
const BASE_URL = `http://localhost:${PORT}`;
const FIXTURES_DIR = path.join(ROOT, 'tmp/lighthouse-fixtures');
const OUTPUT_DIR = path.join(ROOT, '.lighthouseci');

// Pages to test (must match lighthouserc.cjs URLs)
const TEST_PAGES = [
  { slug: 'index', route: '/', title: 'Home', isCustomIndex: true },
  { slug: 'test-page', route: '/test-page', title: 'Test Page' },
  { slug: 'test-page-with-image', route: '/test-page-with-image', title: 'Page with Image' },
  {
    slug: 'test-page-with-sections',
    route: '/test-page-with-sections',
    title: 'Page with Sections',
  },
];

// ============================================================
// LOGGING
// ============================================================

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

function info(msg) {
  console.log(`${COLORS.cyan}ℹ ${msg}${COLORS.reset}`);
}

function header(msg) {
  log(`\n${'═'.repeat(60)}`, COLORS.cyan);
  log(`  ${msg}`, COLORS.cyan + COLORS.bold);
  log(`${'═'.repeat(60)}\n`, COLORS.cyan);
}

// ============================================================
// BUILD VERIFICATION
// ============================================================

function checkBuildArtifacts() {
  const required = ['dist/apps/node/main.js', 'dist/apps/site/browser/index.html'];

  const optional = [
    'dist/apps/site/server/main.server.mjs', // SSR server
  ];

  log('Checking build artifacts...');

  for (const p of required) {
    const fullPath = path.join(ROOT, p);
    if (!existsSync(fullPath)) {
      error(`Missing required artifact: ${p}`);
      log('Run `npm run build` first to generate build artifacts.');
      return false;
    }
    success(`Found: ${p}`);
  }

  for (const p of optional) {
    const fullPath = path.join(ROOT, p);
    if (existsSync(fullPath)) {
      success(`Found (optional): ${p}`);
    } else {
      warn(`Optional artifact not found: ${p}`);
    }
  }

  return true;
}

// ============================================================
// TEST FIXTURES CREATION
// ============================================================

/**
 * Create a minimal SVG image for testing (no external dependencies)
 */
function createTestImage() {
  // Simple SVG that's a valid image
  return `<svg xmlns="http://www.w3.org/2000/svg" width="800" height="600" viewBox="0 0 800 600">
  <rect width="100%" height="100%" fill="#4a90d9"/>
  <text x="400" y="300" font-family="Arial, sans-serif" font-size="48" fill="white" text-anchor="middle" dominant-baseline="middle">
    Test Image
  </text>
  <text x="400" y="360" font-family="Arial, sans-serif" font-size="24" fill="white" text-anchor="middle" dominant-baseline="middle">
    800x600 • Lighthouse CI Fixture
  </text>
</svg>`;
}

/**
 * Create rich HTML content for a page
 */
function createPageHtml(page, options = {}) {
  const { hasImage = false, hasSections = false } = options;

  const imageHtml = hasImage
    ? `
  <figure>
    <img src="/assets/test-image.svg" alt="Test image for performance validation" width="800" height="600" loading="lazy">
    <figcaption>A test image demonstrating asset loading</figcaption>
  </figure>`
    : '';

  const sectionsHtml = hasSections
    ? `
  <nav aria-label="Table of contents">
    <h2>Contents</h2>
    <ul>
      <li><a href="#section-1">Section 1: Introduction</a></li>
      <li><a href="#section-2">Section 2: Main Content</a></li>
      <li><a href="#section-3">Section 3: Conclusion</a></li>
    </ul>
  </nav>

  <section id="section-1">
    <h2>Section 1: Introduction</h2>
    <p>This is the first section of the page. It provides introductory content that helps establish the context for the reader.</p>
    <p>Lorem ipsum dolor sit amet, consectetur adipiscing elit. Sed do eiusmod tempor incididunt ut labore et dolore magna aliqua.</p>
  </section>

  <section id="section-2">
    <h2>Section 2: Main Content</h2>
    <p>This is the main content section. It contains the primary information that users are looking for.</p>
    <p>Ut enim ad minim veniam, quis nostrud exercitation ullamco laboris nisi ut aliquip ex ea commodo consequat.</p>
    <p>Duis aute irure dolor in reprehenderit in voluptate velit esse cillum dolore eu fugiat nulla pariatur.</p>
  </section>

  <section id="section-3">
    <h2>Section 3: Conclusion</h2>
    <p>This concluding section wraps up the content and provides final thoughts.</p>
    <p>Excepteur sint occaecat cupidatat non proident, sunt in culpa qui officia deserunt mollit anim id est laborum.</p>
  </section>`
    : `
  <p>This is a test page for Lighthouse CI performance validation.</p>
  <p>Lorem ipsum dolor sit amet, consectetur adipiscing elit. Sed do eiusmod tempor incididunt ut labore et dolore magna aliqua. Ut enim ad minim veniam, quis nostrud exercitation ullamco laboris nisi ut aliquip ex ea commodo consequat.</p>
  <p>Duis aute irure dolor in reprehenderit in voluptate velit esse cillum dolore eu fugiat nulla pariatur. Excepteur sint occaecat cupidatat non proident, sunt in culpa qui officia deserunt mollit anim id est laborum.</p>`;

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <meta name="description" content="${page.title} - Performance test page for Lighthouse CI">
  <title>${page.title}</title>
</head>
<body>
  <main>
    <article>
      <header>
        <h1>${page.title}</h1>
      </header>
      ${imageHtml}
      ${sectionsHtml}
    </article>
  </main>
</body>
</html>`;
}

/**
 * Create search page HTML (for /search route)
 */
function createSearchPageHtml() {
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <meta name="description" content="Search published content">
  <title>Search</title>
</head>
<body>
  <main>
    <h1>Search</h1>
    <form role="search" aria-label="Site search">
      <label for="search-input">Search content:</label>
      <input type="search" id="search-input" name="q" placeholder="Enter search terms...">
      <button type="submit">Search</button>
    </form>
    <section aria-label="Search results">
      <p>Enter a search term to find content.</p>
    </section>
  </main>
</body>
</html>`;
}

/**
 * Create all test fixtures
 */
function createFixtures() {
  header('Creating Test Fixtures');

  const contentDir = path.join(FIXTURES_DIR, 'content');
  const assetsDir = path.join(FIXTURES_DIR, 'assets');

  // Clean and create directories
  if (existsSync(FIXTURES_DIR)) {
    rmSync(FIXTURES_DIR, { recursive: true, force: true });
  }
  mkdirSync(contentDir, { recursive: true });
  mkdirSync(assetsDir, { recursive: true });

  // Create manifest
  const manifest = {
    version: '1.0.0',
    generatedAt: new Date().toISOString(),
    pages: TEST_PAGES.map((page) => ({
      id: page.slug,
      title: page.title,
      slug: page.slug,
      route: page.route,
      description: `${page.title} - Performance test page for Lighthouse CI`,
      publishedAt: new Date().toISOString(),
      isCustomIndex: page.isCustomIndex || false,
    })),
    canonicalMap: {},
  };

  writeFileSync(path.join(contentDir, '_manifest.json'), JSON.stringify(manifest, null, 2));
  success('Created _manifest.json');

  // Create HTML pages
  for (const page of TEST_PAGES) {
    const filename = page.slug === 'index' ? 'index.html' : `${page.slug}.html`;
    const hasImage = page.slug === 'test-page-with-image';
    const hasSections = page.slug === 'test-page-with-sections';

    const html = createPageHtml(page, { hasImage, hasSections });
    writeFileSync(path.join(contentDir, filename), html);
    success(`Created ${filename}`);
  }

  // Create search page HTML
  writeFileSync(path.join(contentDir, 'search.html'), createSearchPageHtml());
  success('Created search.html');

  // Create test image
  writeFileSync(path.join(assetsDir, 'test-image.svg'), createTestImage());
  success('Created test-image.svg');

  info(`Fixtures created in: ${FIXTURES_DIR}`);
}

// ============================================================
// SERVER MANAGEMENT
// ============================================================

/**
 * Wait for the server to be ready
 */
function waitForServer(timeout = 30000) {
  return new Promise((resolve, reject) => {
    const startTime = Date.now();
    const healthUrl = `${BASE_URL}/health`;

    function check() {
      const elapsed = Date.now() - startTime;
      if (elapsed > timeout) {
        reject(new Error(`Server did not become ready within ${timeout}ms`));
        return;
      }

      http
        .get(healthUrl, (res) => {
          if (res.statusCode === 200) {
            resolve();
          } else {
            setTimeout(check, 500);
          }
        })
        .on('error', () => {
          setTimeout(check, 500);
        });
    }

    check();
  });
}

/**
 * Start the server
 */
function startServer(options = {}) {
  const { ssrEnabled = true, verbose = false } = options;

  log(`Starting server (SSR: ${ssrEnabled ? 'enabled' : 'disabled'})...`);

  const env = {
    ...process.env,
    NODE_ENV: 'production',
    PORT: String(PORT),
    BASE_URL,
    API_KEY: 'lighthouse-ci-test-key',
    CONTENT_ROOT: path.join(FIXTURES_DIR, 'content'),
    ASSETS_ROOT: path.join(FIXTURES_DIR, 'assets'),
    UI_ROOT: path.join(ROOT, 'dist/apps/site/browser'),
    UI_SERVER_ROOT: path.join(ROOT, 'dist/apps/site/server'),
    SSR_ENABLED: ssrEnabled ? 'true' : 'false',
    LOGGER_LEVEL: verbose ? 'debug' : 'warn',
    // Disable external resources that could cause flakiness
    DISABLE_ANALYTICS: 'true',
    DISABLE_EXTERNAL_FONTS: 'true',
  };

  const server = spawn('node', ['dist/apps/node/main.js'], {
    cwd: ROOT,
    env,
    stdio: verbose ? 'inherit' : ['ignore', 'pipe', 'pipe'],
    detached: false,
  });

  if (!verbose) {
    // Capture output for debugging if needed
    const logFile = createWriteStream(path.join(OUTPUT_DIR, 'server.log'), { flags: 'w' });
    server.stdout?.pipe(logFile);
    server.stderr?.pipe(logFile);
  }

  server.on('error', (err) => {
    error(`Server error: ${err.message}`);
  });

  return server;
}

// ============================================================
// LIGHTHOUSE CI EXECUTION
// ============================================================

/**
 * Get git hash for build context
 */
function getGitHash() {
  try {
    return execSync('git rev-parse --short HEAD', { encoding: 'utf-8' }).trim();
  } catch {
    return 'local';
  }
}

/**
 * Extract and display violation details from LHCI results
 */
function displayViolations() {
  const resultsDir = path.join(OUTPUT_DIR, 'results');
  if (!existsSync(resultsDir)) {
    return;
  }

  try {
    const output = execSync(`ls "${resultsDir}"`, { encoding: 'utf-8' });
    const files = output.split('\n').filter((f) => f.endsWith('.json'));

    for (const file of files) {
      const content = readFileSync(path.join(resultsDir, file), 'utf-8');
      const result = JSON.parse(content);
      if (result.assertions?.length > 0) {
        warn(`Violations in ${file}:`);
        for (const assertion of result.assertions) {
          const logFn = assertion.level === 'error' ? error : warn;
          logFn(`  - ${assertion.auditId}: ${assertion.message}`);
        }
      }
    }
  } catch {
    // Ignore parsing errors - violations may not be parseable
    warn('Could not parse violation details');
  }
}

/**
 * Run Lighthouse CI
 */
function runLighthouseCI(options = {}) {
  const { ciMode = false, verbose = false } = options;

  header('Running Lighthouse CI');

  // Ensure output directory exists
  mkdirSync(OUTPUT_DIR, { recursive: true });

  const env = {
    ...process.env,
    LHCI_BUILD_CONTEXT__CURRENT_HASH: getGitHash(),
    // Server is started externally
    LHCI_COLLECT__START_SERVER_COMMAND: '',
  };

  log('Executing: npx @lhci/cli autorun');

  try {
    execSync('npx @lhci/cli@0.14.x autorun', {
      cwd: ROOT,
      stdio: verbose ? 'inherit' : 'pipe',
      env,
    });

    success('Lighthouse CI completed successfully');
    return { success: true, violations: [] };
  } catch {
    if (ciMode) {
      error('Lighthouse CI failed - budget violations detected');
      displayViolations();
      return { success: false, violations: [] };
    }

    warn('Lighthouse CI completed with warnings (non-CI mode)');
    return { success: true, violations: [] };
  }
}

// ============================================================
// RESULTS SUMMARY
// ============================================================

function printSummary(results, mode) {
  header('Summary');

  log(`Mode: ${mode}`);
  log(
    `Status: ${results.success ? COLORS.green + 'PASSED' : COLORS.red + 'FAILED'}${COLORS.reset}`
  );
  log(`Reports: ${OUTPUT_DIR}`);

  log('\nPages tested:');
  log(`  - ${BASE_URL}/`);
  log(`  - ${BASE_URL}/search`);
  log(`  - ${BASE_URL}/test-page`);
  log(`  - ${BASE_URL}/test-page-with-image`);
  log(`  - ${BASE_URL}/test-page-with-sections#section-2`);

  log('\nBudgets enforced:');
  log('  - LCP < 4s (warn)');
  log('  - CLS < 0.25 (warn)');
  log('  - TBT < 500ms (warn)');
  log('  - Performance score >= 50% (warn)');
  log('  - SEO score >= 80% (warn)');
  log('  - Accessibility score >= 75% (warn)');

  log('\nTo view reports:');
  log(`  open ${OUTPUT_DIR}/*.html`, COLORS.dim);
}

// ============================================================
// MAIN
// ============================================================

async function main() {
  const args = new Set(process.argv.slice(2));
  const ciMode = args.has('--ci');
  const csrMode = args.has('--csr');
  const verbose = args.has('--verbose');
  const skipBuild = args.has('--skip-build');

  const mode = csrMode ? 'CSR' : 'SSR';

  header(`Lighthouse CI - ${mode} Mode${ciMode ? ' (CI)' : ''}`);

  // Check build artifacts
  if (!skipBuild && !checkBuildArtifacts()) {
    process.exit(1);
  }

  // Create test fixtures
  createFixtures();

  // Ensure output directory exists
  mkdirSync(OUTPUT_DIR, { recursive: true });

  let server = null;
  let exitCode = 0;

  try {
    // Start server
    server = startServer({ ssrEnabled: !csrMode, verbose });

    // Wait for server to be ready
    info('Waiting for server to be ready...');
    await waitForServer(30000);
    success(`Server ready at ${BASE_URL}`);

    // Give the server a moment to stabilize
    await new Promise((resolve) => setTimeout(resolve, 2000));

    // Verify endpoints are responding
    log('\nVerifying test endpoints...');
    const testUrls = [
      '/',
      '/search',
      '/test-page',
      '/test-page-with-image',
      '/test-page-with-sections',
    ];

    for (const url of testUrls) {
      try {
        execSync(`curl -sf "${BASE_URL}${url}" > /dev/null`, { encoding: 'utf-8' });
        success(`  ${url} - OK`);
      } catch {
        error(`  ${url} - FAILED`);
        throw new Error(`Endpoint ${url} not responding`);
      }
    }

    // Run Lighthouse CI
    const results = runLighthouseCI({ ciMode, verbose });

    // Print summary
    printSummary(results, mode);

    if (!results.success) {
      exitCode = 1;
    }
  } catch (err) {
    error(err.message || String(err));
    exitCode = 1;
  } finally {
    // Cleanup
    if (server) {
      log('\nStopping server...');
      server.kill('SIGTERM');

      // Wait for graceful shutdown
      await new Promise((resolve) => {
        server.on('exit', resolve);
        setTimeout(() => {
          server.kill('SIGKILL');
          resolve();
        }, 5000);
      });

      success('Server stopped');
    }
  }

  process.exit(exitCode);
}

// Top-level await for ESM
try {
  await main();
} catch (err) {
  error(err.message || String(err));
  process.exit(1);
}
