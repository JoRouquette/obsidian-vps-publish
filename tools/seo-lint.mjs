#!/usr/bin/env node

/**
 * SEO Lint Script
 *
 * Validates SEO metadata in the published manifest.
 * Can be run against a local manifest file or fetched from a live URL.
 *
 * Usage:
 *   node tools/seo-lint.mjs [manifest-path-or-url]
 *
 * Examples:
 *   node tools/seo-lint.mjs ./content/_manifest.json
 *   node tools/seo-lint.mjs https://publish.scribe-ektaron.com/content/_manifest.json
 *
 * Exit codes:
 *   0 - All checks passed (warnings don't fail)
 *   1 - Errors detected (duplicate titles, inconsistent canonicals)
 */

import { readFile } from 'fs/promises';
import { existsSync } from 'fs';

const COLORS = {
  reset: '\x1b[0m',
  red: '\x1b[31m',
  yellow: '\x1b[33m',
  green: '\x1b[32m',
  cyan: '\x1b[36m',
  dim: '\x1b[2m',
};

function error(msg) {
  console.error(`${COLORS.red}✗ ERROR:${COLORS.reset} ${msg}`);
}

function warn(msg) {
  console.warn(`${COLORS.yellow}⚠ WARN:${COLORS.reset} ${msg}`);
}

function info(msg) {
  console.log(`${COLORS.cyan}ℹ INFO:${COLORS.reset} ${msg}`);
}

function success(msg) {
  console.log(`${COLORS.green}✓${COLORS.reset} ${msg}`);
}

async function loadManifest(pathOrUrl) {
  // Check if it's a URL
  if (pathOrUrl.startsWith('http://') || pathOrUrl.startsWith('https://')) {
    const response = await fetch(pathOrUrl);
    if (!response.ok) {
      throw new Error(`Failed to fetch manifest: ${response.status} ${response.statusText}`);
    }
    return response.json();
  }

  // Local file
  if (!existsSync(pathOrUrl)) {
    throw new Error(`Manifest file not found: ${pathOrUrl}`);
  }

  const content = await readFile(pathOrUrl, 'utf-8');
  return JSON.parse(content);
}

function checkDuplicateTitles(pages) {
  const titleMap = new Map();
  const errors = [];

  for (const page of pages) {
    const title = page.title?.toLowerCase().trim();
    if (!title) continue;

    if (titleMap.has(title)) {
      titleMap.get(title).push(page.route);
    } else {
      titleMap.set(title, [page.route]);
    }
  }

  for (const [title, routes] of titleMap) {
    if (routes.length > 1) {
      errors.push({
        title,
        routes,
        message: `Duplicate title "${title}" found on ${routes.length} pages: ${routes.join(', ')}`,
      });
    }
  }

  return errors;
}

function checkMissingDescriptions(pages) {
  const warnings = [];

  for (const page of pages) {
    if (page.noIndex) continue; // Don't warn for noIndex pages

    if (!page.description || page.description.trim().length === 0) {
      warnings.push({
        route: page.route,
        title: page.title,
        message: `Missing description for "${page.title}" (${page.route})`,
      });
    } else if (page.description.length < 50) {
      warnings.push({
        route: page.route,
        title: page.title,
        message: `Short description (${page.description.length} chars) for "${page.title}" (${page.route})`,
      });
    } else if (page.description.length > 160) {
      warnings.push({
        route: page.route,
        title: page.title,
        message: `Long description (${page.description.length} chars, recommended <160) for "${page.title}" (${page.route})`,
      });
    }
  }

  return warnings;
}

