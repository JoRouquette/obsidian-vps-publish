const { baseConfigs, tsBaseConfig, tsTestConfig } = require('../../eslint.config.cjs');

module.exports = [
  ...baseConfigs,
  {
    ...tsBaseConfig,
    files: ['**/*.ts'],
    ignores: ['dist/**', 'jest.config.*', '**/*.spec.ts'],
    languageOptions: {
      ...tsBaseConfig.languageOptions,
      parserOptions: {
        ...tsBaseConfig.languageOptions.parserOptions,
        tsconfigRootDir: __dirname,
        project: ['./tsconfig.lib.json', './tsconfig.spec.json'],
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
              message: "Pas de 'fs' dans la couche application. Utilise un port de persistance.",
            },
            {
              name: 'path',
              message: "Pas de 'path' dans la couche application.",
            },
            {
              name: 'http',
              message:
                "Pas d'appel HTTP direct dans la couche application ('http'). Orchestration uniquement.",
            },
            {
              name: 'https',
              message: "Pas d'appel HTTP direct dans la couche application ('https').",
            },
            {
              name: 'express',
              message: "L'application ne doit pas dépendre d'Express. Utilise des ports.",
            },
          ],
          patterns: ['@angular/*'],
        },
      ],

      'no-console': 'error',

      'no-restricted-properties': [
        'error',
        {
          object: 'process',
          property: 'env',
          message:
            'La config doit être injectée via des ports, pas lue directement depuis process.env.',
        },
      ],
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
