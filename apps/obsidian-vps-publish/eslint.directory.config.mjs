// Lint « revue du répertoire » : les règles que la revue automatisée d'Obsidian
// applique au miroir vps-publish, rejouées ici sur les sources du monorepo.
//
// POURQUOI CE FICHIER EXISTE
// Le lint habituel du monorepo (`nx lint`) ne charge pas eslint-plugin-obsidianmd.
// Chaque avertissement de la revue n'était donc découvert qu'après la release, sur
// le miroir. C'est ce trou qui a fait tomber la 6.23.0, puis qui a laissé passer les
// timers nus de la 6.24.4. La cible `obsidian-vps-publish:lint:directory` exécute ce
// fichier en CI avec un plafond `--max-warnings` : le compte ne peut plus monter.
// Le plafond ne se resserre pas tout seul : quand un lot fait baisser le compte,
// abaisser `--max-warnings` dans `project.json` dans le même commit.
//
// À garder aligné sur `tools/mirror/templates/vps-publish/eslint.config.mjs`, qui est
// la config réellement scannée. Seuls changent les chemins (`src/` du miroir devient
// `apps/obsidian-vps-publish/src/`, et les libs sont lintées depuis leurs sources).
//
// Le fichier est en .mjs : eslint-plugin-obsidianmd est ESM pur.
import { resolve } from 'node:path';

import tsPlugin from '@typescript-eslint/eslint-plugin';
import tsParser from '@typescript-eslint/parser';
import obsidianmd from 'eslint-plugin-obsidianmd';

const SOURCES = ['apps/obsidian-vps-publish/src/**/*.ts', 'libs/*/src/**/*.ts'];
const NOT_SHIPPED = ['**/*.test.ts', '**/*.spec.ts', '**/__mocks__/**'];

export default [
  { ignores: ['**/node_modules/**', 'dist/**', 'tmp/**', '**/*.d.ts'] },

  ...obsidianmd.configs.recommended.map((block) => ({
    ...block,
    ignores: [...(block.ignores ?? []), ...NOT_SHIPPED],
  })),

  {
    files: SOURCES,
    ignores: NOT_SHIPPED,
    languageOptions: {
      parser: tsParser,
      parserOptions: {
        ecmaVersion: 2022,
        sourceType: 'module',
        project: ['./tsconfig.base.json'],
        tsconfigRootDir: resolve(import.meta.dirname, '../..'),
      },
    },
    plugins: { '@typescript-eslint': tsPlugin },
    // Mêmes sévérités que la config du miroir : obsidianmd et les restrictions sur
    // les directives restent en erreur, les règles typées listées en « Warning » par
    // la revue restent en avertissement (le plafond de la cible les tient).
    rules: {
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
];
