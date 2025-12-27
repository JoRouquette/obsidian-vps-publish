#!/usr/bin/env node

/**
 * Script de validation des corrections de performance
 * Version simplifiée utilisant nx serve directement
 */

import { spawn } from 'child_process';
import { readFileSync, existsSync, writeFileSync } from 'fs';
import { join } from 'path';

const GREEN = '\x1b[32m';
const YELLOW = '\x1b[33m';
const RED = '\x1b[31m';
const NC = '\x1b[0m';

console.log(`${GREEN}=== Validation des Corrections de Performance ===${NC}\n`);

// Configuration
const MAX_ACTIVE_REQUESTS = process.env.MAX_ACTIVE_REQUESTS || '200';
const MAX_CONCURRENT_FINALIZATION_JOBS = process.env.MAX_CONCURRENT_FINALIZATION_JOBS || '8';
const API_KEY = 'test-api-key-for-artillery';

// Charger la baseline si disponible
const BASELINE_FILE = 'tools/load-tests/artillery/reports/load-1000.json';
let baseline = {
  vusers: 172,
  code429: 128,
  throughput: 2,
  finishP99: 1023,
};

if (existsSync(BASELINE_FILE)) {
  console.log(`✓ Baseline found: ${BASELINE_FILE}`);
  try {
    const data = JSON.parse(readFileSync(BASELINE_FILE, 'utf8'));
    baseline.vusers = data.aggregate?.counters?.['vusers.created'] || baseline.vusers;
    baseline.code429 = data.aggregate?.counters?.['http.codes.429'] || baseline.code429;
    baseline.throughput = data.aggregate?.rps?.mean || baseline.throughput;
    baseline.finishP99 = data.aggregate?.latency?.p99 || baseline.finishP99;
  } catch (err) {
    console.log(`${YELLOW}⚠️  Could not parse baseline, using defaults${NC}`);
  }
} else {
  console.log(`${YELLOW}⚠️  Baseline file not found, using default metrics${NC}`);
}

console.log(`\n${YELLOW}Baseline Metrics:${NC}`);
console.log(`  VUsers Created: ${baseline.vusers}`);
console.log(`  HTTP 429 Count: ${baseline.code429}`);
console.log(`  Throughput: ${baseline.throughput} req/s`);
console.log(`  /finish P99: ${baseline.finishP99}ms`);

console.log(`\n${YELLOW}Current Configuration:${NC}`);
console.log(`  MAX_ACTIVE_REQUESTS: ${MAX_ACTIVE_REQUESTS}`);
console.log(`  MAX_CONCURRENT_FINALIZATION_JOBS: ${MAX_CONCURRENT_FINALIZATION_JOBS}`);

// Créer .env temporaire
const envContent = `
NODE_ENV=development
PORT=3000
CONTENT_ROOT=./tmp/content
ASSETS_ROOT=./tmp/assets
UI_ROOT=./dist/apps/site/browser
LOGGER_LEVEL=info
ALLOWED_ORIGINS=*
API_KEY=${API_KEY}
MAX_ACTIVE_REQUESTS=${MAX_ACTIVE_REQUESTS}
MAX_CONCURRENT_FINALIZATION_JOBS=${MAX_CONCURRENT_FINALIZATION_JOBS}
`.trim();

writeFileSync('.env.perf-test', envContent);

console.log(`\n${GREEN}Starting backend (nx serve node)...${NC}`);

// Démarrer le backend
const backend = spawn('npx', ['nx', 'serve', 'node'], {
  stdio: 'pipe',
  shell: true,
  env: {
    ...process.env,
    ...Object.fromEntries(envContent.split('\n').map((l) => l.split('=').map((s) => s.trim()))),
  },
});

let backendReady = false;

backend.stdout.on('data', (data) => {
  const output = data.toString();
  if (output.includes('Listening on') || output.includes('Server running on')) {
    backendReady = true;
  }
  if (process.env.VERBOSE === '1') {
    process.stdout.write(output);
  }
});

backend.stderr.on('data', (data) => {
  if (process.env.VERBOSE === '1') {
    process.stderr.write(data);
  }
});

