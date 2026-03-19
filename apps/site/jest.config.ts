export default {
  displayName: 'site',

  preset: '../../jest.preset.js',

  setupFilesAfterEnv: ['<rootDir>/src/test-setup.ts'],

  coverageDirectory: '../../coverage/apps/site',

  testPathIgnorePatterns: ['/node_modules/', '/e2e/'],

  transform: {
    '^.+\\.(ts|mjs|js|html)$': [
      'jest-preset-angular',
      {
        tsconfig: '<rootDir>/tsconfig.spec.json',
        stringifyContentPathRegex: '\\.(html|svg)$',
      },
    ],
  },

  transformIgnorePatterns: ['node_modules/(?!.*\\.mjs$)'],

  // Temporary baseline while harmonizing quality gates across projects.
  // Raise these thresholds once the remaining hotspots have been decomposed further.
  coverageThreshold: {
    global: {
      statements: 30,
      branches: 20,
      functions: 30,
      lines: 30,
    },
  },

  snapshotSerializers: [
    'jest-preset-angular/build/serializers/no-ng-attributes',
    'jest-preset-angular/build/serializers/ng-snapshot',
    'jest-preset-angular/build/serializers/html-comment',
  ],
};
