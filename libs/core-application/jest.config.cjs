/** @type {import('jest').Config} */
const { pathsToModuleNameMapper } = require('ts-jest');
const { compilerOptions } = require('../../tsconfig.base.json');

module.exports = {
  displayName: 'core-application',
  preset: '../../jest.preset.js',
  testEnvironment: 'node',

  rootDir: __dirname,

  transform: {
    '^.+\\.[tj]s$': ['ts-jest', { tsconfig: '<rootDir>/tsconfig.spec.json' }],
  },

  moduleFileExtensions: ['ts', 'js', 'html'],

  moduleNameMapper: pathsToModuleNameMapper(compilerOptions.paths, {
    prefix: '<rootDir>/../../',
  }),

  collectCoverageFrom: [
    '<rootDir>/src/lib/**/*.{ts,js}',
    '!<rootDir>/src/lib/**/_tests/**',
    '!<rootDir>/src/lib/**/*.d.ts',
  ],

  coverageDirectory: '../../coverage/libs/core-application',

  // Temporary baseline while harmonizing quality gates across projects.
  // Raise these thresholds incrementally to avoid turning on unstable gates.
  coverageThreshold: {
    global: {
      statements: 45,
      branches: 30,
      functions: 45,
      lines: 45,
    },
  },
};