// Attendre que le backend soit prêt
console.log('Waiting for backend to be ready...');
const maxRetries = 60;
let retries = 0;

async function checkHealth() {
  try {
    const response = await fetch('http://localhost:3000/health');
    if (response.ok) {
      console.log(`${GREEN}✓ Backend ready!${NC}`);
      return true;
    }
  } catch (err) {
    // Ignore connection errors during startup
  }
  return false;
}

async function waitForBackend() {
  while (retries < maxRetries) {
    if (await checkHealth()) {
      return true;
    }
    await new Promise((resolve) => setTimeout(resolve, 1000));
    retries++;
  }
  console.log(`${RED}✗ Backend failed to start after ${maxRetries}s${NC}`);
  backend.kill();
  process.exit(1);
}

waitForBackend().then(async () => {
  // Capturer les métriques initiales
  console.log(`\n${YELLOW}Initial Health Metrics:${NC}`);
  try {
    const health = await fetch('http://localhost:3000/health').then((r) => r.json());
    console.log(`  activeRequests: ${health.load?.activeRequests || 0}`);
    console.log(`  eventLoopLagMs: ${health.load?.eventLoopLagMs || 0}`);
    console.log(`  memoryUsageMB: ${health.load?.memoryUsageMB || 0}`);
    console.log(`  rejections.total: ${health.load?.rejections?.total || 0}`);
  } catch (err) {
    console.log(`  ${YELLOW}Could not fetch initial metrics${NC}`);
  }

  // Lancer Artillery
  console.log(`\n${GREEN}Running Artillery load test...${NC}`);
  const reportFile = `tools/load-tests/artillery/reports/optimized-${new Date().toISOString().replace(/[:.]/g, '-').slice(0, -5)}.json`;

  const artillery = spawn(
    'artillery',
    [
      'run',
      'tools/load-tests/artillery/scenarios/load-1000.yml',
      '--dotenv',
      '.env.artillery',
      '--output',
      reportFile,
    ],
    {
      stdio: 'inherit',
      shell: true,
      env: { ...process.env, API_KEY },
    }
  );

  artillery.on('close', async (code) => {
    if (code !== 0) {
      console.log(`${RED}✗ Artillery test failed with exit code ${code}${NC}`);
      backend.kill();
      process.exit(1);
    }

    console.log(`${GREEN}✓ Artillery test completed${NC}`);

    // Capturer les métriques finales
    console.log(`\n${YELLOW}Final Health Metrics:${NC}`);
    try {
      const health = await fetch('http://localhost:3000/health').then((r) => r.json());
      console.log(`  activeRequests: ${health.load?.activeRequests || 0}`);
      console.log(`  eventLoopLagMs: ${health.load?.eventLoopLagMs || 0}`);
      console.log(`  memoryUsageMB: ${health.load?.memoryUsageMB || 0}`);
      console.log(`  rejections: ${JSON.stringify(health.load?.rejections || {})}`);
    } catch (err) {
      console.log(`  ${YELLOW}Could not fetch final metrics${NC}`);
    }

    // Analyser les résultats
    console.log(`\n${GREEN}=== Performance Analysis ===${NC}\n`);

    if (!existsSync(reportFile)) {
      console.log(`${RED}✗ Report file not found: ${reportFile}${NC}`);
      backend.kill();
      process.exit(1);
    }

    const report = JSON.parse(readFileSync(reportFile, 'utf8'));
    const optimized = {
      vusers: report.aggregate?.counters?.['vusers.created'] || 0,
      code429: report.aggregate?.counters?.['http.codes.429'] || 0,
      throughput: report.aggregate?.rps?.mean || 0,
      finishP99: report.aggregate?.latency?.p99 || 0,
    };

    console.log('Metrics Comparison:');
    console.log(
      '┌─────────────────────────────────────┬──────────────┬──────────────┬───────────┐'
    );
    console.log(
      '│ Metric                              │ Baseline     │ Optimized    │ Change    │'
    );
    console.log(
      '├─────────────────────────────────────┼──────────────┼──────────────┼───────────┤'
    );

    const vusersChange = (((optimized.vusers - baseline.vusers) / baseline.vusers) * 100).toFixed(
      1
    );
    const code429Change =
      baseline.code429 > 0
        ? (((optimized.code429 - baseline.code429) / baseline.code429) * 100).toFixed(1)
        : '0.0';
    const throughputChange = (
      ((optimized.throughput - baseline.throughput) / baseline.throughput) *
      100
    ).toFixed(1);
    const finishP99Change = (
      ((optimized.finishP99 - baseline.finishP99) / baseline.finishP99) *
      100
    ).toFixed(1);

    console.log(
      `│ ${'VUsers Created'.padEnd(35)} │ ${String(baseline.vusers).padStart(12)} │ ${String(optimized.vusers).padStart(12)} │ ${(vusersChange + '%').padStart(9)} │`
    );
    console.log(
      `│ ${'HTTP 429 Count'.padEnd(35)} │ ${String(baseline.code429).padStart(12)} │ ${String(optimized.code429).padStart(12)} │ ${(code429Change + '%').padStart(9)} │`
    );
    console.log(
      `│ ${'Throughput (req/s)'.padEnd(35)} │ ${(baseline.throughput.toFixed(1) + '/s').padStart(12)} │ ${(optimized.throughput.toFixed(1) + '/s').padStart(12)} │ ${(throughputChange + '%').padStart(9)} │`
    );
    console.log(
      `│ ${'/finish P99 Latency'.padEnd(35)} │ ${(baseline.finishP99 + 'ms').padStart(12)} │ ${(optimized.finishP99.toFixed(0) + 'ms').padStart(12)} │ ${(finishP99Change + '%').padStart(9)} │`
    );
    console.log(
      '└─────────────────────────────────────┴──────────────┴──────────────┴───────────┘'
    );

    // Critères de validation
    console.log(`\n${YELLOW}Validation Criteria:${NC}`);
    let passCount = 0;
    let failCount = 0;

    if (parseFloat(vusersChange) >= 20) {
      console.log(`  ${GREEN}✓${NC} VUsers improved by ${vusersChange}% (target: +20%)`);
      passCount++;
    } else {
      console.log(`  ${RED}✗${NC} VUsers improved by ${vusersChange}% (target: +20%)`);
      failCount++;
    }

    if (parseFloat(code429Change) <= -25) {
      console.log(`  ${GREEN}✓${NC} 429s reduced by ${code429Change}% (target: -25%)`);
      passCount++;
    } else {
      console.log(`  ${RED}✗${NC} 429s reduced by ${code429Change}% (target: -25%)`);
      failCount++;
    }

    if (parseFloat(throughputChange) >= 80) {
      console.log(`  ${GREEN}✓${NC} Throughput improved by ${throughputChange}% (target: +80%)`);
      passCount++;
    } else {
      console.log(`  ${RED}✗${NC} Throughput improved by ${throughputChange}% (target: +80%)`);
      failCount++;
    }

    if (parseFloat(finishP99Change) <= -30) {
      console.log(`  ${GREEN}✓${NC} P99 latency reduced by ${finishP99Change}% (target: -30%)`);
      passCount++;
    } else {
      console.log(`  ${RED}✗${NC} P99 latency reduced by ${finishP99Change}% (target: -30%)`);
      failCount++;
    }

    console.log(`\n${YELLOW}Final Verdict:${NC}`);
    console.log(`  Passed: ${passCount}/4`);
    console.log(`  Failed: ${failCount}/4`);

    if (failCount === 0) {
      console.log(`\n${GREEN}🎉 All performance targets met!${NC}`);
    } else if (passCount >= 2) {
      console.log(`\n${YELLOW}⚠️  Partial improvement - some targets not met${NC}`);
    } else {
      console.log(`\n${RED}❌ Performance targets not met${NC}`);
    }

    console.log(`\n${YELLOW}Report saved to: ${reportFile}${NC}`);

    // Cleanup
    console.log(`\n${YELLOW}Cleaning up...${NC}`);
    backend.kill();
    console.log(`${GREEN}✓ Cleanup complete${NC}`);

    process.exit(failCount > 2 ? 1 : 0);
  });
});
