const playwright = require('eslint-plugin-playwright');
const { baseConfigs, tsBaseConfig, tsTestConfig } = require('../../eslint.config.cjs');

module.exports = [
  // Playwright config only for e2e tests
  {
    ...playwright.configs['flat/recommended'],
    files: ['e2e/**/*.spec.ts'],
  },

  ...baseConfigs,

  // Main app TypeScript config (with type checking)
  {
    ...tsBaseConfig,
    files: ['src/**/*.ts'], // Only src folder within site
    ignores: [
      'dist/**',
      'jest.config.*',
      '**/*.html',
      'test-setup.ts',
      'e2e/**', // Ignore e2e files from main config
      'playwright.config.ts', // Ignore playwright config
      '**/.angular/**', // Ignore Angular cache and generated files
    ],
    languageOptions: {
      ...tsBaseConfig.languageOptions,
      parserOptions: {
        ...tsBaseConfig.languageOptions.parserOptions,
        tsconfigRootDir: __dirname,
        project: ['./tsconfig.app.json', './tsconfig.spec.json'],
        sourceType: 'module',
      },
    },
    linterOptions: {
      reportUnusedDisableDirectives: 'error',
    },
    rules: {
      ...tsBaseConfig.rules,
      'no-restricted-imports': [
        'error',
        {
          paths: [
            {
              name: 'fs',
              message: "Le front ne peut pas utiliser 'fs'.",
            },
            {
              name: 'path',
              message: "Le front ne peut pas utiliser 'path'.",
            },
            {
              name: 'http',
              message:
                "Utilise HttpClient d'Angular pour les appels HTTP, pas le module 'http' de Node.",
            },
            {
              name: 'https',
              message:
                "Utilise HttpClient d'Angular pour les appels HTTP, pas le module 'https' de Node.",
            },
            {
              name: 'express',
              message: "Le front ne doit pas dépendre d'Express.",
            },
          ],
        },
      ],

      'no-restricted-properties': [
        'error',
        {
          object: 'process',
          property: 'env',
          message:
            'Utilise les mécanismes de config Angular (environment.ts, etc.) au lieu de process.env.',
        },
      ],

      'no-console': 'warn',
    },
  },
  {
    ...tsTestConfig,
    files: ['src/**/*.spec.ts', 'src/**/*.test.ts'], // More specific path
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
  // Server-side files (SSR) - disable frontend restrictions
  // MUST BE LAST to override previous rules
  {
    files: ['src/server.ts', 'src/app.config.server.ts', 'src/main.server.ts'],
    languageOptions: {
      ...tsBaseConfig.languageOptions,
      parserOptions: {
        ...tsBaseConfig.languageOptions.parserOptions,
        tsconfigRootDir: __dirname,
        project: ['./tsconfig.server.json'],
        sourceType: 'module',
      },
    },
    rules: {
      'no-restricted-imports': 'off',
      'no-restricted-properties': 'off',
      'no-console': 'off',
    },
  },
];
