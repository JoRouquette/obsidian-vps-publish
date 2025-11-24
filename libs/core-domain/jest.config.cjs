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
};
