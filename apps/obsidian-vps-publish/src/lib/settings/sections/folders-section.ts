import type { FolderConfig } from '@core-domain/entities/folder-config';
import type { SanitizationRulesDefaults } from '@core-domain/entities/sanitization-rules';
import type { VpsConfig } from '@core-domain/entities/vps-config';
import { Notice, Setting } from 'obsidian';

import type { Translations } from '../../../i18n';
import { translate } from '../../../i18n';
import { FileSuggest } from '../../suggesters/file-suggester';
import { FolderSuggest } from '../../suggesters/folder-suggester';
import type { SettingsViewContext } from '../context';

/**
 * UI State (non-persisted, ephemeral)
 */
interface FoldersUIState {
  searchQuery: string;
  sortCriteria: SortCriterion[];
  editingFolderId: string | null; // null = aucun éditeur ouvert
}

interface SortCriterion {
  property: 'vaultFolder' | 'routeBase' | 'customIndex' | 'flattenTree' | 'exceptionCount';
  direction: 'asc' | 'desc';
}

/**
 * Global UI state (module-level, reset on each render)
 */
let uiState: FoldersUIState = {
  searchQuery: '',
  sortCriteria: [{ property: 'vaultFolder', direction: 'asc' }],
  editingFolderId: null,
};

/**
 * Helper to get nested translation value from a key like "settings.cleanupRules.removeCodeBlocks.name"
 */
function getNestedTranslation(t: Translations, key: string): string | undefined {
  const parts = key.split('.');
  // Type-safe traversal of translation object structure
  let current: unknown = t;
  for (const part of parts) {
    if (current && typeof current === 'object' && current !== null && part in current) {
      current = (current as Record<string, unknown>)[part];
    } else {
      return undefined;
    }
  }
  return typeof current === 'string' ? current : undefined;
}

/**
 * Render folders section - now organized by VPS with compact list + detailed editor
 */
export function renderFoldersSection(root: HTMLElement, ctx: SettingsViewContext): void {
  const { t, settings, logger } = ctx;

  const folderBlock = root.createDiv({ cls: 'ptpv-block' });

  new Setting(folderBlock).setName(t.settings.folders.title).setHeading();

  // Render folders organized by VPS
  settings.vpsConfigs.forEach((vps, vpsIndex) => {
    const vpsSection = folderBlock.createDiv({ cls: 'ptpv-folders-vps-section' });

    new Setting(vpsSection)
      .setName(
        `${vps.name || translate(t, 'common.vpsNumberFallback', { number: (vpsIndex + 1).toString() })} - ${t.settings.folders.foldersLabel ?? 'Folders'}`
      )
      .setHeading();

    const vpsFolders = vps.folders || [];

    // Ensure at least one folder per VPS
    if (vpsFolders.length === 0) {
      logger.debug('No folder found for VPS, creating default', { vpsId: vps.id });
      const defaultFolder: FolderConfig = {
        id: `folder-${Date.now()}`,
        vpsId: vps.id,
        vaultFolder: '',
        routeBase: '/',
        ignoredCleanupRuleIds: [],
      };
      vps.folders = [defaultFolder];
    }

    // Render toolbar (search + sort + reset)
    const toolbarContainer = vpsSection.createDiv({ cls: 'ptpv-folders-toolbar' });

    // Render compact list with inline editor
    const listContainer = vpsSection.createDiv({ cls: 'ptpv-folders-list' });

    // Function to update list without re-rendering toolbar
    const updateList = () => {
      listContainer.empty();
      const filteredFolders = filterFolders(vps.folders, uiState.searchQuery, vps, ctx);
      const sortedFolders = sortFolders(filteredFolders, uiState.sortCriteria);

      if (sortedFolders.length === 0) {
        listContainer.createDiv({
          cls: 'ptpv-folders-no-results',
          text: t.settings.folders.noResults,
        });
      } else {
        const count = sortedFolders.length;
        const plural = count > 1 ? 's' : '';
        listContainer.createDiv({
          cls: 'ptpv-folders-count',
          text: translate(t, 'settings.folders.resultCount', { count: count.toString(), plural }),
        });
        sortedFolders.forEach((folderCfg) => {
          // Render compact item
          renderCompactFolderItem(listContainer, vps, folderCfg, ctx);

          // Render editor right after this item if it's being edited
          if (uiState.editingFolderId === folderCfg.id) {
            const editorContainer = listContainer.createDiv({ cls: 'ptpv-folders-editor' });
            renderDetailedEditor(editorContainer, vps, folderCfg, ctx);
          }
        });
      }
    };

    // Render toolbar with callback to update list
    renderToolbar(toolbarContainer, vps, ctx, updateList);

    // Initial list render
    updateList();

    // Add folder button for this VPS
    const rowAddFolder = vpsSection.createDiv({
      cls: 'ptpv-button-row',
    });
    const btnAddFolder = rowAddFolder.createEl('button', {
      text: t.settings.folders.addButton ?? 'Add folder',
    });
    btnAddFolder.onclick = () => {
      logger.debug('Adding new folder to VPS', { vpsId: vps.id });
      const newFolder: FolderConfig = {
        id: `folder-${Date.now()}`,
        vpsId: vps.id,
        vaultFolder: '',
        routeBase: '/',
        ignoredCleanupRuleIds: [],
      };
      vps.folders.push(newFolder);
      uiState.editingFolderId = newFolder.id; // Auto-open editor
      void ctx.save().then(() => ctx.refresh());
    };
  });
}

