import { Notice, Setting } from 'obsidian';
import { FolderSuggest } from '../../suggesters/folder-suggester';
import { createDefaultFolderConfig } from '../../utils/create-default-folder-config.util';
import type { SettingsViewContext } from '../context';

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
      .setName(t.settings.folders.sanitizeRemoveCodeBlocksLabel)
      .setDesc(t.settings.folders.sanitizeRemoveCodeBlocksDescription);

    sanitizeSetting.addToggle((toggle) =>
      toggle
        .setValue(folderCfg.sanitization?.removeFencedCodeBlocks ?? true)
        .onChange(async (value) => {
          logger.debug('Sanitization.removeFencedCodeBlocks changed', {
            index,
            value,
          });
          if (!folderCfg.sanitization) {
            folderCfg.sanitization = { removeFencedCodeBlocks: value };
          } else {
            folderCfg.sanitization.removeFencedCodeBlocks = value;
          }
          await ctx.save();
        })
    );
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
