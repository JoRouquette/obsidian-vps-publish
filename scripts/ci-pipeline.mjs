#!/usr/bin/env node

import { copyFileSync, existsSync } from 'node:fs';
import { spawnSync } from 'node:child_process';

const COLORS = {
  blue: '\x1b[34m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  reset: '\x1b[0m',
};

const args = new Set(process.argv.slice(2));
const fullMode = args.has('--full');
const quickMode = args.has('--quick');
const npmCommand = process.platform === 'win32' ? 'npm.cmd' : 'npm';
const npxCommand = process.platform === 'win32' ? 'npx.cmd' : 'npx';

function logBanner(message, color = COLORS.blue) {
  const line = '═'.repeat(60);
  console.log('');
  console.log(`${color}${line}${COLORS.reset}`);
  console.log(`${color}  ${message}${COLORS.reset}`);
  console.log(`${color}${line}${COLORS.reset}`);
  console.log('');
}

function logStep(step, message) {
  console.log(`${COLORS.yellow}Step ${step}: ${message}...${COLORS.reset}`);
}

function logSuccess(message) {
  console.log(`${COLORS.green}✓ ${message}${COLORS.reset}`);
  console.log('');
}

function run(command, commandArgs) {
  const result = spawnSync(command, commandArgs, {
    cwd: process.cwd(),
    stdio: 'inherit',
    env: process.env,
  });

  if (typeof result.status === 'number' && result.status !== 0) {
    process.exit(result.status);
  }

  if (result.error) {
    throw result.error;
  }
}

function runNpmScript(scriptName) {
  run(npmCommand, ['run', scriptName]);
}

function ensureCsrFallback() {
  const csrPath = 'dist/apps/site/browser/index.csr.html';
  const indexPath = 'dist/apps/site/browser/index.html';

  if (existsSync(csrPath) && !existsSync(indexPath)) {
    copyFileSync(csrPath, indexPath);
    logSuccess('Created index.html from index.csr.html');
    return;
  }

  logSuccess('index.html already exists or not needed');
}

function runPipeline() {
  if (fullMode) {
    logBanner('CI/CD Pipeline - Full (with Lighthouse)');
  } else if (quickMode) {
    logBanner('CI/CD Pipeline - Quick (lint + build + test)');
  } else {
    logBanner('CI/CD Pipeline - Standard');
  }

  logStep(1, 'Documentation validation');
  runNpmScript('docs:check');
  logSuccess('docs:check passed');

  logStep(2, 'Linting');
  runNpmScript('lint');
  logSuccess('lint passed');

  logStep(3, 'Building');
  runNpmScript('build');
  logSuccess('build passed');

  logStep(4, 'Unit tests');
  runNpmScript('test');
  logSuccess('test passed');

  if (quickMode) {
    logBanner('Quick CI Pipeline PASSED', COLORS.green);
    return;
  }

  logStep(5, 'Preparing CSR fallback');
  ensureCsrFallback();

  logStep(6, 'E2E tests');
  run(npxCommand, ['playwright', 'install', 'chromium', '--with-deps']);
  runNpmScript('test:e2e:ci');
  logSuccess('E2E tests passed');

  if (fullMode) {
    logStep(7, 'Lighthouse CI');
    runNpmScript('lighthouse:ci');
    logSuccess('Lighthouse CI passed');
  }

  logBanner(fullMode ? 'Full CI/CD Pipeline PASSED' : 'CI/CD Pipeline PASSED', COLORS.green);
}

runPipeline();
