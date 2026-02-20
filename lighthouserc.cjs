/**
 * Lighthouse CI Configuration
 *
 * Defines performance budgets and collection settings for CI.
 * Run with: npx lhci autorun
 *
 * Budgets are based on "content reading" site requirements:
 * - Fast LCP (under 2.5s)
 * - Low CLS (under 0.1)
 * - Reasonable INP (under 200ms)
 * - Minimal JS footprint for reading experience
 */
module.exports = {
  ci: {
    collect: {
      // Use Puppeteer to launch Chrome
      chromeFlags: '--no-sandbox --disable-gpu --headless',
      // Number of runs per URL (for stability)
      numberOfRuns: 3,
      // URL patterns to test (relative to startServerCommand)
      url: [
        'http://localhost:3000/', // Homepage
        'http://localhost:3000/test', // Test content page
      ],
      // Start the server before tests
      startServerCommand: 'node dist/apps/node/main.js',
      startServerReadyPattern: 'Server listening on port',
      startServerReadyTimeout: 30000,
      // Settings for collection
      settings: {
        // Use mobile preset for realistic conditions
        preset: 'desktop',
        // Throttling settings (simulated cable connection)
        throttlingMethod: 'simulate',
        // Only collect what we need
        onlyCategories: ['performance', 'accessibility', 'best-practices', 'seo'],
      },
    },
    assert: {
      // Assertions (budgets) that must pass
      assertions: {
        // Core Web Vitals
        'largest-contentful-paint': ['error', { maxNumericValue: 2500 }], // LCP < 2.5s
        'cumulative-layout-shift': ['error', { maxNumericValue: 0.1 }], // CLS < 0.1
        'total-blocking-time': ['warn', { maxNumericValue: 300 }], // TBT < 300ms (proxy for INP)

        // Performance score (0-1)
        'categories:performance': ['error', { minScore: 0.8 }], // >= 80

        // JS budget
        'total-byte-weight': ['warn', { maxNumericValue: 1500000 }], // < 1.5MB total
        'script-treemap-data': ['warn', { maxNumericValue: 500000 }], // < 500KB JS

        // First paint metrics
        'first-contentful-paint': ['warn', { maxNumericValue: 1800 }], // FCP < 1.8s
        'speed-index': ['warn', { maxNumericValue: 3400 }], // SI < 3.4s

        // SEO and accessibility
        'categories:seo': ['error', { minScore: 0.9 }], // SEO >= 90
        'categories:accessibility': ['warn', { minScore: 0.85 }], // a11y >= 85
        'categories:best-practices': ['warn', { minScore: 0.9 }], // Best practices >= 90

        // Critical audit passes
        viewport: 'error',
        'document-title': 'error',
        'html-has-lang': 'error',
        'meta-description': 'error',
        'link-text': 'warn',
        'crawlable-anchors': 'warn',
      },
    },
    upload: {
      // Don't upload to LHCI server (keep local)
      target: 'filesystem',
      outputDir: '.lighthouseci',
      // Generate HTML report
      reportFilenamePattern: '%%HOSTNAME%%-%%PATHNAME%%-%%DATETIME%%.report.html',
    },
  },
};
