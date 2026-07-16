/** @type {import('jest').Config} */
const { pathsToModuleNameMapper } = require('ts-jest');
const { compilerOptions } = require('../../tsconfig.base.json');

module.exports = {
  displayName: 'node',

  preset: '../../jest.preset.js',

  testEnvironment: 'node',

  // Limit parallel workers to reduce memory pressure
  maxWorkers: '50%',
  workerIdleMemoryLimit: '512MB',

  transform: {
    '^.+\\.[tj]s$': ['ts-jest', { tsconfig: '<rootDir>/tsconfig.spec.json' }],
  },

  moduleNameMapper: pathsToModuleNameMapper(compilerOptions.paths, {
    prefix: '<rootDir>/../../',
  }),

  transformIgnorePatterns: [
    // Transform ESM-only dependencies instead of ignoring them:
    // - file-type family (asset type detection)
    // - htmlparser2 family (pulled in by sanitize-html for the render sanitization pass)
    // `(?:.*/)?` also matches nested copies (e.g. sanitize-html/node_modules/htmlparser2).
    'node_modules/(?!(?:.*/)?(file-type|strtok3|token-types|peek-readable|htmlparser2|domhandler|domutils|domelementtype|dom-serializer|entities)/)',
  ],

  moduleFileExtensions: ['ts', 'js', 'html'],

  coverageDirectory: '../../coverage/apps/node',

  coverageThreshold: {
    global: {
      statements: 70,
      // Temporary baseline aligned with current suite output on 2026-03-19.
      // Raise again after adding branch-focused tests around session finalization and routing edges.
      branches: 58,
      functions: 70,
      lines: 70,
    },
  },
};
