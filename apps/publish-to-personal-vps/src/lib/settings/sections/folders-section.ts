import { Notice, Setting } from 'obsidian';
import { FolderSuggest } from '../../suggesters/folder-suggester';
import {
  createDefaultFolderConfig,
  defaultSanitizationRules,
} from '../../utils/create-default-folder-config.util';
import type { SettingsViewContext } from '../context';
import type {
  SanitizationRules,
  SanitizationRulesDefaults,
} from '@core-domain/entities/sanitization-rules';

export function renderFoldersSection(root: HTMLElement, ctx: SettingsViewContext): void {
  const { t, settings, logger } = ctx;

  const folderBlock = root.createDiv({ cls: 'ptpv-block' });
  const folderBlockTitle = folderBlock.createDiv({
    cls: 'ptpv-block-title',
  });
  folderBlockTitle.createEl('h6', { text: t.settings.folders.title });

  const vpsOptions = settings.vpsConfigs ?? [];
  const fallbackVpsId = vpsOptions[0]?.id ?? 'default';

  if (settings.folders.length === 0) {
    logger.info('No folder config found, creating default.');
    settings.folders.push(createDefaultFolderConfig(fallbackVpsId));
  }

  settings.folders.forEach((folderCfg, index) => {
    ensureSanitizationArray(folderCfg);

    const singleFolderFieldset = folderBlock.createEl('fieldset', {
      cls: 'ptpv-folder',
    });

    singleFolderFieldset.createEl('legend', {
      text:
        folderCfg.vaultFolder && folderCfg.vaultFolder.length > 0
          ? folderCfg.vaultFolder
          : `${t.settings.folders.vaultLabel} #${index + 1}`,
    });

    const folderSetting = new Setting(singleFolderFieldset).setName(
      t.settings.folders.deleteButton ?? 'Delete folder'
    );

    folderSetting.addButton((btn) => {
      btn.setIcon('trash').onClick(async () => {
        if (settings.folders.length <= 1) {
          logger.warn('Attempted to delete last folder, forbidden.');
          new Notice(t.settings.folders.deleteLastForbidden ?? 'At least one folder is required.');
          return;
        }
        logger.info('Folder deleted', { index, folder: folderCfg });
        settings.folders.splice(index, 1);
        await ctx.save();
        ctx.refresh();
      });
    });

    new Setting(singleFolderFieldset)
      .setName(t.settings.folders.vpsLabel)
      .setDesc(t.settings.folders.vpsDescription)
      .addDropdown((dropdown) => {
        const currentVpsId =
          (folderCfg.vpsId && vpsOptions.find((v) => v.id === folderCfg.vpsId)?.id) ||
          fallbackVpsId;

        vpsOptions.forEach((vps) => dropdown.addOption(vps.id, vps.name || vps.id));

        dropdown.setValue(currentVpsId).onChange(async (value) => {
          logger.debug('Folder vpsId changed', { index, value });
          folderCfg.vpsId = value;
          await ctx.save();
        });
      });

    const vaultSetting = new Setting(singleFolderFieldset)
      .setName(t.settings.folders.vaultLabel)
      .setDesc(t.settings.folders.vaultDescription);

    vaultSetting.addText((text) => {
      text
        .setPlaceholder('Blog')
        .setValue(folderCfg.vaultFolder)
        .onChange(async (value) => {
          logger.debug('Folder vaultFolder changed', { index, value });
          folderCfg.vaultFolder = value.trim();
          await ctx.save();
        });

      new FolderSuggest(ctx.app, text.inputEl);
    });

    const routeSetting = new Setting(singleFolderFieldset)
      .setName(t.settings.folders.routeLabel)
      .setDesc(t.settings.folders.routeDescription);

    routeSetting.addText((text) =>
      text
        .setPlaceholder('/blog')
        .setValue(folderCfg.routeBase)
        .onChange(async (value) => {
          let route = value.trim();
          if (!route) {
            route = '/';
          }
          if (!route.startsWith('/')) {
            route = '/' + route;
          }
          logger.debug('Folder routeBase changed', { index, route });
          folderCfg.routeBase = route;
          await ctx.save();
        })
    );

    const sanitizeSetting = new Setting(singleFolderFieldset)
      .setName(t.settings.folders.sanitizationTitle)
      .setDesc(t.settings.folders.sanitizationHelp ?? '');

    const sanitizationContainer = singleFolderFieldset.createDiv({ cls: 'ptpv-sanitization' });

    (folderCfg.sanitization || []).forEach((rule, ruleIndex) => {
      renderSanitizationRule(
        sanitizationContainer,
        rule,
        () => folderCfg.sanitization || [],
        async () => {
          (folderCfg.sanitization || []).splice(ruleIndex, 1);
          await ctx.save();
          ctx.refresh();
        },
        async () => {
          await ctx.save();
        },
        t.settings.folders,
        logger
      );
    });

    const addRuleRow = sanitizationContainer.createDiv({ cls: 'ptpv-button-row' });
    const addRuleBtn = addRuleRow.createEl('button', {
      text: t.settings.folders.addSanitizationRule ?? 'Add rule',
    });
    addRuleBtn.addClass('mod-cta');
    addRuleBtn.onclick = async () => {
      folderCfg.sanitization = folderCfg.sanitization || [];
      folderCfg.sanitization.push({
        name: 'Custom rule',
        regex: '',
        replacement: '',
        isEnabled: true,
      });
      await ctx.save();
      ctx.refresh();
    };
  });

  const rowAddFolder = folderBlock.createDiv({
    cls: 'ptpv-button-row',
  });
  const btnAddFolder = rowAddFolder.createEl('button', {
    text: t.settings.folders.addButton ?? 'Add folder',
  });
  btnAddFolder.addClass('mod-cta');
  btnAddFolder.onclick = async () => {
    const vpsId = settings.vpsConfigs?.[0]?.id ?? 'default';
    logger.info('Adding new folder config', { vpsId });
    settings.folders.push(createDefaultFolderConfig(vpsId));
    await ctx.save();
    ctx.refresh();
  };
}

