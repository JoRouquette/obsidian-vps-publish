/** @type {import('jest').Config} */
module.exports = {
  displayName: 'publish-to-personal-vps',

  preset: '../../jest.preset.js',

  testEnvironment: 'node',

  rootDir: __dirname,

  transform: {
    '^.+\\.[tj]s$': ['ts-jest', { tsconfig: '<rootDir>/tsconfig.spec.json' }],
  },

  moduleFileExtensions: ['ts', 'js', 'html'],

  coverageDirectory: '../../coverage/apps/publish-to-personal-vps',
};
