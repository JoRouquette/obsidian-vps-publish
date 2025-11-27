import { Setting } from 'obsidian';
import type { SettingsViewContext } from '../context';

export function renderLanguageSection(root: HTMLElement, ctx: SettingsViewContext): void {
  const { t, settings, logger } = ctx;

  const langBlock = root.createDiv({ cls: 'ptpv-block' });
  const langBlockTitle = langBlock.createDiv({ cls: 'ptpv-block-title' });
  langBlockTitle.createEl('h6', { text: t.settings.language.title });

  new Setting(langBlock)
    .setName(t.settings.language.label)
    .setDesc(t.settings.language.description)
    .addDropdown((dropdown) => {
      dropdown
        .addOption('system', 'System / Système')
        .addOption('en', 'English')
        .addOption('fr', 'Français')
        .setValue(settings.locale ?? 'system')
        .onChange(async (value) => {
          logger.info('Language changed', { locale: value });
          settings.locale = value as any;
          await ctx.save();
          ctx.refresh(); // re-render pour appliquer les nouvelles traductions
        });
    });
}
