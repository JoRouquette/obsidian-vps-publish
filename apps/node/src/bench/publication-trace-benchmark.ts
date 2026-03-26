import { promises as fs } from 'node:fs';
import path from 'node:path';

import {
  buildRevisionComparison,
  loadBenchmarkFixtures,
  renderBenchmarkMarkdown,
  renderRevisionComparisonMarkdown,
  runPublicationBenchmarkReport,
} from './publication-trace-benchmark.runner';
import type {
  PublicationBenchmarkCompareReport,
  PublicationBenchmarkReport,
} from './publication-trace-benchmark.types';

async function main(): Promise<void> {
  const [command = 'run', ...args] = process.argv.slice(2);

  if (command === 'compare') {
    await runCompareCommand(args);
    return;
  }

  if (command !== 'run') {
    throw new Error(`Unknown command "${command}". Use "run" or "compare".`);
  }

  const fixtureArg = readArg(args, '--fixture') ?? 'all';
  const modeArg = readArg(args, '--mode') ?? 'both';
  const iterations = Number.parseInt(readArg(args, '--iterations') ?? '1', 10);
  const outputDir =
    readArg(args, '--output-dir') ??
    path.join('tmp', 'publication-trace-bench', new Date().toISOString().replace(/[:.]/g, '-'));

  const fixtures = await loadBenchmarkFixtures(
    fixtureArg === 'all' ? undefined : fixtureArg.split(',')
  );
  if (fixtures.length === 0) {
    throw new Error(`No fixtures found for "${fixtureArg}".`);
  }

  const report = await runPublicationBenchmarkReport({
    fixtures,
    mode: normalizeMode(modeArg),
    iterations: Number.isFinite(iterations) && iterations > 0 ? iterations : 1,
  });

  await writeReportArtifacts(outputDir, report);
  console.log(`Publication benchmark written to ${outputDir}`);
}

async function runCompareCommand(args: string[]): Promise<void> {
  const baselinePath = readArg(args, '--baseline');
  const candidatePath = readArg(args, '--candidate');
  if (!baselinePath || !candidatePath) {
    throw new Error('compare requires --baseline <file> and --candidate <file>.');
  }

  const outputDir =
    readArg(args, '--output-dir') ??
    path.join(
      'tmp',
      'publication-trace-bench',
      `compare-${new Date().toISOString().replace(/[:.]/g, '-')}`
    );

  const baseline = JSON.parse(
    await fs.readFile(baselinePath, 'utf8')
  ) as PublicationBenchmarkReport;
  const candidate = JSON.parse(
    await fs.readFile(candidatePath, 'utf8')
  ) as PublicationBenchmarkReport;
  const comparison = buildRevisionComparison({ baseline, candidate });
  await writeComparisonArtifacts(outputDir, comparison);
  console.log(`Publication benchmark comparison written to ${outputDir}`);
}

async function writeReportArtifacts(
  outputDir: string,
  report: PublicationBenchmarkReport
): Promise<void> {
  await fs.mkdir(outputDir, { recursive: true });
  await fs.writeFile(
    path.join(outputDir, 'publication-trace-report.json'),
    `${JSON.stringify(report, null, 2)}\n`,
    'utf8'
  );
  await fs.writeFile(
    path.join(outputDir, 'publication-trace-report.md'),
    renderBenchmarkMarkdown(report),
    'utf8'
  );
}

async function writeComparisonArtifacts(
  outputDir: string,
  report: PublicationBenchmarkCompareReport
): Promise<void> {
  await fs.mkdir(outputDir, { recursive: true });
  await fs.writeFile(
    path.join(outputDir, 'publication-trace-comparison.json'),
    `${JSON.stringify(report, null, 2)}\n`,
    'utf8'
  );
  await fs.writeFile(
    path.join(outputDir, 'publication-trace-comparison.md'),
    renderRevisionComparisonMarkdown(report),
    'utf8'
  );
}

function readArg(args: string[], name: string): string | undefined {
  const index = args.indexOf(name);
  if (index === -1) {
    return undefined;
  }
  return args[index + 1];
}

function normalizeMode(value: string): 'pipeline-unchanged' | 'pipeline-changed' | 'both' {
  if (value === 'pipeline-unchanged' || value === 'pipeline-changed' || value === 'both') {
    return value;
  }
  throw new Error(`Invalid mode "${value}". Use pipeline-unchanged, pipeline-changed, or both.`);
}

void main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
});
