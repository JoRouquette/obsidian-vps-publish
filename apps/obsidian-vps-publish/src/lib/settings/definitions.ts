import type { SettingDefinitionItem } from 'obsidian';

import type { SettingsViewContext } from './context';
import { type SectionRenderer, SectionPage } from './section-page';
import { renderAdvancedSection } from './sections/advanced-section';
import { renderIgnoreRulesSection } from './sections/ignore-rules-section';
import { renderRoutesSection } from './sections/routes-section';
import { renderVpsSection } from './sections/vps-section';

/**
 * Arbre déclaratif des réglages, consommé par `getSettingDefinitions()` sur
 * Obsidian 1.13+.
 *
 * Deux traitements selon la nature du réglage :
 *
 * - les réglages **unitaires** (langue, dossier d'assets, bascule de repli) sont
 *   de vrais contrôles déclaratifs : ils deviennent **cherchables** dans les
 *   paramètres d'Obsidian, ce qui est tout l'intérêt de l'API ;
 * - les sections **dynamiques** deviennent des sous-pages qui délèguent aux
 *   renderers existants via {@link SectionPage} — aucune duplication.
 *
 * Les valeurs des contrôles déclaratifs transitent par `getControlValue` /
 * `setControlValue`, surchargés sur le setting tab pour passer par le `save()`
 * du plugin (chiffrement des clés d'API, normalisation).
 */
export function buildSettingDefinitions(ctx: SettingsViewContext): SettingDefinitionItem[] {
  const { t } = ctx;

  const sectionPage = (title: string, renderSection: SectionRenderer): SettingDefinitionItem => ({
    type: 'page',
    name: title,
    page: () => new SectionPage(title, ctx, renderSection),
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
          control: {
            type: 'folder',
            key: 'assetsFolder',
            defaultValue: 'assets',
          },
        },
        {
          name: t.settings.vault.enableAssetsVaultFallbackLabel,
          desc: t.settings.vault.enableAssetsVaultFallbackDescription,
          control: {
            type: 'toggle',
            key: 'enableAssetsVaultFallback',
          },
        },
      ],
    },
    sectionPage(t.settings.folders.title, renderRoutesSection),
    sectionPage(t.settings.ignoreRules.title, renderIgnoreRulesSection),
    sectionPage(t.settings.vps.title, renderVpsSection),
    sectionPage(t.settings.advanced.title, renderAdvancedSection),
  ];
}
