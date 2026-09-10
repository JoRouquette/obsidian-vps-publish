// Config ESLint du miroir vps-publish.
//
// POURQUOI CE FICHIER EXISTE SOUS CETTE FORME
// La revue automatisée du répertoire Obsidian applique `eslint-plugin-obsidianmd`.
// Jusqu'à la 6.23.0, aucune de nos CI ne chargeait ce plugin : on ne voyait donc
// jamais ce que voyait le répertoire. Résultat, des directives `eslint-disable`
// posées pour taire ces règles — alors que le preset interdit précisément de les
// désactiver — sont passées jusqu'en production et ont fait tomber la revue en
// « Failed ». Le preset est donc chargé ici, dans le dépôt que le répertoire scanne.
//
// Le fichier est en .mjs et non en .cjs : eslint-plugin-obsidianmd est ESM pur
// (`"type": "module"`), il ne peut pas être `require()`.
import tsParser from '@typescript-eslint/parser';
import tsPlugin from '@typescript-eslint/eslint-plugin';
import prettierPlugin from 'eslint-plugin-prettier';
import unusedImportsPlugin from 'eslint-plugin-unused-imports';
import simpleImportSortPlugin from 'eslint-plugin-simple-import-sort';
import obsidianmd from 'eslint-plugin-obsidianmd';

// Le preset s'applique au code livré, pas aux suites : celles-ci emploient
// légitimement `global`, `document.createElement` et des modules Node. C'est aussi
// ce que fait la revue du répertoire, qui n'a jamais signalé un seul *.test.ts.
const obsidianmdForSource = obsidianmd.configs.recommended.map((block) => ({
  ...block,
  ignores: [...(block.ignores ?? []), '**/*.test.ts', '**/__mocks__/**'],
}));

export default [
  { ignores: ['dist/**', 'coverage/**', 'node_modules/**', '**/*.d.ts'] },

  // Preset du répertoire. `recommended` et non `recommendedWithLocalesEn` :
  // la variante « locales » impose la casse de phrase aux fichiers de traduction,
  // ce qui transformerait chaque « VPS » de locales.ts en « Vps ».
  ...obsidianmdForSource,

  {
    // Alignement des sévérités sur ce que rapporte réellement la revue.
    //
    // Restent en ERREUR ce qui l'a fait tomber en 6.23.0 : les règles obsidianmd
    // et les restrictions sur les directives eslint-disable.
    //
    // Passent en AVERTISSEMENT les règles typées que la revue liste en « Warning » :
    // elles décrivent une dette réelle (le typage de la frontière Dataview et des
    // réponses HTTP), mais ne bloquent pas la publication. Les laisser en erreur
    // noierait les vrais blocages sous deux cents lignes de bruit.
    files: ['**/*.ts'],
    ignores: ['**/*.test.ts', '**/__mocks__/**'],
    rules: {
      // TypeScript vérifie déjà l'existence des identifiants ; la règle de base
      // ne connaît pas les globals d'Obsidian et produit un millier de faux positifs.
      'no-undef': 'off',
      '@typescript-eslint/no-unsafe-argument': 'warn',
      '@typescript-eslint/no-unsafe-assignment': 'warn',
      '@typescript-eslint/no-unsafe-member-access': 'warn',
      '@typescript-eslint/no-unsafe-call': 'warn',
      '@typescript-eslint/no-unsafe-return': 'warn',
      '@typescript-eslint/no-unsafe-enum-comparison': 'warn',
      '@typescript-eslint/no-unnecessary-type-assertion': 'warn',
      '@typescript-eslint/no-base-to-string': 'warn',
      '@typescript-eslint/unbound-method': 'warn',
      '@typescript-eslint/only-throw-error': 'warn',
      '@typescript-eslint/no-require-imports': 'warn',
      '@typescript-eslint/no-deprecated': 'warn',
    },
  },

  {
    files: ['**/*.ts'],
    ignores: ['**/*.test.ts', '**/__mocks__/**'],
    languageOptions: {
      parser: tsParser,
      parserOptions: {
        ecmaVersion: 2022,
        sourceType: 'module',
        project: ['./tsconfig.json'],
        tsconfigRootDir: import.meta.dirname,
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
        { vars: 'all', varsIgnorePattern: '^_', args: 'after-used', argsIgnorePattern: '^_' },
      ],
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
    // Les suites sont hors du bloc strict, comme dans la revue du répertoire :
    // elles emploient légitimement `global`, `document.createElement` et des
    // modules Node que les règles obsidianmd proscrivent dans le code livré.
    files: ['**/*.test.ts', '**/__mocks__/**'],
    languageOptions: {
      parser: tsParser,
      parserOptions: {
        ecmaVersion: 2022,
        sourceType: 'module',
        project: ['./tsconfig.json'],
        tsconfigRootDir: import.meta.dirname,
      },
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
