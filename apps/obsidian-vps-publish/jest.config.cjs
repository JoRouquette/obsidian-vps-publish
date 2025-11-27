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

  coverageDirectory: '../../coverage/apps/obsidian-vps-publish',
};
