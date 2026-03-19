/** @type {import('jest').Config} */
module.exports = {
  displayName: 'core-domain',
  preset: '../../jest.preset.js',
  testEnvironment: 'node',

  rootDir: __dirname,

  transform: {
    '^.+\\.[tj]s$': ['ts-jest', { tsconfig: '<rootDir>/tsconfig.spec.json' }],
  },

  moduleFileExtensions: ['ts', 'js', 'html'],

  collectCoverageFrom: [
    '<rootDir>/src/lib/**/*.{ts,js}',
    '!<rootDir>/src/lib/**/_tests/**',
    '!<rootDir>/src/lib/**/*.d.ts',
  ],

  coverageDirectory: '../../coverage/libs/core-domain',

  // Temporary baseline while harmonizing quality gates across projects.
  // The domain layer should stay the strictest because it is the easiest to test deterministically.
  coverageThreshold: {
    global: {
      statements: 60,
      branches: 40,
      functions: 45,
      lines: 60,
    },
  },
};
