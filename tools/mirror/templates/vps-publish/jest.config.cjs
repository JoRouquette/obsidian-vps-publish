module.exports = {
  displayName: 'obsidian-vps-publish',
  testEnvironment: 'node',
  transform: {
    '^.+\\.[tj]s$': ['ts-jest', { tsconfig: './tsconfig.json' }],
  },
  moduleFileExtensions: ['ts', 'js'],
  moduleNameMapper: {
    '^obsidian$': '<rootDir>/src/_tests/__mocks__/obsidian.ts',
    '^@core-domain$': '<rootDir>/libs/core-domain/src/index.ts',
    '^@core-domain/(.*)$': '<rootDir>/libs/core-domain/src/lib/$1',
    '^@core-application$': '<rootDir>/libs/core-application/src/index.ts',
    '^@core-application/(.*)$': '<rootDir>/libs/core-application/src/lib/$1',
  },
  coverageThreshold: {
    global: { statements: 35, branches: 20, functions: 35, lines: 35 },
  },
};
