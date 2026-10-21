// Hook Claude Code (PostToolUse sur Edit/Write) : lint « revue du répertoire » du
// fichier TypeScript qui vient d'être modifié, pour corriger pendant l'écriture au lieu
// d'attendre la CI. Sortie 2 = les constats sont renvoyés à Claude.
import { readFileSync } from 'node:fs';
import { relative, resolve } from 'node:path';

const projectDir = process.env.CLAUDE_PROJECT_DIR ?? process.cwd();
let filePath;
try {
  const input = JSON.parse(readFileSync(0, 'utf8').replace(/^\uFEFF/, ''));
  filePath = input.tool_input?.file_path;
} catch (error) {
  // Entrée absente ou illisible : rien à linter. Sortie 0 pour ne pas bloquer l'édition ;
  // le hook ne doit pas planter sur une charge qu'il ne maîtrise pas.
  process.stderr.write(`Hook lint-directory : entrée illisible, ignorée (${String(error)}).\n`);
  process.exit(0);
}
if (typeof filePath !== 'string' || filePath.length === 0) process.exit(0);

const rel = relative(projectDir, resolve(projectDir, filePath)).replaceAll('\\', '/');
const isShippedSource =
  /^(apps\/obsidian-vps-publish|libs\/[^/]+)\/src\/.*\.ts$/.test(rel) &&
  !/(\.test\.ts|\.spec\.ts|\.d\.ts)$|\/__mocks__\//.test(rel);
if (!isShippedSource) process.exit(0);

let result;
try {
  const { ESLint } = await import('eslint');
  const eslint = new ESLint({
    cwd: projectDir,
    overrideConfigFile: 'apps/obsidian-vps-publish/eslint.directory.config.mjs',
  });
  [result] = await eslint.lintFiles([rel]);
} catch (error) {
  // Exit 2 plutôt qu'une exception : un hook qui plante en silence désactiverait le garde-fou.
  process.stderr.write(`Lint « revue du répertoire » non exécuté sur ${rel} : ${String(error)}\n`);
  process.exit(2);
}
if (!result || result.messages.length === 0) process.exit(0);

const lines = result.messages.map(
  (m) =>
    `${rel}:${m.line ?? 0}:${m.column ?? 0} ${m.severity === 2 ? 'error' : 'warning'} ${m.ruleId ?? ''} ${m.message}`
);
process.stderr.write(
  [
    `Lint « revue du répertoire Obsidian » : ${lines.length} constat(s) dans ${rel}.`,
    "Corrige ceux que ta modification a introduits. Des avertissements antérieurs peuvent figurer dans la liste ; n'en ajoute pas.",
    "Ne désactive jamais une règle obsidianmd par un commentaire eslint-disable : le répertoire l'interdit.",
    ...lines,
  ].join('\n') + '\n'
);
process.exit(2);
