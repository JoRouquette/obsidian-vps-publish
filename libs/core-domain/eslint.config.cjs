const tsParser = require('@typescript-eslint/parser');
const tsPlugin = require('@typescript-eslint/eslint-plugin');
const prettierPlugin = require('eslint-plugin-prettier');
const unusedImportsPlugin = require('eslint-plugin-unused-imports');
const simpleImportSortPlugin = require('eslint-plugin-simple-import-sort');

module.exports = [
  { ignores: ['dist/**', 'coverage/**', 'node_modules/**', '**/*.d.ts'] },
  {
    files: ['**/*.ts'],
    ignores: ['**/*.test.ts', '**/*.spec.ts'],
    languageOptions: {
      parser: tsParser,
      parserOptions: {
        ecmaVersion: 2022,
        sourceType: 'module',
        project: ['./tsconfig.lib.json', './tsconfig.spec.json'],
        tsconfigRootDir: __dirname,
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
      'unused-imports/no-unused-vars': ['error', { vars: 'all', varsIgnorePattern: '^_', args: 'after-used', argsIgnorePattern: '^_' }],
      'simple-import-sort/imports': 'error',
      'simple-import-sort/exports': 'error',
      '@typescript-eslint/no-explicit-any': 'error',
      '@typescript-eslint/no-floating-promises': 'error',
      '@typescript-eslint/no-misused-promises': ['error', { checksVoidReturn: true }],
      'prettier/prettier': 'error',
      'no-console': 'error',
      'no-restricted-imports': [
        'error',
        {
          paths: [
            { name: 'fs', message: "Le domaine ne doit pas utiliser 'fs'. Passe par un port de persistance." },
            { name: 'path', message: "Le domaine ne doit pas connaître le système de fichiers ('path')." },
            { name: 'http', message: "Le domaine ne doit pas faire d'appels HTTP directement ('http')." },
            { name: 'https', message: "Le domaine ne doit pas faire d'appels HTTP directement ('https')." },
            { name: 'os', message: "Le domaine doit rester indépendant de la plateforme ('os')." },
            { name: 'crypto', message: "Utilise un service de hashage abstrait via un port, pas 'crypto' directement." },
          ],
        },
      ],
      'no-restricted-properties': [
        'error',
        { object: 'process', property: 'env', message: "Le domaine ne doit pas lire les variables d'environnement directement." },
      ],
    },
  },
  {
    files: ['**/*.test.ts', '**/*.spec.ts'],
    languageOptions: {
      parser: tsParser,
      parserOptions: { ecmaVersion: 2022, sourceType: 'module', project: ['./tsconfig.spec.json'], tsconfigRootDir: __dirname },
    },
    plugins: {
      '@typescript-eslint': tsPlugin,
      prettier: prettierPlugin,
      'unused-imports': unusedImportsPlugin,
      'simple-import-sort': simpleImportSortPlugin,
    },
    rules: {
      'unused-imports/no-unused-imports': 'error',
      'simple-import-sort/imports': 'error',
      '@typescript-eslint/no-explicit-any': 'off',
      '@typescript-eslint/no-floating-promises': 'off',
      'prettier/prettier': 'error',
    },
  },
];
