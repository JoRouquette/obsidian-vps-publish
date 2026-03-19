/** @type {import('jest').Config} */
module.exports = {
  displayName: 'obsidian-vps-publish',

  preset: '../../jest.preset.js',

  testEnvironment: 'node',

  rootDir: __dirname,

  transform: {
    '^.+\\.[tj]s$': ['ts-jest', { tsconfig: '<rootDir>/tsconfig.spec.json' }],
  },

  moduleFileExtensions: ['ts', 'js', 'html'],

  transformIgnorePatterns: ['node_modules/'],

  moduleNameMapper: {
    '^obsidian$': '<rootDir>/src/_tests/__mocks__/obsidian.ts',
  },

  coverageDirectory: '../../coverage/apps/obsidian-vps-publish',

  // Temporary baseline while harmonizing quality gates across projects.
  // Raise these thresholds as integration-heavy paths get more focused tests.
  coverageThreshold: {
    global: {
      statements: 35,
      branches: 20,
      functions: 35,
      lines: 35,
    },
  },
};
