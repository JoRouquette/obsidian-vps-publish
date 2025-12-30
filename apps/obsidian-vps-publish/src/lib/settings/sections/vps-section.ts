import type {
  SanitizationRules,
  SanitizationRulesDefaults,
} from '@core-domain/entities/sanitization-rules';
import type { VpsConfig } from '@core-domain/entities/vps-config';
import { Notice, Setting } from 'obsidian';

import type { Translations } from '../../../i18n';
import { translate } from '../../../i18n';
import { FileSuggest } from '../../suggesters/file-suggester';
import { defaultSanitizationRules } from '../../utils/create-default-folder-config.util';
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

export function renderVpsSection(root: HTMLElement, ctx: SettingsViewContext): void {
  const { t, settings, logger, vpsHelpers } = ctx;

  const vpsBlock = root.createDiv({ cls: 'ptpv-block' });

  new Setting(vpsBlock).setName(t.settings.vps.title).setHeading();

  settings.vpsConfigs.forEach((vps, index) => {
    const vpsFieldset = vpsBlock.createEl('fieldset', { cls: 'ptpv-vps' });
    const legendText = vps.name || vps.id || `${t.settings.vps.title} #${index + 1}`;
    vpsFieldset.createEl('legend', { text: legendText });

    // Delete VPS button
    const deleteSetting = new Setting(vpsFieldset).setName(
      t.settings.vps.deleteButton ?? 'Delete VPS'
    );

    deleteSetting.addButton((btn) =>
      btn
        .setIcon('trash')
        .setDisabled(settings.vpsConfigs.length <= 1)
        .setTooltip(
          settings.vpsConfigs.length <= 1
            ? (t.settings.vps.deleteLastForbidden ?? 'At least one VPS is required')
            : ''
        )
        .onClick(async () => {
          if (settings.vpsConfigs.length <= 1) {
            logger.warn('Attempted to delete last VPS config, forbidden.');
            new Notice(t.settings.vps.deleteLastForbidden ?? 'At least one VPS is required');
            return;
          }
          logger.debug('VPS config deleted', { index, vpsId: vps.id });
          settings.vpsConfigs.splice(index, 1);
          await ctx.save();
          ctx.refresh();
        })
    );

    // VPS Name
    new Setting(vpsFieldset)
      .setName(t.settings.vps.nameLabel)
      .setDesc(t.settings.vps.nameDescription)
      .addText((text) => {
        text
          .setPlaceholder(translate(t, 'placeholders.vpsName'))
          .setValue(vps.name)
          .onChange((value) => {
            // Update value in real-time without trimming or validating
            vps.name = value;
          });

        // Validate and save only on blur (when user leaves the field)
        text.inputEl.addEventListener('blur', () => {
          void (async () => {
            const trimmed = vps.name.trim();
            if (!trimmed) {
              logger.warn('VPS name cannot be empty');
              new Notice(t.settings.vps.nameRequired ?? 'VPS name is required');
              vps.name = text.inputEl.value = vps.name || 'VPS'; // Restore previous or default
              return;
            }
            if (!vpsHelpers.isVpsNameUnique(trimmed, vps.id)) {
              logger.warn('VPS name already exists', { name: trimmed });
              new Notice(t.settings.vps.nameDuplicate ?? `VPS name "${trimmed}" already exists`);
              text.inputEl.value = vps.name; // Restore previous value
              return;
            }
            // Only trim and save when leaving the field
            vps.name = trimmed;
            logger.debug('VPS name finalized', { name: trimmed });
            await ctx.save();
            ctx.refresh();
          })();
        });
      });

    // VPS URL (baseUrl)
    new Setting(vpsFieldset)
      .setName(t.settings.vps.urlLabel)
      .setDesc(t.settings.vps.urlDescription)
      .addText((text) => {
        const legacyVps = vps as unknown as { url?: string };
        text
          .setPlaceholder(translate(t, 'placeholders.vpsUrl'))
          .setValue(vps.baseUrl || legacyVps.url || '')
          .onChange((value) => {
            // Update value in real-time without trimming
            vps.baseUrl = value;
            // Clean up legacy field if present
            delete legacyVps.url;
          });

        // Validate and save only on blur
        text.inputEl.addEventListener('blur', () => {
          void (async () => {
            const trimmed = vps.baseUrl.trim();
            if (!trimmed) {
              logger.warn('VPS URL cannot be empty');
              new Notice(t.settings.vps.urlRequired ?? 'VPS URL is required');
              vps.baseUrl = text.inputEl.value = vps.baseUrl || 'https://'; // Restore
              return;
            }
            if (!vpsHelpers.isVpsUrlUnique(trimmed, vps.id)) {
              logger.warn('VPS URL already exists', { url: trimmed });
              new Notice(t.settings.vps.urlDuplicate ?? `VPS URL "${trimmed}" already exists`);
              text.inputEl.value = vps.baseUrl; // Restore previous value
              return;
            }
            // Only trim and save when leaving the field
            vps.baseUrl = trimmed;
            logger.debug('VPS url finalized', { url: trimmed });
            await ctx.save();
          })();
        });
      });

    // VPS API Key
    new Setting(vpsFieldset)
      .setName(t.settings.vps.apiKeyLabel)
      .setDesc(t.settings.vps.apiKeyDescription)
      .addText((text) => {
        text
          .setPlaceholder(translate(t, 'placeholders.apiKey'))
          .setValue(vps.apiKey)
          .onChange((value) => {
            // Update value in real-time without trimming
            vps.apiKey = value;
          });

        // Trim and save only on blur
        text.inputEl.addEventListener('blur', () => {
          void (async () => {
            vps.apiKey = vps.apiKey.trim();
            logger.debug('VPS apiKey finalized');
            await ctx.save();
          })();
        });
      });

    // Custom Root Index File
    new Setting(vpsFieldset)
      .setName(t.settings.vps.customRootIndexLabel)
      .setDesc(t.settings.vps.customRootIndexDescription)
      .addText((text) => {
        text
          .setPlaceholder(translate(t, 'placeholders.customIndexFile'))
          .setValue(vps.customRootIndexFile ?? '')
          .onChange((value) => {
            const trimmed = value.trim();
            logger.debug('VPS customRootIndexFile changed', { vpsId: vps.id, value: trimmed });
            vps.customRootIndexFile = trimmed || undefined;
            void ctx.save();
          });

        new FileSuggest(ctx.app, text.inputEl);
      });

    // VPS Actions (Test Connection & Upload)
    renderVpsActions(vpsFieldset, vps, ctx);

    // Cleanup Rules (Sanitization) for this VPS
    renderCleanupRulesSection(vpsFieldset, vps, ctx);
  });

  vpsBlock.createDiv({
    cls: 'ptpv-help',
    text: t.settings.vps.help,
  });

  // Add VPS Button
  const rowAddVps = vpsBlock.createDiv({
    cls: 'ptpv-button-row',
  });
  const addVpsBtn = rowAddVps.createEl('button', {
    text: t.settings.vps.addButton ?? 'Add VPS',
  });
  addVpsBtn.addClass('mod-cta');
  addVpsBtn.onclick = async () => {
    const newVps: VpsConfig = {
      id: `vps-${Date.now()}`,
      name: `VPS ${settings.vpsConfigs.length + 1}`,
      baseUrl: '',
      apiKey: '',
      ignoreRules: [],
      cleanupRules: defaultSanitizationRules(),
      folders: [
        {
          id: `folder-${Date.now()}`,
          vpsId: `vps-${Date.now()}`,
          vaultFolder: '',
          routeBase: '/',
          ignoredCleanupRuleIds: [],
        },
      ],
    };
    logger.debug('Adding new VPS config', { id: newVps.id });
    settings.vpsConfigs.push(newVps);
    await ctx.save();
    ctx.refresh();
  };
}

