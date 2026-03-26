const path = require('node:path');
const Module = require('node:module');

const workspaceRoot = process.cwd();
const originalResolveFilename = Module._resolveFilename;

const aliasMappings = [
  {
    prefix: '@core-domain/',
    resolve(request) {
      return path.join(
        workspaceRoot,
        'libs',
        'core-domain',
        'src',
        'lib',
        request.slice('@core-domain/'.length)
      );
    },
  },
  {
    prefix: '@core-domain',
    resolve() {
      return path.join(workspaceRoot, 'libs', 'core-domain', 'src', 'index.ts');
    },
  },
  {
    prefix: '@core-application/',
    resolve(request) {
      return path.join(
        workspaceRoot,
        'libs',
        'core-application',
        'src',
        'lib',
        request.slice('@core-application/'.length)
      );
    },
  },
  {
    prefix: '@core-application',
    resolve() {
      return path.join(workspaceRoot, 'libs', 'core-application', 'src', 'index.ts');
    },
  },
];

Module._resolveFilename = function resolveFilename(request, parent, isMain, options) {
  for (const mapping of aliasMappings) {
    if (request === mapping.prefix || request.startsWith(mapping.prefix)) {
      return originalResolveFilename.call(this, mapping.resolve(request), parent, isMain, options);
    }
  }

  return originalResolveFilename.call(this, request, parent, isMain, options);
};

require('ts-node').register({
  transpileOnly: true,
  compilerOptions: {
    module: 'commonjs',
    moduleResolution: 'node',
  },
});
require(path.join(workspaceRoot, 'apps', 'node', 'src', 'bench', 'publication-trace-benchmark.ts'));
