// Lint « revue du répertoire » : la config du miroir vps-publish, rejouée sur les
// sources du monorepo.
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
// COMMENT IL RESTE FIDÈLE AU MIROIR
// Aucune règle n'est recopiée ici. La config du miroir
// (`tools/mirror/templates/vps-publish/eslint.config.mjs`), qui est celle réellement
// scannée par le répertoire, est importée telle quelle ; ce fichier n'en change que les
// chemins :
//   - `files` : les sources du monorepo à la place de `**/*.ts` du miroir ;
//   - `parserOptions.project` : `tsconfig.directory.json`, qui reprend les options du
//     `tsconfig.json` du miroir, à la place de `./tsconfig.json` ;
//   - `ignores` : les suites de tests sont hors périmètre, la revue du répertoire n'en
//     a jamais signalé une seule et le miroir n'en embarque aucune. Le bloc propre aux
//     suites est donc écarté.
// Toute règle ajoutée ou changée côté miroir s'applique ici sans autre édition.
//
// Le fichier est en .mjs : eslint-plugin-obsidianmd est ESM pur.
import { resolve } from 'node:path';

import mirrorConfig from '../../tools/mirror/templates/vps-publish/eslint.config.mjs';

const REPO_ROOT = resolve(import.meta.dirname, '../..');
const SOURCES = ['apps/obsidian-vps-publish/src/**/*.ts', 'libs/*/src/**/*.ts'];
const TESTS = ['**/*.test.ts', '**/*.spec.ts', '**/__mocks__/**'];

const isGlobalIgnores = (block) => Object.keys(block).length === 1 && Array.isArray(block.ignores);
const isTestsBlock = (block) =>
  !block.ignores && Array.isArray(block.files) && block.files.includes('**/*.test.ts');

function retarget(block) {
  if (isGlobalIgnores(block)) {
    return { ...block, ignores: [...block.ignores, 'tmp/**'] };
  }

  const parserOptions = block.languageOptions?.parserOptions;
  return {
    ...block,
    ...(block.files?.includes('**/*.ts') ? { files: SOURCES } : {}),
    ignores: [...(block.ignores ?? []), ...TESTS],
    ...(parserOptions?.project
      ? {
          languageOptions: {
            ...block.languageOptions,
            parserOptions: {
              ...parserOptions,
              project: ['./apps/obsidian-vps-publish/tsconfig.directory.json'],
              tsconfigRootDir: REPO_ROOT,
            },
          },
        }
      : {}),
  };
}

const retargeted = mirrorConfig.filter((block) => !isTestsBlock(block)).map(retarget);

// Garde-fou : si le miroir change de forme (autres globs, `projectService`...), le retarget
// ne reconnaîtrait plus rien et le lint passerait sans la config voulue. Mieux vaut échouer
// ici, avec une cause lisible, que de dériver en silence.
const hasRetargetedFiles = retargeted.some((block) => block.files === SOURCES);
const hasRetargetedProject = retargeted.some(
  (block) => block.languageOptions?.parserOptions?.tsconfigRootDir === REPO_ROOT
);
if (!hasRetargetedFiles || !hasRetargetedProject) {
  throw new Error(
    'eslint.directory.config.mjs : la config du miroir a changé de forme, mettre à jour retarget() ' +
      `(blocs files retargetés : ${hasRetargetedFiles}, blocs parserOptions.project retargetés : ${hasRetargetedProject}).`
  );
}

export default retargeted;
