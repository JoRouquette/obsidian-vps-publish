import { SettingPage } from 'obsidian';

import type { SettingsViewContext } from './context';

export type SectionRenderer = (root: HTMLElement, ctx: SettingsViewContext) => void;

/**
 * Adaptateur entre l'API déclarative de réglages (Obsidian 1.13+) et les
 * renderers impératifs existants.
 *
 * Les sections dynamiques — routes, VPS, règles d'ignore, avancé — construisent
 * des lignes répétables, conditionnelles et réordonnables. Elles ne se décrivent
 * pas en `SettingDefinitionControl`. Plutôt que d'en maintenir une seconde
 * implémentation, on les rend telles quelles dans une sous-page navigable.
 */
export class SectionPage extends SettingPage {
  constructor(
    title: string,
    private readonly ctx: SettingsViewContext,
    private readonly renderSection: SectionRenderer
  ) {
    super();
    this.title = title;
  }

  display(): void {
    this.containerEl.empty();
    const root = this.containerEl.createDiv({ cls: 'obsidian-vps-publish-settings' });
    this.renderSection(root, this.ctx);
  }
}
