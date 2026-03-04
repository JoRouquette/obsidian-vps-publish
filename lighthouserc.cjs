/**
 * Lighthouse CI Configuration
 *
 * Comprehensive performance budgets and collection settings for CI.
 * Run with: npm run lighthouse or npx lhci autorun
 *
 * Design goals (content reading site):
 * - Fast LCP (< 2.5s) - critical for reading experience
 * - Stable layout (CLS < 0.1) - avoids jarring content shifts
 * - Responsive interaction (TBT < 300ms) - proxy for INP
 * - Minimal JS footprint - most content is static HTML
 * - High SEO/a11y scores - public content site
 *
 * Pages tested:
 * - / (homepage)
 * - /search (search page)
 * - /test-page (standard note)
 * - /test-page-with-image (note with embedded image)
 * - /test-page-with-sections#section-2 (deep link with anchor)
 */
module.exports = {
  ci: {
    collect: {
      // Chrome flags for stability in CI
      chromeFlags: [
        '--no-sandbox',
        '--disable-gpu',
        '--headless=new',
        '--disable-dev-shm-usage',
        '--disable-extensions',
        '--disable-background-networking',
        '--disable-default-apps',
        '--disable-sync',
        '--no-first-run',
      ].join(' '),

      // Number of runs per URL (median is used for assertions)
      numberOfRuns: 3,

      // URLs to audit (comprehensive coverage)
      url: [
        'http://localhost:3000/', // Homepage
        'http://localhost:3000/search', // Search functionality
        'http://localhost:3000/test-page', // Standard note page
        'http://localhost:3000/test-page-with-image', // Note with assets
        'http://localhost:3000/test-page-with-sections#section-2', // Anchor navigation
      ],

      // Server is started externally by the lighthouse script
      startServerCommand: '',
      startServerReadyPattern: '',
      startServerReadyTimeout: 0,

      // Collection settings
      settings: {
        // Desktop preset (target audience is desktop readers)
        preset: 'desktop',
        // Simulated throttling for consistent results
        throttlingMethod: 'simulate',
        // Categories to audit
        onlyCategories: ['performance', 'accessibility', 'best-practices', 'seo'],
        // Skip audits that cause flakiness in CI
        skipAudits: [
          'uses-http2', // Depends on server config, not app code
          'redirects-http', // Local testing doesn't use HTTPS
        ],
      },
    },

    assert: {
      // Assertion presets: 'lighthouse:recommended' as base
      preset: 'lighthouse:recommended',

      assertions: {
        // ============================================================
        // CORE WEB VITALS (blocking errors)
        // ============================================================

        // LCP: Largest Contentful Paint < 2.5s (good threshold)
        'largest-contentful-paint': ['error', { maxNumericValue: 2500 }],

        // CLS: Cumulative Layout Shift < 0.1 (good threshold)
        'cumulative-layout-shift': ['error', { maxNumericValue: 0.1 }],

        // TBT: Total Blocking Time < 300ms (proxy for INP)
        'total-blocking-time': ['error', { maxNumericValue: 300 }],

        // ============================================================
        // CATEGORY SCORES (blocking errors for critical ones)
        // ============================================================

        // Performance >= 80% (realistic for SSR + Angular)
        'categories:performance': ['error', { minScore: 0.8 }],

        // SEO >= 90% (public content site, SEO critical)
        'categories:seo': ['error', { minScore: 0.9 }],

        // Accessibility >= 85% (warn, continuous improvement)
        'categories:accessibility': ['warn', { minScore: 0.85 }],

        // Best Practices >= 90% (warn, for CI stability)
        'categories:best-practices': ['warn', { minScore: 0.9 }],

        // ============================================================
        // LOADING PERFORMANCE (warnings)
        // ============================================================

        // FCP: First Contentful Paint < 1.8s
        'first-contentful-paint': ['warn', { maxNumericValue: 1800 }],

        // Speed Index < 3.4s
        'speed-index': ['warn', { maxNumericValue: 3400 }],

        // Time to Interactive < 5s
        interactive: ['warn', { maxNumericValue: 5000 }],

        // ============================================================
        // RESOURCE BUDGETS (warnings, catch regressions)
        // ============================================================

        // Total page weight < 1.5MB
        'total-byte-weight': ['warn', { maxNumericValue: 1500000 }],

        // JavaScript total (uncompressed) - Angular budget
        // Target: < 400KB for content reading site
        'script-treemap-data': ['warn', { maxNumericValue: 400000 }],

        // CSS total - keep styles lean
        // (Managed by individual audits, not aggregated here)

        // ============================================================
        // SEO CRITICAL (blocking errors)
        // ============================================================

        // Required meta tags
        viewport: 'error',
        'document-title': 'error',
        'html-has-lang': 'error',
        'meta-description': 'error',

        // Crawlability
        'crawlable-anchors': 'error',
        'is-crawlable': 'error',
        'robots-txt': 'off', // May not exist in test env

        // ============================================================
        // ACCESSIBILITY CRITICAL (blocking errors)
        // ============================================================

        // Color contrast (warn, may need design adjustments)
        'color-contrast': 'warn',

        // Image alt text
        'image-alt': 'error',

        // Heading order
        'heading-order': 'warn',

        // ============================================================
        // BEST PRACTICES (warnings, non-blocking)
        // ============================================================

        // Console errors (warn, may have benign errors)
        'errors-in-console': 'warn',

        // Deprecated APIs
        deprecations: 'warn',

        // HTTPS (disabled for local testing)
        'is-on-https': 'off',

        // HTTP/2 (disabled, depends on server config)
        'uses-http2': 'off',

        // External links policy (warn)
        'external-anchors-use-rel-noopener': 'warn',

        // ============================================================
        // DISABLE FLAKY/IRRELEVANT AUDITS
        // ============================================================

        // Service worker (may not be registered in test env)
        'service-worker': 'off',

        // PWA audits (separate validation)
        'installable-manifest': 'off',
        'maskable-icon': 'off',
        'themed-omnibox': 'off',
        'splash-screen': 'off',

        // Third-party (no third parties in test env)
        'third-party-summary': 'off',
        'third-party-facades': 'off',

        // Font display (may vary)
        'font-display': 'warn',

        // Canonical URL (may not be set in test env)
        canonical: 'warn',
      },
    },

    upload: {
      // Filesystem target (no LHCI server)
      target: 'filesystem',
      outputDir: '.lighthouseci',
      // Report pattern with page identification
      reportFilenamePattern: '%%PATHNAME%%-%%DATETIME%%.report.html',
    },
  },
};