function ensureSanitizationArray(folderCfg: any) {
  if (!Array.isArray(folderCfg.sanitization)) {
    if (folderCfg.sanitization) {
      const defaults = defaultSanitizationRules();
      folderCfg.sanitization = defaults;
    } else {
      folderCfg.sanitization = defaultSanitizationRules();
    }
  }
}

function renderSanitizationRule(
  container: HTMLElement,
  rule: SanitizationRules | SanitizationRulesDefaults,
  getRules: () => SanitizationRules[],
  onDelete: () => Promise<void>,
  onSave: () => Promise<void>,
  tFolders: any,
  logger: any
) {
  const isDefaultRule = (rule as any)?.isDefault === true;
  const wrapper = container.createDiv({ cls: 'ptpv-sanitization-rule' });

  const defaultRuleHeader = wrapper.createDiv({ cls: 'ptpv-sanitization-rule-default-banner' });
  defaultRuleHeader
    .createEl('h6', {
      text: tFolders.defaultSanitizationRuleBanner,
    })
    .setCssProps({ display: isDefaultRule ? 'block' : 'none' });

  const header = new Setting(wrapper).setName(tFolders.ruleNameLabel ?? 'Rule name');

  header.addText((text) =>
    text
      .setValue(rule.name || '')
      .setDisabled(isDefaultRule)
      .onChange(async (value) => {
        rule.name = value;
        await onSave();
      })
  );

  header.addToggle((toggle) =>
    toggle
      .setValue(rule.isEnabled ?? true)
      .setTooltip(tFolders.ruleEnabledLabel ?? 'Enabled')
      .onChange(async (value) => {
        rule.isEnabled = value;
        await onSave();
      })
  );

  if (!isDefaultRule) {
    header.addExtraButton((btn) =>
      btn
        .setIcon('trash')
        .setTooltip(tFolders.deleteSanitizationRule ?? 'Delete rule')
        .onClick(async () => {
          if ((getRules()?.length ?? 0) <= 1) {
            logger.warn('Attempted to delete last sanitization rule; keeping at least one.');
            return;
          }
          await onDelete();
        })
    );
  }

  const patternSetting = new Setting(wrapper)
    .setName(tFolders.rulePatternLabel ?? 'Pattern (regex)')
    .addText((text) =>
      text
        .setPlaceholder('e.g. ```[\\s\\S]*?```')
        .setValue(typeof rule.regex === 'string' ? rule.regex : rule.regex?.source || '')
        .setDisabled(isDefaultRule)
        .onChange(async (value) => {
          rule.regex = value;
          await onSave();
        })
    );

  const replacementSetting = new Setting(wrapper)
    .setName(tFolders.ruleReplacementLabel ?? 'Replacement')
    .addText((text) =>
      text
        .setValue(rule.replacement || '')
        .setDisabled((rule as any)?.isDefault === true)
        .onChange(async (value) => {
          rule.replacement = value;
          await onSave();
        })
    );

  // Visually dim when disabled but inputs stay editable; toggle remains the single enable control.
  const syncDisabled = () => {
    const enabled = rule.isEnabled ?? true;
    patternSetting.settingEl.toggleClass('ptpv-disabled', !enabled);
    replacementSetting.settingEl.toggleClass('ptpv-disabled', !enabled);
  };

  syncDisabled();
}
