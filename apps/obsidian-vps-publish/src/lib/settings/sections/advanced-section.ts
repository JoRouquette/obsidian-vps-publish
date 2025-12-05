/* eslint-disable @typescript-eslint/no-misused-promises */
import { LogLevel } from '@core-domain/ports/logger-port';
import { type App, Modal, Notice, Setting } from 'obsidian';

import type { SettingsViewContext } from '../context';

function logLevelToString(level: LogLevel): string {
  switch (level) {
    case LogLevel.debug:
      return 'debug';
    case LogLevel.info:
      return 'info';
    case LogLevel.warn:
      return 'warn';
    case LogLevel.error:
      return 'error';
    default:
      return 'warn';
  }
}

function stringToLogLevel(value: string): LogLevel {
  switch (value) {
    case 'debug':
      return LogLevel.debug;
    case 'info':
      return LogLevel.info;
    case 'error':
      return LogLevel.error;
    case 'warn':
    default:
      return LogLevel.warn;
  }
}

export function renderAdvancedSection(root: HTMLElement, ctx: SettingsViewContext): void {
  const { t, settings, logger } = ctx;
  const block = root.createDiv({ cls: 'ptpv-block' });
  const details = block.createEl('details', { cls: 'ptpv-advanced' });
  details.createEl('summary', {
    text: t.settings.advanced.title,
  });

  const inner = details.createDiv({ cls: 'ptpv-advanced__content' });

  new Setting(inner)
    .setName(t.settings.advanced.logLevelLabel)
    .setDesc(t.settings.advanced.logLevelDescription)
    .addDropdown((dropdown) => {
      dropdown
        .addOptions({
          debug: t.settings.advanced.logLevelDebug,
          info: t.settings.advanced.logLevelInfo,
          warn: t.settings.advanced.logLevelWarn,
          error: t.settings.advanced.logLevelError,
        })
        .setValue(logLevelToString(settings.logLevel))
        .onChange((value) => {
          const level = stringToLogLevel(value);
          logger.debug('Log level changed', { level });
          settings.logLevel = level;
          logger.level = level;
          void ctx.save();
        });
    });

  new Setting(inner)
    .setName(t.settings.advanced.calloutStylesLabel)
    .setDesc(t.settings.advanced.calloutStylesDescription)
    .addTextArea((text) => {
      text
        .setPlaceholder(t.settings.advanced.calloutStylesPlaceholder)
        .setValue(settings.calloutStylePaths.join('\n'))
        .onChange((value) => {
          const paths = value
            .split(/[\n,]/)
            .map((p) => p.trim())
            .filter(Boolean);
          settings.calloutStylePaths = paths;
          logger.debug('Callout style paths updated', { paths });
          void ctx.save();
        });

      text.inputEl.style.minHeight = '80px';
    });

  renderCleanupSetting(inner, ctx);
}

function renderCleanupSetting(inner: HTMLElement, ctx: SettingsViewContext): void {
  const { settings, t, app, logger, plugin } = ctx;
  let selectedVpsId = settings.vpsConfigs?.[0]?.id ?? '';
  let cleanupInProgress = false;

  const cleanupSetting = new Setting(inner)
    .setName(t.settings.advanced.cleanup.title)
    .setDesc(t.settings.advanced.cleanup.description);

  cleanupSetting.addDropdown((dropdown) => {
    const vpsConfigs = settings.vpsConfigs ?? [];
    if (!vpsConfigs.length) {
      dropdown.addOption('', t.settings.advanced.cleanup.missingVps);
      dropdown.setValue('');
      dropdown.selectEl.disabled = true;
      return;
    }

    vpsConfigs.forEach((vps) => dropdown.addOption(vps.id, vps.name || vps.id));

    const initial = selectedVpsId || vpsConfigs[0].id;
    dropdown.setValue(initial);
    selectedVpsId = initial;

    dropdown.onChange((value) => {
      selectedVpsId = value;
    });
  });

  cleanupSetting.addButton((btn) => {
    btn.setButtonText(t.settings.advanced.cleanup.button).setWarning();
    if (!settings.vpsConfigs?.length) {
      btn.setDisabled(true);
    }

    btn.onClick(() => {
      void (async () => {
        if (cleanupInProgress) return;
        cleanupInProgress = true;
        btn.setDisabled(true);

        try {
          const vpsConfigs = settings.vpsConfigs ?? [];
          const target = vpsConfigs.find((vps) => vps.id === selectedVpsId) ?? vpsConfigs[0];

          if (!target) {
            new Notice(t.settings.advanced.cleanup.missingVps);
            return;
          }

          const targetName = (target.name ?? '').trim();
          if (!targetName) {
            new Notice(t.settings.advanced.cleanup.missingName);
            return;
          }

          const firstCheck = await confirmDangerousAction(app, {
            title: t.settings.advanced.cleanup.confirmTitle,
            message: t.settings.advanced.cleanup.confirmDescription,
            confirmText: t.settings.advanced.cleanup.confirmCta,
            cancelText: t.settings.advanced.cleanup.cancel,
          });

          if (!firstCheck) return;

          const typedName = await promptVpsName(app, {
            title: t.settings.advanced.cleanup.secondTitle,
            message: t.settings.advanced.cleanup.secondDescription.replace('{name}', targetName),
            placeholder: t.settings.advanced.cleanup.secondPlaceholder,
            confirmText: t.settings.advanced.cleanup.secondCta,
            cancelText: t.settings.advanced.cleanup.cancel,
          });

          if (!typedName) return;

          if (typedName !== targetName) {
            new Notice(t.settings.advanced.cleanup.nameMismatch);
            return;
          }

          await plugin.cleanupVps(target, typedName);
          new Notice(t.settings.advanced.cleanup.success);
        } catch (err) {
          logger.error('VPS cleanup failed', err);
          new Notice(t.settings.advanced.cleanup.error);
        } finally {
          cleanupInProgress = false;
          btn.setDisabled(false);
        }
      })();
    });
  });
}

