module.exports = {
  displayName: 'obsidian-vps-publish',
  testEnvironment: 'node',
  // Les guidelines Obsidian imposent `window.setTimeout` / `window.setInterval`
  // (compatibilité des fenêtres popout), or `window` n'existe pas sous 'node'.
  // Bascule complète en jsdom écartée : jsdom n'expose ni TextEncoder ni les
  // globals Fetch (Response), ce qui casse 9 suites. Un alias suffit.
  setupFiles: ['<rootDir>/jest.setup.cjs'],
  rootDir: __dirname,
  transform: {
    '^.+\\.[tj]s$': ['ts-jest', { tsconfig: '<rootDir>/tsconfig.spec.json' }],
  },
  moduleFileExtensions: ['ts', 'js'],
  moduleNameMapper: {
    '^obsidian$': '<rootDir>/src/_tests/__mocks__/obsidian.ts',
    '^@core-domain$': '<rootDir>/../../libs/core-domain/src/index.ts',
    '^@core-domain/(.*)$': '<rootDir>/../../libs/core-domain/src/lib/$1',
    '^@core-application$': '<rootDir>/../../libs/core-application/src/index.ts',
    '^@core-application/(.*)$': '<rootDir>/../../libs/core-application/src/lib/$1',
  },
  coverageThreshold: {
    global: { statements: 35, branches: 20, functions: 35, lines: 35 },
  },
};
