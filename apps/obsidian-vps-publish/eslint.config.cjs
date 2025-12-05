const { baseConfigs, tsBaseConfig, tsTestConfig } = require('../../eslint.config.cjs');

module.exports = [
  ...baseConfigs,
  {
    ...tsBaseConfig,
    files: ['**/*.ts'],
    ignores: ['dist/**', 'jest.config.*'],
    languageOptions: {
      ...tsBaseConfig.languageOptions,
      parserOptions: {
        ...tsBaseConfig.languageOptions.parserOptions,
        tsconfigRootDir: __dirname,
        project: ['./tsconfig.json'],
        sourceType: 'module',
      },
    },
    linterOptions: {
      reportUnusedDisableDirectives: 'error',
    },
    rules: {
      ...tsBaseConfig.rules,
      'no-console': 'warn',
    },
  },
  {
    ...tsTestConfig,
    files: ['**/*.spec.ts', '**/*.test.ts'],
    languageOptions: {
      ...tsTestConfig.languageOptions,
      parserOptions: {
        ...tsTestConfig.languageOptions.parserOptions,
        tsconfigRootDir: __dirname,
        project: ['./tsconfig.spec.json'],
        sourceType: 'module',
      },
    },
  },
];
