const baseConfig = require('../../eslint.config.cjs');
const tsParser = require('@typescript-eslint/parser');
const tsPlugin = require('@typescript-eslint/eslint-plugin');

module.exports = [
  ...baseConfig,

  {
    files: ['**/*.ts'],
    ignores: ['dist/**', 'jest.config.*', '**/*.spec.ts'],
    languageOptions: {
      parser: tsParser,
      parserOptions: {
        tsconfigRootDir: __dirname,
        project: ['./tsconfig.lib.json', './tsconfig.spec.json'],
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
          paths: [
            {
              name: 'fs',
              message: "Le domaine ne doit pas utiliser 'fs'. Passe par un port de persistance.",
            },
            {
              name: 'path',
              message: "Le domaine ne doit pas connaître le système de fichiers ('path').",
            },
            {
              name: 'http',
              message: "Le domaine ne doit pas faire d'appels HTTP directement ('http').",
            },
            {
              name: 'https',
              message: "Le domaine ne doit pas faire d'appels HTTP directement ('https').",
            },
            {
              name: 'os',
              message: "Le domaine doit rester indépendant de la plateforme ('os').",
            },
            {
              name: 'crypto',
              message:
                "Utilise un service de hashage abstrait via un port, pas 'crypto' directement.",
            },
          ],
        },
      ],

      'no-console': 'error',

      'no-restricted-properties': [
        'error',
        {
          object: 'process',
          property: 'env',
          message:
            'Le domaine ne doit pas lire les variables denvironnement directement. Passe par un port de configuration.',
        },
      ],

      '@typescript-eslint/no-explicit-any': 'error',
    },
  },
];