/**
 * Render toolbar with search, sort, and reset controls
 */
function renderToolbar(
  container: HTMLElement,
  vps: VpsConfig,
  ctx: SettingsViewContext,
  onFilterChange: () => void
): void {
  const { t } = ctx;
  const toolbarSetting = new Setting(container).setClass('ptpv-toolbar');

  // Search input
  toolbarSetting.addSearch((search) => {
    search
      .setPlaceholder(t.settings.folders.searchPlaceholder)
      .setValue(uiState.searchQuery)
      .onChange((value) => {
        uiState.searchQuery = value;
        onFilterChange(); // Update only the list, not the whole UI
      });
  });

  // Sort dropdown (simplified to one criterion for UX)
  toolbarSetting.addDropdown((dropdown) => {
    dropdown
      .addOption('vaultFolder-asc', t.settings.folders.sortFolderAsc)
      .addOption('vaultFolder-desc', t.settings.folders.sortFolderDesc)
      .addOption('routeBase-asc', t.settings.folders.sortRouteAsc)
      .addOption('routeBase-desc', t.settings.folders.sortRouteDesc)
      .addOption('customIndex-desc', t.settings.folders.sortCustomIndexDesc)
      .addOption('flattenTree-desc', t.settings.folders.sortFlattenedDesc)
      .addOption('exceptionCount-desc', t.settings.folders.sortExceptionsDesc)
      .setValue(`${uiState.sortCriteria[0].property}-${uiState.sortCriteria[0].direction}`)
      .onChange((value) => {
        const [property, direction] = value.split('-') as [
          SortCriterion['property'],
          SortCriterion['direction'],
        ];
        uiState.sortCriteria = [{ property, direction }];
        onFilterChange(); // Update only the list, not the whole UI
      });
  });

  // Reset button
  toolbarSetting.addButton((btn) => {
    btn
      .setIcon('reset')
      .setTooltip(t.settings.folders.resetTooltip)
      .onClick(() => {
        uiState.searchQuery = '';
        uiState.sortCriteria = [{ property: 'vaultFolder', direction: 'asc' }];
        ctx.refresh(); // Full refresh needed to reset search input value
      });
  });
}

/**
 * Filter folders based on search query
 * Matches: vaultFolder, routeBase, customIndexFile, ignoredCleanupRuleIds
 * TODO: Extend to match rule labels if available (see getNestedTranslation for default rules)
 */
