const nxPreset = require('@nx/jest/preset').default;

/** @type {import('jest').Config} */
module.exports = {
  ...nxPreset,

  coverageProvider: 'babel',

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
