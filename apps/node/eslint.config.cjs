const baseConfig = require('../../eslint.config.cjs');
const tsParser = require('@typescript-eslint/parser');
const tsPlugin = require('@typescript-eslint/eslint-plugin');

module.exports = [
  ...baseConfig,
  {
    files: ['**/*.ts'],
    ignores: ['dist/**', 'jest.config.*'],
    languageOptions: {
      parser: tsParser,
      parserOptions: {
        tsconfigRootDir: __dirname,
        project: ['./tsconfig.app.json', './tsconfig.spec.json'],
        sourceType: 'module',
      },
    },
    plugins: {
      '@typescript-eslint': tsPlugin,
    },
    linterOptions: {
      reportUnusedDisableDirectives: 'error',
    },
    rules: {
      'no-restricted-imports': [
        'error',
        {
          patterns: ['@angular/*'],
        },
      ],

      'no-console': 'off',
    },
  },
];