function filterFolders(
  folders: FolderConfig[],
  query: string,
  _vps: VpsConfig,
  _ctx: SettingsViewContext
): FolderConfig[] {
  if (!query || query.trim() === '') return folders;

  const lowerQuery = query.toLowerCase();

  return folders.filter((folder) => {
    // Match vault folder
    if (folder.vaultFolder.toLowerCase().includes(lowerQuery)) return true;

    // Match route
    if (folder.routeBase.toLowerCase().includes(lowerQuery)) return true;

    // Match custom index file
    if (folder.customIndexFile && folder.customIndexFile.toLowerCase().includes(lowerQuery))
      return true;

    // Match ignored cleanup rule IDs
    // TODO: For better UX, also match against human-readable rule names/labels
    // Use getNestedTranslation(ctx.t, rule.nameKey) for default rules
    // Example: const ruleName = getNestedTranslation(ctx.t, rule.nameKey) || rule.name;
    if (folder.ignoredCleanupRuleIds.some((ruleId) => ruleId.toLowerCase().includes(lowerQuery)))
      return true;

    return false;
  });
}

/**
 * Sort folders based on multiple criteria (stable sort)
 */
function sortFolders(folders: FolderConfig[], criteria: SortCriterion[]): FolderConfig[] {
  const sorted = [...folders];

  sorted.sort((a, b) => {
    for (const criterion of criteria) {
      let comparison = 0;

      switch (criterion.property) {
        case 'vaultFolder':
          comparison = a.vaultFolder.localeCompare(b.vaultFolder);
          break;
        case 'routeBase':
          comparison = a.routeBase.localeCompare(b.routeBase);
          break;
        case 'customIndex':
          comparison = (a.customIndexFile ? 1 : 0) - (b.customIndexFile ? 1 : 0);
          break;
        case 'flattenTree':
          comparison = (a.flattenTree ? 1 : 0) - (b.flattenTree ? 1 : 0);
          break;
        case 'exceptionCount':
          comparison = a.ignoredCleanupRuleIds.length - b.ignoredCleanupRuleIds.length;
          break;
      }

      if (criterion.direction === 'desc') {
        comparison = -comparison;
      }

      if (comparison !== 0) return comparison;
    }

    return 0;
  });

  return sorted;
}

/**
 * Render compact folder item in list
 */
function renderCompactFolderItem(
  container: HTMLElement,
  vps: VpsConfig,
  folderCfg: FolderConfig,
  ctx: SettingsViewContext
): void {
  const { t, logger } = ctx;

  const item = container.createDiv({ cls: 'ptpv-folder-item' });

  // Main label (vault folder or fallback)
  const label = item.createDiv({ cls: 'ptpv-folder-item-label' });
  const folderIndex = vps.folders.indexOf(folderCfg) + 1;
  const displayName =
    folderCfg.vaultFolder ||
    translate(t, 'settings.folders.emptyFolderLabel', { index: folderIndex.toString() });
  label.createEl('strong', { text: displayName });

  // Sub-text (route)
  const subText = item.createDiv({ cls: 'ptpv-folder-item-subtext' });
  subText.createEl('span', { text: `${t.settings.folders.routePrefix}${folderCfg.routeBase}` });

  // Indicators
  const indicators = item.createDiv({ cls: 'ptpv-folder-item-indicators' });

  if (folderCfg.flattenTree) {
    indicators.createEl('span', {
      cls: 'ptpv-indicator',
      text: t.settings.folders.flattenedIndicator,
    });
  }

  if (folderCfg.customIndexFile) {
    indicators.createEl('span', {
      cls: 'ptpv-indicator',
      text: t.settings.folders.customIndexIndicator,
    });
  }

  if (folderCfg.ignoredCleanupRuleIds.length > 0) {
    const count = folderCfg.ignoredCleanupRuleIds.length;
    const plural = count > 1 ? 's' : '';
    indicators.createEl('span', {
      cls: 'ptpv-indicator',
      text: translate(t, 'settings.folders.exceptionsIndicator', {
        count: count.toString(),
        plural,
      }),
    });
  }

  // Actions
  const actions = item.createDiv({ cls: 'ptpv-folder-item-actions' });

  const btnEdit = actions.createEl('button', {
    text: t.settings.folders.editButton,
    cls: 'mod-cta',
  });
  btnEdit.onclick = () => {
    uiState.editingFolderId = folderCfg.id;
    ctx.refresh();
  };

  const btnDelete = actions.createEl('button', { text: t.settings.folders.deleteButton });
  btnDelete.onclick = () => {
    if (vps.folders.length <= 1) {
      logger.warn('Attempted to delete last folder from VPS, forbidden.', { vpsId: vps.id });
      new Notice(t.settings.folders.deleteLastForbidden);
      return;
    }
    logger.debug('Folder deleted', { vpsId: vps.id, folderId: folderCfg.id });
    const folderIdx = vps.folders.findIndex((f) => f.id === folderCfg.id);
    if (folderIdx !== -1) {
      vps.folders.splice(folderIdx, 1);
    }
    // Close editor if this folder was being edited
    if (uiState.editingFolderId === folderCfg.id) {
      uiState.editingFolderId = null;
    }
    void ctx.save().then(() => ctx.refresh());
  };
}

