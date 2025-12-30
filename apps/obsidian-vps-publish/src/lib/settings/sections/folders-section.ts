import type { FolderConfig } from '@core-domain/entities/folder-config';
import type { SanitizationRulesDefaults } from '@core-domain/entities/sanitization-rules';
import type { VpsConfig } from '@core-domain/entities/vps-config';
import { Notice, Setting } from 'obsidian';

import type { Translations } from '../../../i18n';
import { translate } from '../../../i18n';
import { FileSuggest } from '../../suggesters/file-suggester';
import { FolderSuggest } from '../../suggesters/folder-suggester';
import type { SettingsViewContext } from '../context';

/**
 * Helper to get nested translation value from a key like "settings.cleanupRules.removeCodeBlocks.name"
 */
function getNestedTranslation(t: Translations, key: string): string | undefined {
  const parts = key.split('.');
  // Type-safe traversal of translation object structure
  let current: unknown = t;
  for (const part of parts) {
    if (current && typeof current === 'object' && current !== null && part in current) {
      current = (current as Record<string, unknown>)[part];
    } else {
      return undefined;
    }
  }
  return typeof current === 'string' ? current : undefined;
}

/**
 * Render folders section - now organized by VPS
 */
export function renderFoldersSection(root: HTMLElement, ctx: SettingsViewContext): void {
  const { t, settings, logger } = ctx;

  const folderBlock = root.createDiv({ cls: 'ptpv-block' });

  new Setting(folderBlock).setName(t.settings.folders.title).setHeading();

  // Render folders organized by VPS
  settings.vpsConfigs.forEach((vps, vpsIndex) => {
    const vpsSection = folderBlock.createDiv({ cls: 'ptpv-folders-vps-section' });

    new Setting(vpsSection)
      .setName(
        `${vps.name || translate(t, 'common.vpsNumberFallback', { number: (vpsIndex + 1).toString() })} - ${t.settings.folders.foldersLabel ?? 'Folders'}`
      )
      .setHeading();

    const vpsFolders = vps.folders || [];

    // Ensure at least one folder per VPS
    if (vpsFolders.length === 0) {
      logger.debug('No folder found for VPS, creating default', { vpsId: vps.id });
      const defaultFolder: FolderConfig = {
        id: `folder-${Date.now()}`,
        vpsId: vps.id,
        vaultFolder: '',
        routeBase: '/',
        ignoredCleanupRuleIds: [],
      };
      vps.folders = [defaultFolder];
    }

    vps.folders.forEach((folderCfg, folderIndex) => {
      renderFolderConfig(vpsSection, vps, folderCfg, folderIndex, ctx);
    });

    // Add folder button for this VPS
    const rowAddFolder = vpsSection.createDiv({
      cls: 'ptpv-button-row',
    });
    const btnAddFolder = rowAddFolder.createEl('button', {
      text: t.settings.folders.addButton ?? 'Add folder',
    });
    btnAddFolder.onclick = () => {
      logger.debug('Adding new folder to VPS', { vpsId: vps.id });
      const newFolder: FolderConfig = {
        id: `folder-${Date.now()}`,
        vpsId: vps.id,
        vaultFolder: '',
        routeBase: '/',
        ignoredCleanupRuleIds: [],
      };
      vps.folders.push(newFolder);
      void ctx.save().then(() => ctx.refresh());
    };
  });
}

/**
 * Render a single folder configuration
 */
