const nx = require('@nx/eslint-plugin');
const obsidianmd = require('eslint-plugin-obsidianmd');
const { baseConfigs, tsBaseConfig, tsTestConfig } = require('../../eslint.config.cjs');

// Règles officielles des guidelines de plugins Obsidian — les mêmes que celles
// appliquées par la revue automatisée du répertoire communautaire.
//
// On n'utilise PAS le preset `recommended` du paquet : il embarque aussi
// eslint-plugin-security, -import, -sdl, -no-unsanitized et du typed-linting,
// qui feraient exploser le lint existant sans rapport avec les guidelines.
// On ne retient que les règles `obsidianmd/*`, en `warn` : informatif, la CI
// reste verte, mais les écarts sont visibles en local avant publication.
const obsidianmdPlugin = obsidianmd.default ?? obsidianmd;
const obsidianmdRules = Object.fromEntries(
  Object.keys(obsidianmdPlugin.rules ?? {}).map((rule) => [`obsidianmd/${rule}`, 'warn'])
);

module.exports = [
  ...baseConfigs,
  {
    files: ['**/*.ts'],
    ignores: ['dist/**', 'jest.config.*', 'libs/**', '**/_tests/**'],
    plugins: { obsidianmd: obsidianmdPlugin },
    rules: obsidianmdRules,
  },
  {
    ...tsBaseConfig,
    files: ['**/*.ts'],
    ignores: ['dist/**', 'jest.config.*', 'libs/**'],
    languageOptions: {
      ...tsBaseConfig.languageOptions,
      parserOptions: {
        ...tsBaseConfig.languageOptions.parserOptions,
        tsconfigRootDir: __dirname,
        project: ['./tsconfig.json', './tsconfig.spec.json'],
        sourceType: 'module',
      },
    },
    linterOptions: { reportUnusedDisableDirectives: 'error' },
    rules: { ...tsBaseConfig.rules },
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
  {
    files: ['**/*.spec.ts', '**/*.test.ts'],
    plugins: { '@nx': nx },
    rules: { '@nx/enforce-module-boundaries': 'off' },
  },
];