type ConfirmModalOptions = {
  title: string;
  message: string;
  confirmText: string;
  cancelText: string;
};

type PromptModalOptions = ConfirmModalOptions & {
  placeholder?: string;
};

function confirmDangerousAction(app: App, options: ConfirmModalOptions): Promise<boolean> {
  return new Promise((resolve) => {
    new ConfirmCleanupModal(app, options, resolve).open();
  });
}

function promptVpsName(app: App, options: PromptModalOptions): Promise<string | null> {
  return new Promise((resolve) => {
    new NameConfirmationModal(app, options, resolve).open();
  });
}

class ConfirmCleanupModal extends Modal {
  private settled = false;

  constructor(
    app: App,
    private readonly options: ConfirmModalOptions,
    private readonly onResult: (confirmed: boolean) => void
  ) {
    super(app);
  }

  private settle(value: boolean) {
    if (this.settled) return;
    this.settled = true;
    this.onResult(value);
  }

  onOpen(): void {
    const { contentEl } = this;
    contentEl.createEl('h3', { text: this.options.title });
    contentEl.createEl('p', { text: this.options.message });

    const buttons = contentEl.createDiv({ cls: 'modal-button-container' });

    const cancelBtn = buttons.createEl('button', { text: this.options.cancelText });
    cancelBtn.onclick = () => {
      this.settle(false);
      this.close();
    };

    const confirmBtn = buttons.createEl('button', { text: this.options.confirmText });
    confirmBtn.addClass('mod-warning');
    confirmBtn.onclick = () => {
      this.settle(true);
      this.close();
    };
  }

  onClose(): void {
    this.contentEl.empty();
    this.settle(false);
  }
}

class NameConfirmationModal extends Modal {
  private settled = false;

  constructor(
    app: App,
    private readonly options: PromptModalOptions,
    private readonly onResult: (value: string | null) => void
  ) {
    super(app);
  }

  private settle(value: string | null) {
    if (this.settled) return;
    this.settled = true;
    this.onResult(value);
  }

  onOpen(): void {
    const { contentEl } = this;
    contentEl.createEl('h3', { text: this.options.title });
    contentEl.createEl('p', { text: this.options.message });

    const input = contentEl.createEl('input', {
      type: 'text',
      placeholder: this.options.placeholder ?? '',
    });
    input.autocomplete = 'off';
    input.setAttribute('autocapitalize', 'off');
    input.spellcheck = false;

    const blockClipboard = (event: Event) => {
      event.preventDefault();
      event.stopPropagation();
    };
    input.addEventListener('paste', blockClipboard);
    input.addEventListener('copy', blockClipboard);
    input.addEventListener('cut', blockClipboard);
    input.addEventListener('drop', blockClipboard);

    const buttons = contentEl.createDiv({ cls: 'modal-button-container' });
    const cancelBtn = buttons.createEl('button', { text: this.options.cancelText });
    cancelBtn.onclick = () => {
      this.settle(null);
      this.close();
    };

    const confirmBtn = buttons.createEl('button', { text: this.options.confirmText });
    confirmBtn.addClass('mod-warning');

    const getValue = () => (input.value ?? '').trim();
    const syncState = () => {
      confirmBtn.disabled = getValue().length === 0;
    };

    input.addEventListener('input', syncState);
    input.addEventListener('keydown', (evt) => {
      if (evt.key === 'Enter' && !confirmBtn.disabled) {
        this.settle(getValue());
        this.close();
      }
    });

    confirmBtn.onclick = () => {
      this.settle(getValue());
      this.close();
    };

    syncState();
    input.focus();
  }

  onClose(): void {
    this.contentEl.empty();
    this.settle(null);
  }
}
