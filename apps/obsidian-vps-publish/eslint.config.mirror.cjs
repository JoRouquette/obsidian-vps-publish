const tsParser = require('@typescript-eslint/parser');
const tsPlugin = require('@typescript-eslint/eslint-plugin');
const prettierPlugin = require('eslint-plugin-prettier');
const unusedImportsPlugin = require('eslint-plugin-unused-imports');
const simpleImportSortPlugin = require('eslint-plugin-simple-import-sort');

module.exports = [
  { ignores: ['dist/**', 'coverage/**', 'node_modules/**', '**/*.d.ts'] },
  {
    files: ['**/*.ts'],
    ignores: ['**/*.test.ts'],
    languageOptions: {
      parser: tsParser,
      parserOptions: { ecmaVersion: 2022, sourceType: 'module', project: ['./tsconfig.json'] },
    },
    plugins: {
      '@typescript-eslint': tsPlugin,
      prettier: prettierPlugin,
      'unused-imports': unusedImportsPlugin,
      'simple-import-sort': simpleImportSortPlugin,
    },
    rules: {
      '@typescript-eslint/no-unused-vars': 'off',
      'unused-imports/no-unused-imports': 'error',
      'unused-imports/no-unused-vars': ['error', { vars: 'all', varsIgnorePattern: '^_', args: 'after-used', argsIgnorePattern: '^_' }],
      'simple-import-sort/imports': 'error',
      'simple-import-sort/exports': 'error',
      '@typescript-eslint/no-explicit-any': 'error',
      '@typescript-eslint/no-floating-promises': 'error',
      '@typescript-eslint/no-misused-promises': ['error', { checksVoidReturn: true }],
      'prettier/prettier': 'error',
      'no-console': ['warn', { allow: ['warn', 'error', 'debug'] }],
    },
  },
  {
    files: ['**/*.test.ts'],
    languageOptions: { parser: tsParser, parserOptions: { ecmaVersion: 2022, sourceType: 'module', project: ['./tsconfig.json'] } },
    plugins: { '@typescript-eslint': tsPlugin, prettier: prettierPlugin, 'unused-imports': unusedImportsPlugin, 'simple-import-sort': simpleImportSortPlugin },
    rules: {
      'unused-imports/no-unused-imports': 'error',
      'simple-import-sort/imports': 'error',
      '@typescript-eslint/no-explicit-any': 'off',
      '@typescript-eslint/no-floating-promises': 'off',
      'prettier/prettier': 'error',
    },
  },
];
