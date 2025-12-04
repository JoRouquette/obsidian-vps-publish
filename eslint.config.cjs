const nxPlugin = require('@nx/eslint-plugin');
const tsParser = require('@typescript-eslint/parser');
const tsPlugin = require('@typescript-eslint/eslint-plugin');
const prettierPlugin = require('eslint-plugin-prettier');

const baseConfigs = [
  {
    ignores: ['dist/**', 'coverage/**', 'node_modules/**'],
  },
  {
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
  },
];

const tsBaseConfig = {
  files: ['**/*.ts'],
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
  },
  rules: {
    '@typescript-eslint/no-unused-vars': ['error', { argsIgnorePattern: '^_' }],
    '@typescript-eslint/explicit-function-return-type': 'off',
    'prettier/prettier': 'error',
  },
};

const config = [...baseConfigs, tsBaseConfig];
config.baseConfigs = baseConfigs;
config.tsBaseConfig = tsBaseConfig;

module.exports = config;
