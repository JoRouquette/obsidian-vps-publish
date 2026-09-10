module.exports = {
  displayName: 'obsidian-vps-publish',
  testEnvironment: 'node',
  // Voir jest.setup.cjs : alias `window` -> globalThis, requis parce que le code
  // du plugin utilise `window.setTimeout` (guidelines Obsidian, compat popout).
  setupFiles: ['<rootDir>/jest.setup.cjs'],
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
