const nxPlugin = require('@nx/eslint-plugin');
const tsParser = require('@typescript-eslint/parser');
const tsPlugin = require('@typescript-eslint/eslint-plugin');
const prettierPlugin = require('eslint-plugin-prettier');
const unusedImportsPlugin = require('eslint-plugin-unused-imports');
const simpleImportSortPlugin = require('eslint-plugin-simple-import-sort');

const ignoreConfig = {
  ignores: ['dist/**', 'coverage/**', 'node_modules/**'],
};

const moduleBoundariesConfig = {
  plugins: {
    '@nx': nxPlugin,
  },
  rules: {
    '@nx/enforce-module-boundaries': [
      'error',
      {
        enforceBuildableLibDependency: true,
        allow: [],
        depConstraints: [
          {
            sourceTag: 'layer:domain',
            onlyDependOnLibsWithTags: ['layer:domain'],
          },
          {
            sourceTag: 'layer:application',
            onlyDependOnLibsWithTags: ['layer:domain', 'layer:application'],
          },
          {
            sourceTag: 'layer:infra',
            onlyDependOnLibsWithTags: ['layer:domain', 'layer:application', 'layer:infra'],
          },
          {
            sourceTag: 'layer:ui',
            onlyDependOnLibsWithTags: ['layer:domain', 'layer:application', 'layer:ui'],
          },
        ],
      },
    ],
  },
};

const tsBaseConfig = {
  files: ['**/*.ts'],
  ignores: ['**/*.spec.ts', '**/*.test.ts'],
  languageOptions: {
    parser: tsParser,
    parserOptions: {
      ecmaVersion: 2022,
      sourceType: 'module',
    },
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
    'unused-imports/no-unused-vars': [
      'error',
      {
        vars: 'all',
        varsIgnorePattern: '^_',
        args: 'after-used',
        argsIgnorePattern: '^_',
      },
    ],

    'simple-import-sort/imports': 'error',
    'simple-import-sort/exports': 'error',
    '@typescript-eslint/explicit-function-return-type': 'off',
    '@typescript-eslint/no-explicit-any': 'error',
    '@typescript-eslint/no-floating-promises': 'error',
    '@typescript-eslint/no-misused-promises': [
      'error',
      {
        checksVoidReturn: true,
        checksConditionals: true,
      },
    ],

    'prettier/prettier': 'error',
  },
};

const tsTestConfig = {
  files: ['**/*.spec.ts', '**/*.test.ts'],
  languageOptions: {
    parser: tsParser,
    parserOptions: {
      ecmaVersion: 2022,
      sourceType: 'module',
    },
  },
  plugins: {
    '@typescript-eslint': tsPlugin,
    prettier: prettierPlugin,
    'unused-imports': unusedImportsPlugin,
    'simple-import-sort': simpleImportSortPlugin,
  },
  rules: {
    // Même nettoyage / tri que pour le code applicatif
    '@typescript-eslint/no-unused-vars': 'off',
    'unused-imports/no-unused-imports': 'error',
    'unused-imports/no-unused-vars': [
      'error',
      {
        vars: 'all',
        varsIgnorePattern: '^_',
        args: 'after-used',
        argsIgnorePattern: '^_',
      },
    ],
    'simple-import-sort/imports': 'error',
    'simple-import-sort/exports': 'error',

    // Tests : plus souple
    '@typescript-eslint/explicit-function-return-type': 'off',
    '@typescript-eslint/no-explicit-any': 'off',
    '@typescript-eslint/no-floating-promises': 'off',
    '@typescript-eslint/no-misused-promises': 'off',

    'no-console': 'off',
    'prettier/prettier': 'error',
  },
};

const config = [ignoreConfig, moduleBoundariesConfig, tsBaseConfig, tsTestConfig];

config.baseConfigs = [ignoreConfig, moduleBoundariesConfig];
config.tsBaseConfig = tsBaseConfig;
config.tsTestConfig = tsTestConfig;

module.exports = config;
