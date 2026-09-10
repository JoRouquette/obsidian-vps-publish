// `SettingPage` est @since 1.13.0 alors que le manifest déclare minAppVersion 1.5.0.
// Ce fichier n'est atteint que par `getSettingDefinitions()`, qu'Obsidian n'appelle
// jamais avant 1.13 : sur les versions antérieures, c'est `display()` qui s'exécute
// et ce module n'est jamais instancié. L'écart est donc volontaire et sans risque.
/* eslint-disable obsidianmd/no-unsupported-api */

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
 *
 * C'est ce qui permet de servir `display()` aux versions < 1.13 ET
 * `getSettingDefinitions()` à partir de 1.13 **sans dupliquer une seule ligne**
 * d'interface : les deux chemins appellent les mêmes `render*Section()`.
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