function renderFolderConfig(
  container: HTMLElement,
  vps: VpsConfig,
  folderCfg: FolderConfig,
  index: number,
  ctx: SettingsViewContext
): void {
  const { t, logger } = ctx;

  const singleFolderFieldset = container.createEl('fieldset', {
    cls: 'ptpv-folder',
  });

  singleFolderFieldset.createEl('legend', {
    text:
      folderCfg.vaultFolder && folderCfg.vaultFolder.length > 0
        ? folderCfg.vaultFolder
        : `${t.settings.folders.vaultLabel} #${index + 1}`,
  });

  // Delete folder button
  const folderSetting = new Setting(singleFolderFieldset).setName(
    t.settings.folders.deleteButton ?? 'Delete folder'
  );

  folderSetting.addButton((btn) => {
    btn.setIcon('trash').onClick(() => {
      if (vps.folders.length <= 1) {
        logger.warn('Attempted to delete last folder from VPS, forbidden.', { vpsId: vps.id });
        new Notice(
          t.settings.folders.deleteLastForbidden ?? 'At least one folder is required per VPS.'
        );
        return;
      }
      logger.debug('Folder deleted', { vpsId: vps.id, folderId: folderCfg.id });
      const folderIdx = vps.folders.findIndex((f) => f.id === folderCfg.id);
      if (folderIdx !== -1) {
        vps.folders.splice(folderIdx, 1);
      }
      void ctx.save().then(() => ctx.refresh());
    });
  });

  // Vault folder path
  const vaultSetting = new Setting(singleFolderFieldset)
    .setName(t.settings.folders.vaultLabel)
    .setDesc(t.settings.folders.vaultDescription);

  vaultSetting.addText((text) => {
    text
      .setPlaceholder(translate(t, 'placeholders.vaultFolder'))
      .setValue(folderCfg.vaultFolder)
      .onChange((value) => {
        logger.debug('Folder vaultFolder changed', { folderId: folderCfg.id, value });
        folderCfg.vaultFolder = value.trim();
        void ctx.save();
      });

    new FolderSuggest(ctx.app, text.inputEl);
  });

  // Route base
  const routeSetting = new Setting(singleFolderFieldset)
    .setName(t.settings.folders.routeLabel)
    .setDesc(t.settings.folders.routeDescription);

  routeSetting.addText((text) =>
    text
      .setPlaceholder(translate(t, 'placeholders.routePath'))
      .setValue(folderCfg.routeBase)
      .onChange((value) => {
        let route = value.trim();
        if (!route) {
          route = '/';
        }
        if (!route.startsWith('/')) {
          route = '/' + route;
        }
        logger.debug('Folder routeBase changed', { folderId: folderCfg.id, route });
        folderCfg.routeBase = route;
        void ctx.save();
      })
  );

  // Custom index file
  const customIndexSetting = new Setting(singleFolderFieldset)
    .setName(t.settings.folders.customIndexLabel)
    .setDesc(t.settings.folders.customIndexDescription);

  customIndexSetting.addText((text) => {
    text
      .setPlaceholder(translate(t, 'placeholders.customIndexFile'))
      .setValue(folderCfg.customIndexFile ?? '')
      .onChange((value) => {
        const trimmed = value.trim();
        logger.debug('Folder customIndexFile changed', { folderId: folderCfg.id, value: trimmed });
        folderCfg.customIndexFile = trimmed || undefined;
        void ctx.save();
      });

    new FileSuggest(ctx.app, text.inputEl);
  });

  // Flatten tree option
  new Setting(singleFolderFieldset)
    .setName(t.settings.folders.flattenTreeLabel)
    .setDesc(t.settings.folders.flattenTreeDescription)
    .addToggle((toggle) =>
      toggle.setValue(folderCfg.flattenTree ?? false).onChange((value) => {
        logger.debug('Folder flattenTree changed', { folderId: folderCfg.id, value });
        folderCfg.flattenTree = value;
        void ctx.save();
      })
    );

  // Cleanup rules ignore section
  renderCleanupRulesIgnoreSection(singleFolderFieldset, vps, folderCfg, ctx);
}

/**
 * Render section to manage which VPS cleanup rules this folder ignores
 */
function renderCleanupRulesIgnoreSection(
  container: HTMLElement,
  vps: VpsConfig,
  folderCfg: FolderConfig,
  ctx: SettingsViewContext
): void {
  const { t, logger } = ctx;

  if (!vps.cleanupRules || vps.cleanupRules.length === 0) {
    // No cleanup rules on this VPS, nothing to ignore
    return;
  }

  const ignoreSection = container.createDiv({ cls: 'ptpv-folder-cleanup-ignore' });

  new Setting(ignoreSection)
    .setName(t.settings.folders.ignoredCleanupRulesTitle ?? 'Ignored Cleanup Rules')
    .setDesc(
      t.settings.folders.ignoredCleanupRulesDescription ??
        'Select which VPS cleanup rules should NOT be applied to this folder'
    );

  // Ensure ignoredCleanupRuleIds exists
  if (!Array.isArray(folderCfg.ignoredCleanupRuleIds)) {
    folderCfg.ignoredCleanupRuleIds = [];
  }

  const rulesContainer = ignoreSection.createDiv({ cls: 'ptpv-cleanup-ignore-list' });

  vps.cleanupRules.forEach((rule) => {
    const isIgnored = folderCfg.ignoredCleanupRuleIds.includes(rule.id);

    // Get translated name if available (for default rules)
    const nameKey = (rule as SanitizationRulesDefaults).nameKey;
    const displayName = nameKey ? getNestedTranslation(t, nameKey) || rule.name : rule.name;

    const ruleSetting = new Setting(rulesContainer)
      .setName(displayName || rule.id)
      .setDesc(rule.regex ? `Pattern: ${rule.regex}` : '');

    ruleSetting.addToggle((toggle) =>
      toggle
        .setValue(isIgnored)
        .setTooltip(isIgnored ? 'Ignored by this folder' : 'Applied to this folder')
        .onChange((value) => {
          logger.debug('Folder cleanup rule ignore toggled', {
            folderId: folderCfg.id,
            ruleId: rule.id,
            ignored: value,
          });

          if (value) {
            // Add to ignored list
            if (!folderCfg.ignoredCleanupRuleIds.includes(rule.id)) {
              folderCfg.ignoredCleanupRuleIds.push(rule.id);
            }
          } else {
            // Remove from ignored list
            const idx = folderCfg.ignoredCleanupRuleIds.indexOf(rule.id);
            if (idx !== -1) {
              folderCfg.ignoredCleanupRuleIds.splice(idx, 1);
            }
          }

          void ctx.save();
        })
    );
  });
}
