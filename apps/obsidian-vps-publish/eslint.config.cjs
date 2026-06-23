const nx = require('@nx/eslint-plugin');
const { baseConfigs, tsBaseConfig, tsTestConfig } = require('../../eslint.config.cjs');
module.exports = [
  ...baseConfigs,
  {
    ...tsBaseConfig,
    files: ['**/*.ts'],
    ignores: ['dist/**', 'jest.config.*', 'libs/**'],
    languageOptions: {
      ...tsBaseConfig.languageOptions,
      parserOptions: { ...tsBaseConfig.languageOptions.parserOptions, tsconfigRootDir: __dirname, project: ['./tsconfig.json', './tsconfig.spec.json'], sourceType: 'module' },
    },
    linterOptions: { reportUnusedDisableDirectives: 'error' },
    rules: { ...tsBaseConfig.rules },
  },
  {
    ...tsTestConfig,
    files: ['**/*.spec.ts', '**/*.test.ts'],
    languageOptions: {
      ...tsTestConfig.languageOptions,
      parserOptions: { ...tsTestConfig.languageOptions.parserOptions, tsconfigRootDir: __dirname, project: ['./tsconfig.spec.json'], sourceType: 'module' },
    },
  },
  { files: ['**/*.spec.ts', '**/*.test.ts'], plugins: { '@nx': nx }, rules: { '@nx/enforce-module-boundaries': 'off' } },
];
