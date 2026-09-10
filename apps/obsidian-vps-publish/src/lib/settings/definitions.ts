import type { VpsConfig } from '@core-domain/entities/vps-config';
import type { SettingDefinitionItem, SettingDefinitionPage } from 'obsidian';

import { translate } from '../../i18n';
import type { SettingsViewContext } from './context';
import { SectionPage, type SectionRenderer } from './section-page';
import { renderAdvancedContent } from './sections/advanced-section';
import { renderGlobalIgnoreRules, renderVpsIgnoreRules } from './sections/ignore-rules-section';
import { hasUnsavedRouteChanges, renderVpsRoutes } from './sections/routes-section';
import { addVpsConfig, renderCleanupRulesSection, renderVpsDetails } from './sections/vps-section';

/**
 * Arbre déclaratif des réglages, consommé par `getSettingDefinitions()` sur
 * Obsidian 1.13+.
 *
 * ## Pourquoi cette arborescence
 *
 * L'interface historique range **par fonctionnalité puis par serveur** : trois
 * sections (Serveurs, Routes, Règles d'ignore) qui bouclent chacune sur
 * `vpsConfigs`. Avec trois serveurs, cela fait neuf blocs répartis dans un seul
 * écran qui défile, alors que personne ne se dit « je vais régler les routes,
 * tous serveurs confondus ».
 *
 * Ici c'est l'inverse : **le serveur est l'entité**. Chacun est une entrée de
 * liste ouvrant sa propre page, avec dessous ce qui le concerne — connexion,
 * routes, règles d'ignore, nettoyage.
 *
 * ## Ce qui est déclaratif et ce qui ne l'est pas
 *
 * Les réglages unitaires (langue, dossier d'assets, repli) sont de vrais
 * contrôles : ils deviennent **cherchables** dans les paramètres d'Obsidian.
 * Les sections dynamiques restent rendues par les fonctions impératives
 * existantes, via {@link SectionPage} — aucune interface n'est dupliquée, et le
 * chemin `display()` des versions < 1.13 appelle exactement le même code.
 *
 * Les valeurs des contrôles transitent par `getControlValue` / `setControlValue`,
 * surchargés sur le setting tab pour passer par le `save()` du plugin
 * (chiffrement des clés d'API, normalisation).
 */
export function buildSettingDefinitions(ctx: SettingsViewContext): SettingDefinitionItem[] {
  const { t, settings, logger } = ctx;

  const page = (title: string, renderSection: SectionRenderer): SettingDefinitionPage => ({
    type: 'page',
    name: title,
    page: () => new SectionPage(title, ctx, renderSection),
  });

  const vpsLabel = (vps: VpsConfig, index: number): string =>
    vps.name || translate(t, 'common.vpsNumberFallback', { number: (index + 1).toString() });

  /** Un serveur = une page, avec ses quatre volets. */
  const vpsPage = (vps: VpsConfig, index: number): SettingDefinitionPage => ({
    type: 'page',
    name: vpsLabel(vps, index),
    desc: vps.baseUrl,
    // Visible sur l'entrée, sans avoir à ouvrir la page.
    displayValue: () => vps.baseUrl,
    // Les routes sont la seule section à travailler sur un brouillon : on
    // signale ici qu'il reste des modifications non enregistrées, au lieu de
    // laisser l'utilisateur le découvrir en les perdant.
    status: () => (hasUnsavedRouteChanges(vps.id) ? 'warning' : null),
    items: [
      page(t.settings.vps.connectionTitle, (root, c) =>
        renderVpsDetails(root, vps, index, c, { includeCleanupRules: false })
      ),
      page(t.settings.folders.title, (root, c) => renderVpsRoutes(root, vps, c)),
      page(t.settings.ignoreRules.title, (root, c) => renderVpsIgnoreRules(root, vps, c)),
      page(t.settings.vps.cleanupRulesTitle, (root, c) => renderCleanupRulesSection(root, vps, c)),
    ],
  });

  return [
    {
      name: t.help.settingsButtonLabel,
      desc: t.help.settingsButtonDescription,
      action: () => {
        // require paresseux : évite un cycle d'import avec le modal d'aide.
        const { HelpModal } = require('../modals/help-modal');
        new HelpModal(ctx.app, t).open();
      },
    },
    {
      name: t.settings.language.label,
      desc: t.settings.language.description,
      control: {
        type: 'dropdown',
        key: 'locale',
        defaultValue: 'system',
        options: {
          system: t.settings.language.system,
          en: 'English',
          fr: 'Français',
        },
      },
    },
    {
      type: 'group',
      heading: t.settings.vault.title,
      items: [
        {
          name: t.settings.vault.assetsFolderLabel,
          desc: t.settings.vault.assetsFolderDescription,
          control: { type: 'folder', key: 'assetsFolder', defaultValue: 'assets' },
        },
        {
          name: t.settings.vault.enableAssetsVaultFallbackLabel,
          desc: t.settings.vault.enableAssetsVaultFallbackDescription,
          control: { type: 'toggle', key: 'enableAssetsVaultFallback' },
        },
      ],
    },
    {
      type: 'list',
      heading: t.settings.vps.title,
      emptyState: t.settings.vps.help,
      items: settings.vpsConfigs.map(vpsPage),
      addItem: {
        name: t.settings.vps.addButton,
        action: () => {
          logger.debug('Adding a VPS from the declarative settings list');
          void addVpsConfig(ctx);
        },
      },
    },
    page(t.settings.ignoreRules.globalTitle ?? 'Global ignore rules', renderGlobalIgnoreRules),
    page(t.settings.advanced.title, renderAdvancedContent),
  ];
}