/**
 * Render detailed editor for a single folder (only one open at a time)
 */
function renderDetailedEditor(
  container: HTMLElement,
  vps: VpsConfig,
  folderCfg: FolderConfig,
  ctx: SettingsViewContext
): void {
  const { t, logger } = ctx;

  const editorFieldset = container.createEl('fieldset', { cls: 'ptpv-folder-editor' });

  const displayName =
    folderCfg.vaultFolder || t.settings.folders.emptyFolderLabel.replace('{index}', '...');
  editorFieldset.createEl('legend', {
    text: translate(t, 'settings.folders.editingLabel', { name: displayName }),
  });

  // Close button
  const closeSetting = new Setting(editorFieldset).setName(t.settings.folders.closeEditor);
  closeSetting.addButton((btn) => {
    btn
      .setIcon('cross')
      .setTooltip(t.settings.folders.closeEditor)
      .onClick(() => {
        uiState.editingFolderId = null;
        ctx.refresh();
      });
  });

  // Vault folder path
  const vaultSetting = new Setting(editorFieldset)
    .setName(t.settings.folders.vaultLabel)
    .setDesc(t.settings.folders.vaultDescription);

  vaultSetting.addText((text) => {
    text
      .setPlaceholder(translate(t, 'placeholders.vaultFolder'))
      .setValue(folderCfg.vaultFolder)
      .onChange((value) => {
        logger.debug('Folder vaultFolder changed', { folderId: folderCfg.id, value });
        folderCfg.vaultFolder = value.trim();
        void ctx.save();
      });

    new FolderSuggest(ctx.app, text.inputEl);
  });

  // Route base
  const routeSetting = new Setting(editorFieldset)
    .setName(t.settings.folders.routeLabel)
    .setDesc(t.settings.folders.routeDescription);

  routeSetting.addText((text) =>
    text
      .setPlaceholder(translate(t, 'placeholders.routePath'))
      .setValue(folderCfg.routeBase)
      .onChange((value) => {
        let route = value.trim();
        if (!route) {
          route = '/';
        }
        if (!route.startsWith('/')) {
          route = '/' + route;
        }
        logger.debug('Folder routeBase changed', { folderId: folderCfg.id, route });
        folderCfg.routeBase = route;
        void ctx.save();
      })
  );

  // Flatten tree option with warning
  const flattenSetting = new Setting(editorFieldset)
    .setName(t.settings.folders.flattenTreeLabel)
    .setDesc(t.settings.folders.flattenTreeDescription);

  flattenSetting.addToggle((toggle) =>
    toggle.setValue(folderCfg.flattenTree ?? false).onChange((value) => {
      logger.debug('Folder flattenTree changed', { folderId: folderCfg.id, value });
      folderCfg.flattenTree = value;
      void ctx.save().then(() => ctx.refresh());
    })
  );

  // Warning if flatten is enabled
  if (folderCfg.flattenTree) {
    const warningDiv = editorFieldset.createDiv({ cls: 'ptpv-warning' });
    warningDiv.createEl('strong', { text: '⚠️ ' });
    warningDiv.appendText(t.settings.folders.warningFlattenTree);
  }

  // Advanced options (collapsible section)
  renderAdvancedOptions(editorFieldset, vps, folderCfg, ctx);
}

/**
 * Render advanced options (custom index + ignored cleanup rules) in a collapsible section
 */
