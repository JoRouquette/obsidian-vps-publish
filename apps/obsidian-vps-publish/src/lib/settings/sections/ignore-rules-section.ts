import type { IgnoreRule } from '@core-domain/entities/ignore-rule';
import type { VpsConfig } from '@core-domain/entities/vps-config';
import { type DropdownComponent, Setting } from 'obsidian';

import { FrontmatterPropertySuggester } from '../../suggesters/frontmatter-property-suggester';
import { TagSuggester } from '../../suggesters/tag-suggester';
import type { SettingsViewContext } from '../context';

/**
 * Render ignore rules section - now organized by VPS
 * Note: frontmatterKeysToExclude and frontmatterTagsToExclude remain global
 */
export function renderIgnoreRulesSection(root: HTMLElement, ctx: SettingsViewContext): void {
  const { t, settings, logger } = ctx;

  const ignoreBlock = root.createDiv({ cls: 'ptpv-block' });

  new Setting(ignoreBlock).setName(t.settings.ignoreRules.title).setHeading();

  // Global ignore settings (frontmatter keys/tags)
  renderFrontmatterKeysExclude(ignoreBlock, ctx);
  renderFrontmatterTagsExclude(ignoreBlock, ctx);

  // Ignore rules per VPS
  settings.vpsConfigs.forEach((vps, vpsIndex) => {
    const vpsSection = ignoreBlock.createDiv({ cls: 'ptpv-ignore-vps-section' });

    new Setting(vpsSection)
      .setName(
        `${vps.name || `VPS #${vpsIndex + 1}`} - ${t.settings.ignoreRules.rulesLabel ?? 'Ignore Rules'}`
      )
      .setHeading();

    // Ensure ignoreRules array exists
    if (!Array.isArray(vps.ignoreRules)) {
      vps.ignoreRules = [];
    }

    vps.ignoreRules.forEach((rule, ruleIndex) => {
      renderIgnoreRule(vpsSection, vps, rule, ruleIndex, ctx);
    });

    // Add ignore rule button for this VPS
    const rowAddIgnoreRule = vpsSection.createDiv({
      cls: 'ptpv-button-row',
    });
    const btnAddIgnoreRule = rowAddIgnoreRule.createEl('button', {
      text: t.settings.ignoreRules.addButton ?? 'Add ignore rule',
    });
    btnAddIgnoreRule.onclick = () => {
      logger.debug('Adding new ignore rule to VPS', { vpsId: vps.id });
      vps.ignoreRules.push({
        property: 'publish',
        ignoreIf: false,
      });
      void ctx.save().then(() => ctx.refresh());
    };
  });
}

/**
 * Render a single ignore rule
 */
