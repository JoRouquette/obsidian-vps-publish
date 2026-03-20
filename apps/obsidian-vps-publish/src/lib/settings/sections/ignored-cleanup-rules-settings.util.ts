import type { SanitizationRulesDefaults } from '@core-domain/entities/sanitization-rules';
import type { VpsConfig } from '@core-domain/entities/vps-config';
import type { LoggerPort } from '@core-domain/ports/logger-port';
import { Setting } from 'obsidian';

import type { Translations } from '../../../i18n';
import type { SettingsViewContext } from '../context';

export interface IgnoredCleanupRulesTarget {
  id: string;
  ignoredCleanupRuleIds?: string[];
}

function getNestedTranslation(t: Translations, key: string): string | undefined {
  const parts = key.split('.');
  let current: unknown = t;

  for (const part of parts) {
    if (current && typeof current === 'object' && part in current) {
      current = (current as Record<string, unknown>)[part];
    } else {
      return undefined;
    }
  }

  return typeof current === 'string' ? current : undefined;
}

export function getCleanupRuleDisplayName(
  rule: VpsConfig['cleanupRules'][number],
  t: Translations
): string {
  const nameKey = (rule as SanitizationRulesDefaults).nameKey;
  return nameKey ? getNestedTranslation(t, nameKey) || rule.name : rule.name;
}

export function renderIgnoredCleanupRulesSettings(
  container: HTMLElement,
  vps: VpsConfig,
  target: IgnoredCleanupRulesTarget,
  ctx: SettingsViewContext,
  logger: LoggerPort,
  targetKind: 'folder' | 'route'
): void {
  const { t } = ctx;

  if (!vps.cleanupRules || vps.cleanupRules.length === 0) {
    return;
  }

  const ignoredCleanupRuleIds = Array.isArray(target.ignoredCleanupRuleIds)
    ? target.ignoredCleanupRuleIds
    : (target.ignoredCleanupRuleIds = []);

  const ignoreSection = container.createDiv({ cls: 'ptpv-folder-cleanup-ignore' });

  new Setting(ignoreSection)
    .setName(t.settings.folders.ignoredCleanupRulesTitle ?? 'Ignored Cleanup Rules')
    .setDesc(
      t.settings.folders.ignoredCleanupRulesDescription ??
        'Select which VPS cleanup rules should NOT be applied'
    );

  const rulesContainer = ignoreSection.createDiv({ cls: 'ptpv-cleanup-ignore-list' });

  vps.cleanupRules.forEach((rule) => {
    const isIgnored = ignoredCleanupRuleIds.includes(rule.id);
    const displayName = getCleanupRuleDisplayName(rule, t);

    const ruleSetting = new Setting(rulesContainer)
      .setName(displayName || rule.id)
      .setDesc(rule.regex ? `Pattern: ${rule.regex}` : '');

    ruleSetting.addToggle((toggle) =>
      toggle
        .setValue(isIgnored)
        .setTooltip(
          isIgnored
            ? (t.settings.folders.cleanupIgnoredTooltip ?? 'Ignored by this item')
            : (t.settings.folders.cleanupAppliedTooltip ?? 'Applied to this item')
        )
        .onChange((value) => {
          logger.debug(`${targetKind} cleanup rule ignore toggled`, {
            [`${targetKind}Id`]: target.id,
            ruleId: rule.id,
            ignored: value,
          });

          if (value) {
            if (!ignoredCleanupRuleIds.includes(rule.id)) {
              ignoredCleanupRuleIds.push(rule.id);
            }
          } else {
            const idx = ignoredCleanupRuleIds.indexOf(rule.id);
            if (idx !== -1) {
              ignoredCleanupRuleIds.splice(idx, 1);
            }
          }

          void ctx.save();
        })
    );
  });
}
