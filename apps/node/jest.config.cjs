/** @type {import('jest').Config} */
const { pathsToModuleNameMapper } = require('ts-jest');
const { compilerOptions } = require('../../tsconfig.base.json');

module.exports = {
  displayName: 'node',

  preset: '../../jest.preset.js',

  testEnvironment: 'node',

  transform: {
    '^.+\\.[tj]s$': ['ts-jest', { tsconfig: '<rootDir>/tsconfig.spec.json' }],
  },

  moduleNameMapper: pathsToModuleNameMapper(compilerOptions.paths, {
    prefix: '<rootDir>/../../',
  }),

  transformIgnorePatterns: [
    // Transform file-type (ESM module) instead of ignoring it
    'node_modules/(?!(file-type|strtok3|token-types|peek-readable)/)',
  ],

  moduleFileExtensions: ['ts', 'js', 'html'],

  coverageDirectory: '../../coverage/apps/node',

  coverageThreshold: {
    global: {
      statements: 70,
      branches: 60,
      functions: 70,
      lines: 70,
    },
  },
};
