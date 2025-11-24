const nxPreset = require('@nx/jest/preset').default;

/** @type {import('jest').Config} */
module.exports = {
  ...nxPreset,

  collectCoverage: true,

  collectCoverageFrom: [
    '<rootDir>/src/**/*.{ts,js,tsx,jsx}',
    '!<rootDir>/src/**/*.spec.{ts,js,tsx,jsx}',
    '!<rootDir>/src/**/*.test.{ts,js,tsx,jsx}',
  ],

  coverageReporters: ['lcov', 'text-summary'],

  coverageThreshold: {
    global: {
      statements: 85,
      branches: 85,
      functions: 85,
      lines: 85,
    },
  },
};
