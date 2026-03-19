import type { FolderConfig } from '@core-domain/entities/folder-config';
import type { VpsConfig } from '@core-domain/entities/vps-config';
import { Notice, Setting } from 'obsidian';

import { translate } from '../../../i18n';
import { FileSuggest } from '../../suggesters/file-suggester';
import { FolderSuggest } from '../../suggesters/folder-suggester';
import { getEffectiveFolders } from '../../utils/get-effective-folders.util';
import type { SettingsViewContext } from '../context';
import {
  getCleanupRuleDisplayName,
  renderIgnoredCleanupRulesSettings,
} from './ignored-cleanup-rules-settings.util';

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

    // Get effective folders (from routeTree or legacy folders)
    const vpsFolders = getEffectiveFolders(vps);

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
      // Legacy folder creation is still required for VPS configs that have not migrated to routeTree.
      // See docs/_archive/settings-route-tree-technical-debt-2026-03-19.md for the remaining sync gap.
      if (!vps.folders) vps.folders = [];
      vps.folders.push(defaultFolder);
    }

    // Render toolbar (search + sort + reset)
    const toolbarContainer = vpsSection.createDiv({ cls: 'ptpv-folders-toolbar' });

    // Render compact list with inline editor
    const listContainer = vpsSection.createDiv({ cls: 'ptpv-folders-list' });

    // Function to update list without re-rendering toolbar
    const updateList = () => {
      listContainer.empty();
      const currentFolders = getEffectiveFolders(vps);
      const filteredFolders = filterFolders(currentFolders, uiState.searchQuery, vps, ctx);
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
      // Legacy folder creation is still required for VPS configs that have not migrated to routeTree.
      // See docs/_archive/settings-route-tree-technical-debt-2026-03-19.md for the remaining sync gap.
      if (!vps.folders) vps.folders = [];
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
 * Matches: vaultFolder, routeBase, customIndexFile, ignoredCleanupRuleIds, and rule labels
 */
function filterFolders(
  folders: FolderConfig[],
  query: string,
  vps: VpsConfig,
  ctx: SettingsViewContext
): FolderConfig[] {
  if (!query || query.trim() === '') return folders;

  const lowerQuery = query.toLowerCase();
  const cleanupRuleNames = new Map(
    (vps.cleanupRules ?? []).map((rule) => [rule.id, getCleanupRuleDisplayName(rule, ctx.t)])
  );

  return folders.filter((folder) => {
    // Match vault folder
    if (folder.vaultFolder.toLowerCase().includes(lowerQuery)) return true;

    // Match route
    if (folder.routeBase.toLowerCase().includes(lowerQuery)) return true;

    // Match custom index file
    if (folder.customIndexFile && folder.customIndexFile.toLowerCase().includes(lowerQuery))
      return true;

    if (
      folder.ignoredCleanupRuleIds.some((ruleId) => {
        const displayName = cleanupRuleNames.get(ruleId)?.toLowerCase();
        return ruleId.toLowerCase().includes(lowerQuery) || !!displayName?.includes(lowerQuery);
      })
    )
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
  const currentFolders = getEffectiveFolders(vps);
  const folderIndex = currentFolders.indexOf(folderCfg) + 1;
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
    const currentFolders = getEffectiveFolders(vps);
    if (currentFolders.length <= 1) {
      logger.warn('Attempted to delete last folder from VPS, forbidden.', { vpsId: vps.id });
      new Notice(t.settings.folders.deleteLastForbidden);
      return;
    }
    logger.debug('Folder deleted', { vpsId: vps.id, folderId: folderCfg.id });
    // Legacy folder deletion is still required for VPS configs that have not migrated to routeTree.
    // See docs/_archive/settings-route-tree-technical-debt-2026-03-19.md for the remaining sync gap.
    if (!vps.folders) vps.folders = [];
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

  // Additional files section
  renderAdditionalFilesSection(advancedContent, folderCfg, ctx);

  // Cleanup rules ignore section
  renderCleanupRulesIgnoreSection(advancedContent, vps, folderCfg, ctx);
}

/**
 * Render section to manage additional files to include in this folder
 * Files are published at the root of the folder's routeBase
 */
function renderAdditionalFilesSection(
  container: HTMLElement,
  folderCfg: FolderConfig,
  ctx: SettingsViewContext
): void {
  const { t, logger, app } = ctx;

  // Ensure additionalFiles exists
  if (!Array.isArray(folderCfg.additionalFiles)) {
    folderCfg.additionalFiles = [];
  }

  const filesSection = container.createDiv({ cls: 'ptpv-folder-additional-files' });

  new Setting(filesSection)
    .setName(t.settings.folders.additionalFilesLabel ?? 'Additional Files')
    .setDesc(
      t.settings.folders.additionalFilesDescription ??
        'Files published at the root of this folder route, regardless of their vault location'
    );

  // Render current list as chips
  const listContainer = filesSection.createDiv({ cls: 'ptpv-additional-files-list' });

  const renderFilesList = () => {
    listContainer.empty();

    if (folderCfg.additionalFiles!.length === 0) {
      listContainer.createEl('em', {
        text: t.settings.folders.additionalFilesEmpty ?? 'No additional files',
        cls: 'ptpv-empty-list',
      });
    } else {
      folderCfg.additionalFiles!.forEach((filePath) => {
        const chip = listContainer.createDiv({ cls: 'ptpv-file-chip' });
        chip.createSpan({ text: filePath, cls: 'ptpv-file-chip-label' });

        const removeBtn = chip.createEl('button', {
          text: '×',
          cls: 'ptpv-file-chip-remove',
          attr: { 'aria-label': 'Remove file' },
        });

        removeBtn.addEventListener('click', () => {
          logger.debug('Removing additional file', { folderId: folderCfg.id, filePath });
          folderCfg.additionalFiles = folderCfg.additionalFiles!.filter((f) => f !== filePath);
          void ctx.save();
          renderFilesList();
        });
      });
    }
  };

  renderFilesList();

  // Add file button with suggester
  new Setting(filesSection)
    .setName(t.settings.folders.addAdditionalFileLabel ?? 'Add file')
    .addButton((btn) =>
      btn.setButtonText(t.settings.folders.addAdditionalFileButton ?? '+ Add file').onClick(() => {
        // Create a temporary modal-like input with suggester
        const modal = filesSection.createDiv({ cls: 'ptpv-file-suggester-modal' });
        const inputWrapper = modal.createDiv({ cls: 'ptpv-file-suggester-input-wrapper' });

        const input = inputWrapper.createEl('input', {
          type: 'text',
          placeholder: t.settings.folders.addAdditionalFilePlaceholder ?? 'Select a file...',
          cls: 'ptpv-file-suggester-input',
        });

        const suggester = new FileSuggest(app, input);

        // Override selectSuggestion to add file to list
        const originalSelect = suggester.selectSuggestion.bind(suggester);
        suggester.selectSuggestion = (file) => {
          const filePath = file.path;

          // Check for duplicates
          if (folderCfg.additionalFiles!.includes(filePath)) {
            logger.warn('File already in additional files list', { filePath });
            new Notice(
              t.settings.folders.additionalFileDuplicate ?? 'This file is already in the list'
            );
            modal.remove();
            return;
          }

          logger.debug('Adding additional file', { folderId: folderCfg.id, filePath });
          folderCfg.additionalFiles!.push(filePath);
          void ctx.save();
          renderFilesList();
          modal.remove();
          originalSelect(file); // Call original to close suggester properly
        };

        // Close modal on Escape or click outside
        const closeModal = () => modal.remove();
        input.addEventListener('keydown', (e) => {
          if (e.key === 'Escape') closeModal();
        });

        modal.addEventListener('click', (e) => {
          if (e.target === modal) closeModal();
        });

        // Focus input to open suggester
        input.focus();
      })
    );
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
  const { logger } = ctx;
  renderIgnoredCleanupRulesSettings(container, vps, folderCfg, ctx, logger, 'folder');
}
