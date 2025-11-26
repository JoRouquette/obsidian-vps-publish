import { Setting } from 'obsidian';
import { FolderSuggest } from '../../suggesters/folder-suggester';
import type { SettingsViewContext } from '../context';

export function renderVaultSection(root: HTMLElement, ctx: SettingsViewContext): void {
  const { t, settings, logger } = ctx;

  const vaultBlock = root.createDiv({ cls: 'ptpv-block' });
  const vaultBlockTitle = vaultBlock.createDiv({ cls: 'ptpv-block-title' });
  vaultBlockTitle.createEl('h6', {
    text: t.settings.vault.title,
  });

  vaultBlock.createDiv({
    cls: 'ptpv-help',
    text: t.settings.vault?.help,
  });

  new Setting(vaultBlock)
    .setName(t.settings.vault?.assetsFolderLabel)
    .setDesc(t.settings.vault?.assetsFolderDescription)
    .addText((text) => {
      text
        .setPlaceholder('assets')
        .setValue(settings.assetsFolder || 'assets')
        .onChange(async (value) => {
          logger.debug('Assets folder changed', { value });
          settings.assetsFolder = value.trim() || 'assets';
          await ctx.save();
        });

      new FolderSuggest(ctx.app, text.inputEl);
    });

  new Setting(vaultBlock)
    .setName(t.settings.vault?.enableAssetsVaultFallbackLabel)
    .setDesc(t.settings.vault?.enableAssetsVaultFallbackDescription)
    .addToggle((toggle) =>
      toggle.setValue(settings.enableAssetsVaultFallback).onChange(async (value) => {
        logger.debug('enableAssetsVaultFallback changed', { value });
        settings.enableAssetsVaultFallback = value;
        await ctx.save();
      })
    );
}
