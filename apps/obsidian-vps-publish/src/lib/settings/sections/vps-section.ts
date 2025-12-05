import type { VpsConfig } from '@core-domain/entities/vps-config';
import { Setting } from 'obsidian';

import type { SettingsViewContext } from '../context';

export function renderVpsSection(root: HTMLElement, ctx: SettingsViewContext): void {
  const { t, settings, logger } = ctx;

  const vpsBlock = root.createDiv({ cls: 'ptpv-block' });
  const vpsBlockTitle = vpsBlock.createDiv({
    cls: 'ptpv-block-title',
  });
  vpsBlockTitle.createEl('h6', { text: t.settings.vps.title });

  settings.vpsConfigs.forEach((vps, index) => {
    const vpsFieldset = vpsBlock.createEl('fieldset', { cls: 'ptpv-vps' });
    vpsFieldset.createEl('legend', {
      text: vps.name || vps.id || `${t.settings.vps.title} #${index + 1}`,
    });

    const deleteSetting = new Setting(vpsFieldset).setName(
      t.settings.vps.deleteButton ?? 'Delete VPS'
    );

    deleteSetting.addButton((btn) =>
      btn
        .setIcon('trash')
        .setDisabled(settings.vpsConfigs.length <= 1)
        .onClick(async () => {
          if (settings.vpsConfigs.length <= 1) {
            logger.warn('Attempted to delete last VPS config, forbidden.');
            return;
          }
          logger.info('VPS config deleted', { index, vpsId: vps.id });
          settings.vpsConfigs.splice(index, 1);
          await ctx.save();
          ctx.refresh();
        })
    );

    new Setting(vpsFieldset)
      .setName(t.settings.vps.nameLabel)
      .setDesc(t.settings.vps.nameDescription)
      .addText((text) =>
        text
          .setPlaceholder('VPS')
          .setValue(vps.name)
          .onChange(async (value) => {
            logger.debug('VPS name changed', { value });
            vps.name = value.trim();
            await ctx.save();
          })
      );

    new Setting(vpsFieldset)
      .setName(t.settings.vps.urlLabel)
      .setDesc(t.settings.vps.urlDescription)
      .addText((text) =>
        text
          .setPlaceholder('https://...')
          .setValue(vps.url)
          .onChange(async (value) => {
            logger.debug('VPS url changed', { value });
            vps.url = value.trim();
            await ctx.save();
          })
      );

    new Setting(vpsFieldset)
      .setName(t.settings.vps.apiKeyLabel)
      .setDesc(t.settings.vps.apiKeyDescription)
      .addText((text) =>
        text
          .setPlaceholder('********')
          .setValue(vps.apiKey)
          .onChange(async (value) => {
            logger.debug('VPS apiKey changed');
            vps.apiKey = value.trim();
            await ctx.save();
          })
      );
  });

  vpsBlock.createDiv({
    cls: 'ptpv-help',
    text: t.settings.vps.help,
  });

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
      name: 'VPS',
      url: '',
      apiKey: '',
    };
    logger.info('Adding new VPS config', { id: newVps.id });
    settings.vpsConfigs.push(newVps);
    await ctx.save();
    ctx.refresh();
  };

  const rowTestConnection = vpsBlock.createDiv({
    cls: 'ptpv-button-row',
  });
  const testBtn = rowTestConnection.createEl('button', {
    text: t.settings.testConnection.label ?? 'Test connection',
  });
  testBtn.addClass('mod-cta');
  testBtn.onclick = async () => {
    try {
      logger.info('Testing VPS connection');
      await ctx.plugin.testConnection();
      logger.info('VPS connection test succeeded');
    } catch (e) {
      logger.error('VPS connection test failed', e);
    }
  };
}