function checkCanonicalConsistency(pages) {
  const errors = [];
  const routeSet = new Set(pages.map((p) => p.route));

  for (const page of pages) {
    if (!page.canonicalSlug) continue;

    // Canonical should point to an existing route
    const expectedCanonical = '/' + page.canonicalSlug.replace(/^\//, '');
    if (!routeSet.has(expectedCanonical) && expectedCanonical !== page.route) {
      errors.push({
        route: page.route,
        canonicalSlug: page.canonicalSlug,
        message: `Canonical slug "${page.canonicalSlug}" for page "${page.route}" does not match any existing route`,
      });
    }

    // Warn if canonical points to itself (redundant)
    if (expectedCanonical === page.route) {
      errors.push({
        route: page.route,
        canonicalSlug: page.canonicalSlug,
        message: `Redundant canonical slug for "${page.route}" points to itself`,
        severity: 'warn',
      });
    }
  }

  return errors;
}

function listNoIndexPages(pages) {
  return pages
    .filter((p) => p.noIndex)
    .map((p) => ({
      route: p.route,
      title: p.title,
    }));
}

function checkMissingCoverImages(pages) {
  const warnings = [];

  for (const page of pages) {
    if (page.noIndex) continue;

    if (!page.coverImage) {
      warnings.push({
        route: page.route,
        title: page.title,
        message: `No cover image for "${page.title}" (${page.route}) - Open Graph will use default`,
      });
    }
  }

  return warnings;
}

function generateReport(manifest) {
  const pages = manifest.pages || [];
  const report = {
    totalPages: pages.length,
    indexedPages: pages.filter((p) => !p.noIndex).length,
    errors: [],
    warnings: [],
    info: [],
  };

  // Check duplicate titles (ERROR)
  const duplicateTitles = checkDuplicateTitles(pages);
  for (const dup of duplicateTitles) {
    report.errors.push(dup.message);
  }

  // Check canonical consistency (ERROR/WARN)
  const canonicalIssues = checkCanonicalConsistency(pages);
  for (const issue of canonicalIssues) {
    if (issue.severity === 'warn') {
      report.warnings.push(issue.message);
    } else {
      report.errors.push(issue.message);
    }
  }

  // Check missing descriptions (WARN)
  const descriptionIssues = checkMissingDescriptions(pages);
  for (const issue of descriptionIssues) {
    report.warnings.push(issue.message);
  }

  // Check missing cover images (INFO - too noisy as warning)
  const coverIssues = checkMissingCoverImages(pages);
  if (coverIssues.length > 0 && coverIssues.length <= 10) {
    for (const issue of coverIssues) {
      report.info.push(issue.message);
    }
  } else if (coverIssues.length > 10) {
    report.info.push(
      `${coverIssues.length} pages missing cover images (run with --verbose for details)`
    );
  }

  // List noIndex pages (INFO)
  const noIndexPages = listNoIndexPages(pages);
  if (noIndexPages.length > 0) {
    report.info.push(
      `${noIndexPages.length} pages marked as noIndex: ${noIndexPages
        .map((p) => p.route)
        .slice(0, 5)
        .join(', ')}${noIndexPages.length > 5 ? '...' : ''}`
    );
  }

  return report;
}

function printReport(report) {
  console.log('\n' + '='.repeat(60));
  console.log(`${COLORS.cyan}SEO Lint Report${COLORS.reset}`);
  console.log('='.repeat(60));
  console.log(`Total pages: ${report.totalPages}`);
  console.log(`Indexed pages: ${report.indexedPages}`);
  console.log('');

  if (report.errors.length > 0) {
    console.log(`${COLORS.red}Errors (${report.errors.length}):${COLORS.reset}`);
    for (const err of report.errors) {
      error(err);
    }
    console.log('');
  }

  if (report.warnings.length > 0) {
    console.log(`${COLORS.yellow}Warnings (${report.warnings.length}):${COLORS.reset}`);
    for (const w of report.warnings) {
      warn(w);
    }
    console.log('');
  }

  if (report.info.length > 0) {
    console.log(`${COLORS.cyan}Info:${COLORS.reset}`);
    for (const i of report.info) {
      info(i);
    }
    console.log('');
  }

  if (report.errors.length === 0) {
    success('No SEO errors detected!');
  }

  console.log('='.repeat(60) + '\n');
}

async function main() {
  const args = process.argv.slice(2);

  // Default manifest path
  let manifestPath = args[0] || './content/_manifest.json';

  console.log(`${COLORS.dim}Loading manifest from: ${manifestPath}${COLORS.reset}`);

  try {
    const manifest = await loadManifest(manifestPath);
    const report = generateReport(manifest);
    printReport(report);

    // Exit with error code if errors found
    if (report.errors.length > 0) {
      process.exit(1);
    }

    process.exit(0);
  } catch (err) {
    error(err.message);
    process.exit(1);
  }
}

main();
