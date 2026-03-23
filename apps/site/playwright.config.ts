import { workspaceRoot } from '@nx/devkit';
import { nxE2EPreset } from '@nx/playwright/preset';
import path from 'node:path';
import { defineConfig, devices } from '@playwright/test';

/**
 * E2E tests run against the full stack: backend (Express) serving the Angular UI.
 * The backend serves content from E2E fixtures prepared by scripts/e2e-setup.mjs.
 *
 * Environment:
 * - Backend on port 3000 (serves API + Angular UI via SSR or static)
 * - Content from tmp/e2e-content (fixtures)
 * - Assets from tmp/e2e-assets (fixtures)
 */

const e2ePort = process.env['SITE_E2E_PORT'] || '3100';
// Use backend URL since it serves both API and UI
const baseURL = process.env['BASE_URL'] || `http://localhost:${e2ePort}`;
const isCI = !!process.env.CI;

// E2E fixture paths
const e2eContentRoot = path.join(workspaceRoot, 'tmp', 'e2e-content');
const e2eAssetsRoot = path.join(workspaceRoot, 'tmp', 'e2e-assets');
const uiRoot = path.join(workspaceRoot, 'dist', 'apps', 'site', 'browser');

/**
 * See https://playwright.dev/docs/test-configuration.
 */
export default defineConfig({
  ...nxE2EPreset(__filename, { testDir: './e2e' }),

  /* Global timeout for a test (default: 30s) */
  timeout: 60000,

  /* Expect timeout for assertions (default: 5s) */
  expect: {
    timeout: 10000,
  },

  /* Retry failed tests on CI */
  retries: isCI ? 2 : 0,

  /* Parallel workers: limit to avoid port conflicts */
  workers: isCI ? 2 : undefined,

  /* Reporter: different for CI vs local */
  reporter: isCI
    ? [['html', { outputFolder: 'playwright-report', open: 'never' }], ['github']]
    : [['html', { open: 'on-failure' }]],

  /* Output directories for artifacts */
  outputDir: 'test-results',

  /* Shared settings for all the projects below. */
  use: {
    baseURL,
    /* Collect trace when retrying the failed test. See https://playwright.dev/docs/trace-viewer */
    trace: 'on-first-retry',
    /* Take screenshot on failure */
    screenshot: 'only-on-failure',
    /* Video recording on failure */
    video: 'retain-on-failure',
    /* Viewport */
    viewport: { width: 1280, height: 720 },
    /* Action timeout */
    actionTimeout: 15000,
    /* Navigation timeout */
    navigationTimeout: 30000,
  },

  /* Global setup to prepare fixtures before tests */
  globalSetup: path.join(workspaceRoot, 'scripts', 'e2e-setup.mjs'),

  /**
   * Run the backend server before starting tests.
   * The backend serves both the API and the Angular UI.
   */
  webServer: {
    command: `node ${path.join(workspaceRoot, 'dist', 'apps', 'node', 'main.js')}`,
    url: `${baseURL}/health`,
    reuseExistingServer: !isCI,
    cwd: workspaceRoot,
    timeout: 120000,
    stdout: isCI ? 'ignore' : 'pipe',
    stderr: isCI ? 'pipe' : 'pipe',
    env: {
      NODE_ENV: 'test',
      PORT: e2ePort,
      BASE_URL: baseURL,
      API_KEY: 'e2e-test-key',
      CONTENT_ROOT: e2eContentRoot,
      ASSETS_ROOT: e2eAssetsRoot,
      UI_ROOT: uiRoot,
      SSR_ENABLED: 'false',
      LOGGER_LEVEL: 'warn',
      SITE_NAME: 'E2E Test Site',
      AUTHOR: 'E2E Test Author',
    },
  },

  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },

    // Firefox and WebKit disabled in CI (only chromium installed)
    // Uncomment for local comprehensive testing
    /* {
      name: 'firefox',
      use: { ...devices['Desktop Firefox'] },
    },

    {
      name: 'webkit',
      use: { ...devices['Desktop Safari'] },
    }, */

    // Mobile viewport tests
    {
      name: 'mobile-chrome',
      use: { ...devices['Pixel 5'] },
    },

    // Uncomment for branded browsers
    /* {
      name: 'Microsoft Edge',
      use: { ...devices['Desktop Edge'], channel: 'msedge' },
    },
    {
      name: 'Google Chrome',
      use: { ...devices['Desktop Chrome'], channel: 'chrome' },
    } */
  ],
});
