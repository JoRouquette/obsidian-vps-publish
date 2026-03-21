import { spawnSync } from 'node:child_process';
import path from 'node:path';

const rawArgs = process.argv.slice(2);
const passthroughArgs = [];

for (let index = 0; index < rawArgs.length; index++) {
  const arg = rawArgs[index];

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

const nxCliPath = path.resolve('node_modules', 'nx', 'bin', 'nx.js');
const result = spawnSync(process.execPath, [nxCliPath, 'run-many', ...passthroughArgs], {
  stdio: 'inherit',
  shell: false,
});

if (typeof result.status === 'number') {
  process.exit(result.status);
}

process.exit(1);
