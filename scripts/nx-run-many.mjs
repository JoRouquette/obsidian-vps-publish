import { spawnSync } from 'node:child_process';
import path from 'node:path';

const rawArgs = process.argv.slice(2);
const passthroughArgs = [];
let hasParallelFlag = false;

for (let index = 0; index < rawArgs.length; index++) {
  const arg = rawArgs[index];

  if (arg === '--parallel' || arg.startsWith('--parallel=')) {
    hasParallelFlag = true;
  }

  if (arg === '--projects' || arg === '-p' || arg === '--targets' || arg === '-t') {
    const collectedValues = [];
    let cursor = index + 1;

    while (cursor < rawArgs.length && !rawArgs[cursor].startsWith('-')) {
      collectedValues.push(rawArgs[cursor]);
      cursor++;
    }

    passthroughArgs.push(arg);
    passthroughArgs.push(collectedValues.join(','));
    index = cursor - 1;
    continue;
  }

  passthroughArgs.push(arg);
}

if (!hasParallelFlag) {
  passthroughArgs.push('--parallel=1');
}

const nxCliPath = path.resolve('node_modules', 'nx', 'bin', 'nx.js');
const env = {
  ...process.env,
  NX_DAEMON: process.env.NX_DAEMON ?? 'false',
};

const result = spawnSync(process.execPath, [nxCliPath, 'run-many', ...passthroughArgs], {
  stdio: 'inherit',
  shell: false,
  env,
});

if (typeof result.status === 'number') {
  process.exit(result.status);
}

process.exit(1);
