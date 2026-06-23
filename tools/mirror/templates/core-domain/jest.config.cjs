/** @type {import('jest').Config} */
module.exports = {
  displayName: 'core-domain',
  testEnvironment: 'node',
  rootDir: __dirname,
  transform: {
    '^.+\\.[tj]s$': ['ts-jest', { tsconfig: '<rootDir>/tsconfig.spec.json' }],
  },
  moduleFileExtensions: ['ts', 'js'],
  moduleNameMapper: {
    '^@core-domain$': '<rootDir>/src/index.ts',
    '^@core-domain/(.*)$': '<rootDir>/src/lib/$1',
  },
  collectCoverageFrom: [
    '<rootDir>/src/lib/**/*.{ts,js}',
    '!<rootDir>/src/lib/**/_tests/**',
    '!<rootDir>/src/lib/**/*.d.ts',
  ],
  coverageThreshold: {
    global: { statements: 60, branches: 40, functions: 45, lines: 60 },
  },
};