function renderIgnoreRule(
  container: HTMLElement,
  vps: VpsConfig,
  rule: IgnoreRule,
  index: number,
  ctx: SettingsViewContext
): void {
  const { t, logger } = ctx;

  const ruleContainer = container.createDiv({ cls: 'ptpv-ignore-rule' });

  ruleContainer.createEl('div', {
    cls: 'ptpv-ignore-rule__title',
    text: `${t.settings.ignoreRules.valueLabel ?? 'Ignore rule'} #${index + 1}`,
  });

  const inputsRow = ruleContainer.createDiv({ cls: 'ptpv-ignore-rule__inputs' });
  const mode = rule.ignoreValues && rule.ignoreValues.length > 0 ? 'values' : 'boolean';

  // Property field
  const propertyField = inputsRow.createDiv({ cls: 'ptpv-ignore-rule__field' });
  propertyField.createEl('label', {
    cls: 'ptpv-ignore-rule__label',
    text: t.settings.ignoreRules.propertyLabel ?? 'Property',
  });
  const propInput = propertyField.createEl('input', {
    type: 'text',
    value: rule.property ?? '',
    placeholder: t.settings.ignoreRules.propertyLabel ?? 'frontmatter property',
    cls: 'ptpv-input',
  });
  new FrontmatterPropertySuggester(ctx.app, propInput);
  propInput.addEventListener('input', () => {
    rule.property = propInput.value.trim();
    void ctx.save();
  });

  // Type field (boolean or values)
  const typeField = inputsRow.createDiv({ cls: 'ptpv-ignore-rule__field' });
  typeField.createEl('label', {
    cls: 'ptpv-ignore-rule__label',
    text: 'Type',
  });
  const typeSelect = typeField.createEl('select', { cls: 'ptpv-input' });
  const addOpt = (value: 'boolean' | 'values', label: string) => {
    const opt = typeSelect.createEl('option', { value, text: label });
    return opt;
  };
  addOpt('values', t.settings.ignoreRules.modeValues ?? 'Ignore specific values');
  addOpt('boolean', t.settings.ignoreRules.modeBoolean ?? 'Ignore if equals');
  typeSelect.value = mode;

  // Values mode UI
  const valuesRow = ruleContainer.createDiv({ cls: 'ptpv-ignore-rule__values' });
  const chipsRow = ruleContainer.createDiv({ cls: 'ptpv-ignore-rule__chips' });
  const booleanRow = ruleContainer.createDiv({ cls: 'ptpv-ignore-rule__boolean' });

  chipsRow.createDiv({
    cls: 'ptpv-ignore-rule__chips-label',
    text: t.settings.ignoreRules.valueLabel ?? 'Values to ignore',
  });
  const chipsWrap = chipsRow.createDiv({ cls: 'ptpv-ignore-rule__chips-list' });

  const renderChips = () => {
    chipsWrap.empty();
    const values = rule.ignoreValues ?? [];
    if (!values.length) {
      chipsWrap.createSpan({
        cls: 'ptpv-chips-empty',
        text: t.settings.ignoreRules.valueDescription ?? 'val1, val2, val3',
      });
      return;
    }
    values.forEach((v, i) => {
      const chip = chipsWrap.createDiv({ cls: 'ptpv-chip' });
      chip.createSpan({ text: String(v) });
      const removeBtn = chip.createSpan({ cls: 'ptpv-chip-remove', text: '×' });
      removeBtn.onclick = () => {
        const next = [...values];
        next.splice(i, 1);
        rule.ignoreValues = next;
        void ctx.save().then(() => renderChips());
      };
    });
  };

  const valuesField = valuesRow.createDiv({
    cls: 'ptpv-ignore-rule__field ptpv-ignore-rule__field--values',
  });
  valuesField.createEl('label', {
    cls: 'ptpv-ignore-rule__label',
    text: t.settings.ignoreRules.valueLabel ?? 'Values to ignore',
  });
  const valuesInput = valuesField.createEl('input', {
    type: 'text',
    placeholder: t.settings.ignoreRules.valueDescription ?? 'val1, val2, val3',
    cls: 'ptpv-input',
    value: '',
  });

  const addValue = (raw: string) => {
    const nextValues = raw
      .split(',')
      .map((v) => v.trim())
      .filter((v) => v.length > 0);
    if (!nextValues.length) {
      valuesInput.value = '';
      return;
    }
    const existing = rule.ignoreValues ?? [];
    const merged = [...existing];
    nextValues.forEach((val) => {
      if (!merged.some((x) => typeof x === 'string' && x.toLowerCase() === val.toLowerCase())) {
        merged.push(val);
      }
    });
    rule.ignoreValues = merged;
    valuesInput.value = '';
    void ctx.save().then(() => renderChips());
  };

  valuesInput.addEventListener('keydown', (evt) => {
    if (evt.key === 'Enter' || evt.key === ',') {
      evt.preventDefault();
      addValue(valuesInput.value);
    }
  });
  valuesInput.addEventListener('blur', () => addValue(valuesInput.value));

  // Boolean mode UI
  let boolDropdown: DropdownComponent | undefined;
  new Setting(booleanRow).addDropdown((dropdown) => {
    boolDropdown = dropdown;
    dropdown
      .addOption('true', 'true')
      .addOption('false', 'false')
      .setValue(rule.ignoreIf === false ? 'false' : 'true')
      .onChange((value) => {
        logger.debug('Ignore rule boolean value changed', { vpsId: vps.id, index, value });
        rule.ignoreIf = value === 'true';
        void ctx.save();
      });
  });

  const showValues = (show: boolean) => {
    valuesRow.toggleClass('is-hidden', !show);
    chipsRow.toggleClass('is-hidden', !show);
    booleanRow.toggleClass('is-hidden', show);
  };

  const setMode = async (value: 'boolean' | 'values') => {
    if (value === 'boolean') {
      rule.ignoreValues = undefined;
      if (typeof rule.ignoreIf !== 'boolean') {
        rule.ignoreIf = true;
      }
      boolDropdown?.setValue(rule.ignoreIf === false ? 'false' : 'true');
      showValues(false);
    } else {
      rule.ignoreIf = undefined;
      rule.ignoreValues = rule.ignoreValues ?? [];
      renderChips();
      showValues(true);
    }
    await ctx.save();
  };

  if (mode === 'values') {
    showValues(true);
    renderChips();
  } else {
    showValues(false);
    boolDropdown?.setValue(rule.ignoreIf === false ? 'false' : 'true');
  }

  typeSelect.addEventListener('change', () => {
    void setMode(typeSelect.value as 'boolean' | 'values');
  });

  // Delete button
  const actionRow = ruleContainer.createDiv({ cls: 'ptpv-ignore-rule__actions' });
  const deleteBtn = actionRow.createEl('button', {
    text: t.settings.ignoreRules.deleteButton ?? 'Delete ignore rule',
    cls: 'mod-warning',
  });
  deleteBtn.onclick = () => {
    logger.debug('Ignore rule deleted', { vpsId: vps.id, ruleIndex: index });
    vps.ignoreRules.splice(index, 1);
    void ctx.save().then(() => ctx.refresh());
  };
}