function renderAdvancedOptions(
  container: HTMLElement,
  vps: VpsConfig,
  folderCfg: FolderConfig,
  ctx: SettingsViewContext
): void {
  const { t, logger } = ctx;

  // Use details/summary for native collapsible
  const detailsEl = container.createEl('details', { cls: 'ptpv-advanced-options' });
  detailsEl.createEl('summary', { text: t.settings.folders.advancedOptionsLabel });

  const advancedContent = detailsEl.createDiv({ cls: 'ptpv-advanced-content' });

  // Custom index file
  const customIndexSetting = new Setting(advancedContent)
    .setName(t.settings.folders.customIndexLabel)
    .setDesc(t.settings.folders.customIndexDescription);

  customIndexSetting.addText((text) => {
    text
      .setPlaceholder(translate(t, 'placeholders.customIndexFile'))
      .setValue(folderCfg.customIndexFile ?? '')
      .onChange((value) => {
        const trimmed = value.trim();
        logger.debug('Folder customIndexFile changed', { folderId: folderCfg.id, value: trimmed });
        folderCfg.customIndexFile = trimmed || undefined;
        void ctx.save();
      });

    new FileSuggest(ctx.app, text.inputEl);
  });

  // Cleanup rules ignore section
  renderCleanupRulesIgnoreSection(advancedContent, vps, folderCfg, ctx);
}

/**
 * Render section to manage which VPS cleanup rules this folder ignores
 */
function renderCleanupRulesIgnoreSection(
  container: HTMLElement,
  vps: VpsConfig,
  folderCfg: FolderConfig,
  ctx: SettingsViewContext
): void {
  const { t, logger } = ctx;

  if (!vps.cleanupRules || vps.cleanupRules.length === 0) {
    // No cleanup rules on this VPS, nothing to ignore
    return;
  }

  const ignoreSection = container.createDiv({ cls: 'ptpv-folder-cleanup-ignore' });

  new Setting(ignoreSection)
    .setName(t.settings.folders.ignoredCleanupRulesTitle ?? 'Ignored Cleanup Rules')
    .setDesc(
      t.settings.folders.ignoredCleanupRulesDescription ??
        'Select which VPS cleanup rules should NOT be applied to this folder'
    );

  // Ensure ignoredCleanupRuleIds exists
  if (!Array.isArray(folderCfg.ignoredCleanupRuleIds)) {
    folderCfg.ignoredCleanupRuleIds = [];
  }

  const rulesContainer = ignoreSection.createDiv({ cls: 'ptpv-cleanup-ignore-list' });

  vps.cleanupRules.forEach((rule) => {
    const isIgnored = folderCfg.ignoredCleanupRuleIds.includes(rule.id);

    // Get translated name if available (for default rules)
    const nameKey = (rule as SanitizationRulesDefaults).nameKey;
    const displayName = nameKey ? getNestedTranslation(t, nameKey) || rule.name : rule.name;

    const ruleSetting = new Setting(rulesContainer)
      .setName(displayName || rule.id)
      .setDesc(rule.regex ? `Pattern: ${rule.regex}` : '');

    ruleSetting.addToggle((toggle) =>
      toggle
        .setValue(isIgnored)
        .setTooltip(
          isIgnored
            ? (t.settings.folders.cleanupIgnoredTooltip ?? 'Ignored by this folder')
            : (t.settings.folders.cleanupAppliedTooltip ?? 'Applied to this folder')
        )
        .onChange((value) => {
          logger.debug('Folder cleanup rule ignore toggled', {
            folderId: folderCfg.id,
            ruleId: rule.id,
            ignored: value,
          });

          if (value) {
            // Add to ignored list
            if (!folderCfg.ignoredCleanupRuleIds.includes(rule.id)) {
              folderCfg.ignoredCleanupRuleIds.push(rule.id);
            }
          } else {
            // Remove from ignored list
            const idx = folderCfg.ignoredCleanupRuleIds.indexOf(rule.id);
            if (idx !== -1) {
              folderCfg.ignoredCleanupRuleIds.splice(idx, 1);
            }
          }

          void ctx.save();
        })
    );
  });
}
