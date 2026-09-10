#!/usr/bin/env node
/**
 * Déploie le build du plugin dans un coffre Obsidian de test.
 *
 * Le coffre est **externe au dépôt**, et c'est délibéré : le développement se
 * fait en worktrees (une par branche). Un coffre versionné dans l'arborescence
 * du dépôt en produirait un par worktree, chacun avec son propre `data.json` —
 * autant de configurations divergentes à maintenir. On veut l'inverse : **un
 * seul coffre**, dans lequel on déploie la branche du moment.
 *
 * Résolution du chemin, par ordre de priorité :
 *   1. `--vault <chemin>` en argument ;
 *   2. variable d'environnement `OBSIDIAN_TEST_VAULT`.
 *
 * Aucun repli implicite : sans l'un des deux, le script échoue avec la marche à
 * suivre plutôt que de recréer un coffre local en douce.
 *
 * Le déploiement :
 *   - préserve `data.json` (les réglages de recette survivent) ;
 *   - suffixe la version du manifest en `-dev.<branche>.<horodatage>`, pour lire
 *     directement dans Obsidian **quelle branche** est chargée.
 */

import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';

const PLUGIN_ID = 'vps-publish';

function resolveVaultPath() {
  const flagIndex = process.argv.indexOf('--vault');
  const fromFlag = flagIndex !== -1 ? process.argv[flagIndex + 1] : undefined;
  const vault = fromFlag ?? process.env.OBSIDIAN_TEST_VAULT;

  if (!vault) {
    throw new Error(
      [
        'Aucun coffre de test défini.',
        '',
        'Renseigner la variable OBSIDIAN_TEST_VAULT avec le chemin du coffre Obsidian',
        'de recette (une fois pour toutes, elle est partagée par toutes les worktrees) :',
        '',
        '  PowerShell :  setx OBSIDIAN_TEST_VAULT "C:\\chemin\\vers\\mon-coffre"',
        '  bash/zsh   :  export OBSIDIAN_TEST_VAULT="$HOME/chemin/vers/mon-coffre"',
        '',
        'Ou la passer ponctuellement :',
        '',
        '  nx run vps-publish:deploy-to-vault --args="--vault C:\\chemin\\vers\\mon-coffre"',
      ].join('\n')
    );
  }

  if (!fs.existsSync(vault)) {
    throw new Error(`Coffre introuvable : ${vault}`);
  }

  if (!fs.existsSync(path.join(vault, '.obsidian'))) {
    throw new Error(
      `${vault} ne ressemble pas à un coffre Obsidian (pas de dossier .obsidian).\n` +
        `Ouvrir le dossier au moins une fois dans Obsidian avant de déployer.`
    );
  }

  return vault;
}

function currentBranch(root) {
  try {
    return execFileSync('git', ['rev-parse', '--abbrev-ref', 'HEAD'], {
      cwd: root,
      encoding: 'utf8',
    })
      .trim()
      // Les identifiants de prerelease semver n'acceptent que [0-9A-Za-z-].
      .replace(/[^0-9A-Za-z-]+/g, '-');
  } catch {
    return 'detached';
  }
}

function timestamp() {
  const now = new Date();
  const pad = (value) => String(value).padStart(2, '0');
  return (
    `${now.getFullYear()}${pad(now.getMonth() + 1)}${pad(now.getDate())}` +
    `-${pad(now.getHours())}${pad(now.getMinutes())}${pad(now.getSeconds())}`
  );
}

function main() {
  const root = process.cwd();
  const buildDir = path.join(root, 'dist', PLUGIN_ID);

  if (!fs.existsSync(buildDir)) {
    throw new Error(`Build introuvable : ${buildDir}. Lancer la cible \`package\` d'abord.`);
  }

  const vault = resolveVaultPath();
  const pluginDir = path.join(vault, '.obsidian', 'plugins', PLUGIN_ID);
  const dataFile = path.join(pluginDir, 'data.json');

  const preservedData = fs.existsSync(dataFile) ? fs.readFileSync(dataFile, 'utf8') : null;

  fs.rmSync(pluginDir, { recursive: true, force: true });
  fs.mkdirSync(pluginDir, { recursive: true });
  fs.cpSync(buildDir, pluginDir, { recursive: true });

  if (preservedData) {
    fs.writeFileSync(dataFile, preservedData, 'utf8');
  }

  const manifestPath = path.join(pluginDir, 'manifest.json');
  const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
  manifest.version = `${manifest.version}-dev.${currentBranch(root)}.${timestamp()}`;
  fs.writeFileSync(manifestPath, JSON.stringify(manifest, null, 2), 'utf8');

  console.log(`déployé dans ${pluginDir}`);
  console.log(`version      ${manifest.version}`);
  console.log(preservedData ? 'data.json    préservé' : 'data.json    absent (première pose)');
}

try {
  main();
} catch (error) {
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
}
