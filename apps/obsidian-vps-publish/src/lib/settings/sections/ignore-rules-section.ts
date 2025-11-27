import { Setting } from 'obsidian';
import type { SettingsViewContext } from '../context';
import { TagSuggester } from '../../suggesters/tag-suggester';
import { FrontmatterPropertySuggester } from '../../suggesters/frontmatter-property-suggester';

export function renderIgnoreRulesSection(root: HTMLElement, ctx: SettingsViewContext): void {
  const { t, settings, logger } = ctx;

  const ignoreBlock = root.createDiv({ cls: 'ptpv-block' });
  const ignoreBlockTitle = ignoreBlock.createDiv({
    cls: 'ptpv-block-title',
  });
  ignoreBlockTitle.createEl('h6', { text: t.settings.ignoreRules.title });

  renderFrontmatterKeysExclude(ignoreBlock, ctx);
  renderFrontmatterTagsExclude(ignoreBlock, ctx);

  const ignoreRules = settings.ignoreRules ?? [];

  ignoreRules.forEach((rule, index) => {
    const ruleSetting = new Setting(ignoreBlock).setName(
      `${t.settings.ignoreRules.valueLabel ?? 'Ignore rule'} #${index + 1}`
    );

    ruleSetting.addText((text) =>
      text
        .setPlaceholder(t.settings.ignoreRules.propertyLabel ?? 'frontmatter property')
        .setValue(rule.property ?? '')
        .onChange(async (value) => {
          logger.debug('Ignore rule property changed', {
            index,
            value,
          });
          rule.property = value.trim();
          await ctx.save();
        })
    );

    const mode =
      rule.ignoreValues && rule.ignoreValues.length > 0 ? 'values' : 'boolean';

    ruleSetting.addDropdown((dropdown) =>
      dropdown
        .addOption(
          'boolean',
          t.settings.ignoreRules.modeBoolean ?? 'Ignore if equals'
        )
        .addOption(
          'values',
          t.settings.ignoreRules.modeValues ?? 'Ignore specific values'
        )
        .setValue(mode)
        .onChange(async (value) => {
          logger.debug('Ignore rule mode changed', { index, value });
          if (value === 'boolean') {
            rule.ignoreValues = undefined;
            if (typeof rule.ignoreIf !== 'boolean') {
              rule.ignoreIf = true; // default
            }
          } else {
            rule.ignoreIf = undefined;
            if (!rule.ignoreValues) {
              rule.ignoreValues = ['draft'];
            }
          }
          await ctx.save();
          ctx.refresh();
        })
    );

    if (mode === 'boolean') {
      ruleSetting.addDropdown((dropdown) =>
        dropdown
          .addOption('true', 'true')
          .addOption('false', 'false')
          .setValue(rule.ignoreIf === false ? 'false' : 'true')
          .onChange(async (value) => {
            logger.debug('Ignore rule boolean value changed', {
              index,
              value,
            });
            rule.ignoreIf = value === 'true';
            await ctx.save();
          })
      );
    } else {
      ruleSetting.addText((text) =>
        text
          .setPlaceholder(t.settings.ignoreRules.valueDescription ?? 'val1, val2, val3')
          .setValue((rule.ignoreValues ?? []).join(', '))
          .onChange(async (value) => {
            logger.debug('Ignore rule values changed', {
              index,
              value,
            });
            rule.ignoreValues = value
              .split(',')
              .map((v) => v.trim())
              .filter((v) => v.length > 0);
            await ctx.save();
          })
      );
    }

    ruleSetting.addExtraButton((btn) =>
      btn
        .setIcon('trash')
        .setTooltip(
          t.settings.ignoreRules.deleteButton ?? 'Delete ignore rule'
        )
        .onClick(async () => {
          logger.info('Ignore rule deleted', { index, rule });
          settings.ignoreRules?.splice(index, 1);
          await ctx.save();
          ctx.refresh();
        })
    );
  });

  const rowAddIgnoreRule = ignoreBlock.createDiv({
    cls: 'ptpv-button-row',
  });
  const btnAddIgnoreRule = rowAddIgnoreRule.createEl('button', {
    text: t.settings.ignoreRules.addButton ?? 'Add ignore rule',
  });
  btnAddIgnoreRule.addClass('mod-cta');
  btnAddIgnoreRule.onclick = async () => {
    const rules = settings.ignoreRules ?? [];
    logger.info('Adding new ignore rule');
    rules.push({
      property: 'publish',
      ignoreIf: false,
    });
    settings.ignoreRules = rules;
    await ctx.save();
    ctx.refresh();
  };
}

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

    const addKey = async () => {
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
      await ctx.save();
      refreshTags();
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
      removeBtn.onclick = async () => {
        settings.frontmatterTagsToExclude.splice(index, 1);
        await ctx.save();
        refresh();
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

    const addTag = async () => {
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
      await ctx.save();
      refresh();
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