/**
 * Global frontmatter keys to exclude
 */
function renderFrontmatterKeysExclude(parent: HTMLElement, ctx: SettingsViewContext): void {
  const { settings, logger, t } = ctx;
  const container = parent.createDiv({ cls: 'ptpv-frontmatter-exclude' });

  const tagsContainer = container.createDiv({ cls: 'ptpv-chips' });

  const refreshTags = () => {
    tagsContainer.empty();
    const keys = settings.frontmatterKeysToExclude || [];
    if (!keys.length) {
      tagsContainer.createSpan({
        text: t.settings.ignoreRules.frontmatterKeysPlaceholder,
        cls: 'ptpv-chips-empty',
      });
      return;
    }
    keys.forEach((key, index) => {
      const chip = tagsContainer.createDiv({ cls: 'ptpv-chip' });
      chip.createSpan({ text: key });
      const removeBtn = chip.createSpan({ cls: 'ptpv-chip-remove', text: '×' });
      removeBtn.onclick = async () => {
        settings.frontmatterKeysToExclude.splice(index, 1);
        await ctx.save();
        refreshTags();
      };
    });
  };

  refreshTags();

  const setting = new Setting(container)
    .setName(t.settings.ignoreRules.frontmatterKeysLabel)
    .setDesc(t.settings.ignoreRules.frontmatterKeysDescription);

  setting.addText((text) => {
    text.setPlaceholder(t.settings.ignoreRules.frontmatterKeysPlaceholder);
    new FrontmatterPropertySuggester(ctx.app, text.inputEl);

    const addKey = () => {
      const raw = text.getValue().trim();
      if (!raw) return;
      const keys = settings.frontmatterKeysToExclude || [];
      const exists = keys.some((k) => k.toLowerCase() === raw.toLowerCase());
      if (exists) {
        text.setValue('');
        return;
      }
      logger.debug('Adding frontmatter key to exclude', { key: raw });
      keys.push(raw);
      settings.frontmatterKeysToExclude = keys;
      text.setValue('');
      void ctx.save().then(() => refreshTags());
    };

    text.inputEl.addEventListener('keydown', (evt) => {
      if (evt.key === 'Enter' || evt.key === ',') {
        evt.preventDefault();
        addKey();
      }
    });

    text.inputEl.addEventListener('blur', addKey);
  });
}

/**
 * Global frontmatter tags to exclude
 */
function renderFrontmatterTagsExclude(parent: HTMLElement, ctx: SettingsViewContext): void {
  const { settings, logger, t } = ctx;
  const container = parent.createDiv({ cls: 'ptpv-frontmatter-tags-exclude' });

  const chipsContainer = container.createDiv({ cls: 'ptpv-chips' });

  const refresh = () => {
    chipsContainer.empty();
    const tags = settings.frontmatterTagsToExclude || [];
    if (!tags.length) {
      chipsContainer.createSpan({
        text: t.settings.ignoreRules.tagsPlaceholder,
        cls: 'ptpv-chips-empty',
      });
      return;
    }
    tags.forEach((tag, index) => {
      const chip = chipsContainer.createDiv({ cls: 'ptpv-chip' });
      chip.createSpan({ text: tag });
      const removeBtn = chip.createSpan({ cls: 'ptpv-chip-remove', text: '×' });
      removeBtn.onclick = () => {
        settings.frontmatterTagsToExclude.splice(index, 1);
        void ctx.save().then(() => refresh());
      };
    });
  };

  refresh();

  const setting = new Setting(container)
    .setName(t.settings.ignoreRules.tagsLabel)
    .setDesc(t.settings.ignoreRules.tagsDescription);

  setting.addText((text) => {
    text.setPlaceholder(t.settings.ignoreRules.tagsPlaceholder);
    new TagSuggester(ctx.app, text.inputEl);

    const addTag = () => {
      const raw = text.getValue().trim();
      if (!raw) return;
      const tags = settings.frontmatterTagsToExclude || [];
      const exists = tags.some((k) => k.toLowerCase() === raw.toLowerCase());
      if (exists) {
        text.setValue('');
        return;
      }
      logger.debug('Adding frontmatter tag to exclude', { tag: raw });
      tags.push(raw);
      settings.frontmatterTagsToExclude = tags;
      text.setValue('');
      void ctx.save().then(() => refresh());
    };

    text.inputEl.addEventListener('keydown', (evt) => {
      if (evt.key === 'Enter' || evt.key === ',') {
        evt.preventDefault();
        addTag();
      }
    });

    text.inputEl.addEventListener('blur', addTag);
  });
}
