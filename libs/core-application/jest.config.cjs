/** @type {import('jest').Config} */
module.exports = {
  displayName: 'core-application',
  testEnvironment: 'node',
  rootDir: __dirname,
  transform: {
    '^.+\\.[tj]s$': ['ts-jest', { tsconfig: '<rootDir>/tsconfig.spec.json' }],
  },
  moduleFileExtensions: ['ts', 'js'],
  moduleNameMapper: {
    '^@core-domain$': '<rootDir>/libs/core-domain/src/index.ts',
    '^@core-domain/(.*)$': '<rootDir>/libs/core-domain/src/lib/$1',
  },
  collectCoverageFrom: [
    '<rootDir>/src/lib/**/*.{ts,js}',
    '!<rootDir>/src/lib/**/_tests/**',
    '!<rootDir>/src/lib/**/*.d.ts',
  ],
  coverageThreshold: {
    global: { statements: 45, branches: 30, functions: 45, lines: 45 },
  },
};
