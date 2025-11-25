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
};