/**
 * Render test connection and upload actions for a specific VPS
 */
function renderVpsActions(container: HTMLElement, vps: VpsConfig, ctx: SettingsViewContext): void {
  const { t, logger } = ctx;

  const actionsContainer = container.createDiv({ cls: 'ptpv-vps-actions' });

  new Setting(actionsContainer)
    .setName(t.settings.vps.actionsTitle ?? 'Actions')
    .setDesc(t.settings.vps.actionsDescription ?? 'Test connection or upload to this VPS');

  const buttonRow = actionsContainer.createDiv({ cls: 'ptpv-button-row' });

  // Test Connection Button
  const testBtn = buttonRow.createEl('button', {
    text: t.settings.testConnection.label ?? 'Test connection',
  });
  testBtn.onclick = async () => {
    try {
      logger.debug('Testing VPS connection', { vpsId: vps.id, vpsName: vps.name });
      await ctx.plugin.testConnectionForVps(vps);
      logger.debug('VPS connection test succeeded', { vpsId: vps.id });
    } catch (e) {
      logger.error('VPS connection test failed', { vpsId: vps.id, error: e });
    }
  };

  // Upload to VPS Button
  const uploadBtn = buttonRow.createEl('button', {
    text: t.settings.vps.uploadButton ?? 'Upload to this VPS',
  });
  uploadBtn.addClass('mod-cta');
  uploadBtn.onclick = async () => {
    try {
      logger.debug('Starting upload to VPS', { vpsId: vps.id, vpsName: vps.name });
      await ctx.plugin.uploadToVps(vps);
      logger.debug('Upload to VPS succeeded', { vpsId: vps.id });
    } catch (e) {
      logger.error('Upload to VPS failed', { vpsId: vps.id, error: e });
    }
  };
}

/**
 * Render cleanup/sanitization rules section for a specific VPS
 */
function renderCleanupRulesSection(
  container: HTMLElement,
  vps: VpsConfig,
  ctx: SettingsViewContext
): void {
  const { t } = ctx;

  const cleanupContainer = container.createDiv({ cls: 'ptpv-cleanup-rules' });

  new Setting(cleanupContainer)
    .setName(t.settings.vps.cleanupRulesTitle ?? 'Content Cleanup Rules')
    .setDesc(
      t.settings.vps.cleanupRulesDescription ??
        'Rules applied to clean content before publishing. Folders can opt-out of specific rules.'
    );

  // Ensure cleanupRules array exists
  if (!Array.isArray(vps.cleanupRules) || vps.cleanupRules.length === 0) {
    vps.cleanupRules = defaultSanitizationRules();
    void ctx.save(); // Save the default rules
  }

  vps.cleanupRules.forEach((rule, ruleIndex) => {
    renderCleanupRuleItem(
      cleanupContainer,
      rule,
      async () => {
        vps.cleanupRules.splice(ruleIndex, 1);
        await ctx.save();
        ctx.refresh();
      },
      async () => {
        await ctx.save();
      },
      ctx
    );
  });

  // Add Cleanup Rule Button
  const addRuleRow = cleanupContainer.createDiv({ cls: 'ptpv-button-row' });
  const addRuleBtn = addRuleRow.createEl('button', {
    text: t.settings.vps.addCleanupRule ?? 'Add cleanup rule',
  });
  addRuleBtn.onclick = () => {
    const newRule: SanitizationRules = {
      id: `cleanup-${Date.now()}`,
      name: 'Custom cleanup rule',
      regex: '',
      replacement: '',
      isEnabled: true,
    };
    vps.cleanupRules.push(newRule);
    void ctx.save().then(() => ctx.refresh());
  };
}

/**
 * Render a single cleanup rule
 */
function renderCleanupRuleItem(
  container: HTMLElement,
  rule: SanitizationRules,
  onDelete: () => Promise<void>,
  onSave: () => Promise<void>,
  ctx: SettingsViewContext
): void {
  const { t } = ctx;
  const isDefault = (rule as SanitizationRulesDefaults).isDefault === true;

  const wrapper = container.createDiv({ cls: 'ptpv-cleanup-rule' });
  if (isDefault) {
    wrapper.addClass('ptpv-cleanup-rule-default');
    wrapper.setAttribute('data-rule-type', 'default');
  } else {
    wrapper.setAttribute('data-rule-type', 'custom');
  }
  wrapper.setAttribute('data-rule-id', rule.id);

  // Get translated name if available
  const nameKey = (rule as SanitizationRulesDefaults).nameKey;
  const descriptionKey = (rule as SanitizationRulesDefaults).descriptionKey;
  const displayName = nameKey ? getNestedTranslation(t, nameKey) || rule.name : rule.name;
  const description = descriptionKey ? getNestedTranslation(t, descriptionKey) : undefined;

  const header = new Setting(wrapper).setName(displayName);
  if (description) {
    header.setDesc(description);
  }

  // Add a visual indicator for default rules in the header description
  if (isDefault && !description) {
    header.setDesc(t.settings.vps.defaultRuleIndicator ?? 'Default rule');
  }

  // For default rules: only show toggle + no delete
  // For custom rules: show name input + toggle + delete
  if (!isDefault) {
    header.addText((text) =>
      text.setValue(rule.name || '').onChange((value) => {
        rule.name = value;
        void onSave();
      })
    );
  }

  header.addToggle((toggle) =>
    toggle
      .setValue(rule.isEnabled ?? true)
      .setTooltip(t.settings.vps.ruleEnabledTooltip ?? 'Enabled')
      .onChange((value) => {
        rule.isEnabled = value;
        void onSave();
      })
  );

  if (!isDefault) {
    header.addExtraButton((btn) =>
      btn
        .setIcon('trash')
        .setTooltip(t.settings.vps.deleteCleanupRule ?? 'Delete rule')
        .onClick(() => {
          void onDelete();
        })
    );
  }

  // For default rules: pattern and replacement are read-only (shown but disabled)
  const patternSetting = new Setting(wrapper)
    .setName(t.settings.vps.rulePatternLabel ?? 'Pattern (regex)')
    .addText((text) => {
      text.setPlaceholder(translate(t, 'placeholders.regexPattern')).setValue(rule.regex || '');
      if (isDefault) {
        text.setDisabled(true);
      } else {
        text.onChange((value) => {
          rule.regex = value;

          // Visual feedback: warn if regex is empty
          if (!value || value.trim().length === 0) {
            text.inputEl.addClass('ptpv-input-error');
            text.inputEl.setAttribute(
              'title',
              'Regex cannot be empty - this rule will be ignored during upload'
            );
          } else {
            text.inputEl.removeClass('ptpv-input-error');
            text.inputEl.removeAttribute('title');
          }

          void onSave();
        });
      }
    });

  const replacementSetting = new Setting(wrapper)
    .setName(t.settings.vps.ruleReplacementLabel ?? 'Replacement')
    .addText((text) => {
      text.setValue(rule.replacement || '');
      if (isDefault) {
        text.setDisabled(true);
      } else {
        text.onChange((value) => {
          rule.replacement = value;
          void onSave();
        });
      }
    });

  // Visually dim when disabled
  const syncDisabled = () => {
    const enabled = rule.isEnabled ?? true;
    patternSetting.settingEl.toggleClass('ptpv-disabled', !enabled);
    replacementSetting.settingEl.toggleClass('ptpv-disabled', !enabled);
  };

  syncDisabled();
}
