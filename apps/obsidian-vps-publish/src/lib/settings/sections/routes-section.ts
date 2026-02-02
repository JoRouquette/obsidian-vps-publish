import type { RouteNode } from '@core-domain/entities/route-node';
import { getNodeConflicts, validateRouteTree } from '@core-domain/entities/route-node-validation';
import type { VpsConfig } from '@core-domain/entities/vps-config';
import { Notice, setIcon, Setting, ToggleComponent } from 'obsidian';

import { translate } from '../../../i18n';
import { FileSuggest } from '../../suggesters/file-suggester';
import { FolderSuggest } from '../../suggesters/folder-suggester';
import type { SettingsViewContext } from '../context';
import {
  canDeleteNode,
  deleteNodeFromTree,
  findNodeById,
  findParentNode,
  insertNodeAfter,
  insertNodeBefore,
  isDescendant,
  removeNodeFromTree,
} from '../utils/route-tree.utils';

/**
 * UI State (non-persisted, ephemeral)
 */
interface RoutesUIState {
  editingNodeId: string | null; // null = no editor open
  expandedNodes: Set<string>; // IDs of expanded nodes in tree view
  tempRouteTree: { roots: RouteNode[] } | null; // Temporary route tree for editing
  hasUnsavedChanges: boolean; // Track if there are unsaved changes
  draggedNodeId: string | null; // ID of the node being dragged
  draggedNodeParentId: string | null; // Parent ID (null for root)
}

/**
 * Global UI state (module-level, reset on each render)
 */
let uiState: RoutesUIState = {
  editingNodeId: null,
  expandedNodes: new Set<string>(),
  tempRouteTree: null,
  hasUnsavedChanges: false,
  draggedNodeId: null,
  draggedNodeParentId: null,
};

/**
 * Render routes section - NEW route-first UI with tree structure
 */
export function renderRoutesSection(root: HTMLElement, ctx: SettingsViewContext): void {
  const { t, settings, logger } = ctx;

  const routesBlock = root.createDiv({ cls: 'ptpv-block' });

  // Render routes organized by VPS
  settings.vpsConfigs.forEach((vps, vpsIndex) => {
    const vpsSection = routesBlock.createDiv({ cls: 'ptpv-routes-vps-section' });

    new Setting(vpsSection)
      .setName(
        `${vps.name || translate(t, 'common.vpsNumberFallback', { number: (vpsIndex + 1).toString() })} - Routes`
      )
      .setHeading();

    // Ensure routeTree exists
    if (!vps.routeTree || !vps.routeTree.roots) {
      logger.debug('No route tree found for VPS, creating default', { vpsId: vps.id });
      vps.routeTree = {
        roots: [
          {
            id: `route-${Date.now()}`,
            segment: '',
            ignoredCleanupRuleIds: [],
          },
        ],
      };
    }

    // Initialize temp route tree if not already set
    if (!uiState.tempRouteTree) {
      uiState.tempRouteTree = JSON.parse(JSON.stringify(vps.routeTree));
    }

    const routeTree = uiState.tempRouteTree!; // Non-null assertion safe here after check

    // Ensure at least one root route
    if (routeTree.roots.length === 0) {
      routeTree.roots.push({
        id: `route-${Date.now()}`,
        segment: '',
        ignoredCleanupRuleIds: [],
      });
      uiState.hasUnsavedChanges = true;
    }

    // Render tree container
    const treeContainer = vpsSection.createDiv({ cls: 'ptpv-routes-tree' });

    const updateTree = () => {
      treeContainer.empty();
      // Sort roots alphabetically by segment for organized display
      const sortedRoots = [...routeTree.roots].sort((a, b) => {
        const segmentA = (a.segment || '').toLowerCase();
        const segmentB = (b.segment || '').toLowerCase();
        // Empty segments first, then alphabetical
        if (segmentA === '' && segmentB !== '') return -1;
        if (segmentA !== '' && segmentB === '') return 1;
        return segmentA.localeCompare(segmentB);
      });
      sortedRoots.forEach((rootNode, index) => {
        renderRouteNode(treeContainer, vps, rootNode, ctx, 0, index === sortedRoots.length - 1);
      });
    };

    // Initial tree render
    updateTree();

    // Add root route button for this VPS
    const rowAddRoute = vpsSection.createDiv({
      cls: 'ptpv-button-row',
    });
    const btnAddRoute = rowAddRoute.createEl('button', {
      text: t.settings.routes.addRootRoute,
    });
    btnAddRoute.onclick = () => {
      logger.debug('Adding new root route to VPS', { vpsId: vps.id });
      const newRoute: RouteNode = {
        id: `route-${Date.now()}`,
        segment: '',
        ignoredCleanupRuleIds: [],
      };
      // Add to END of list (user requirement)
      routeTree.roots.push(newRoute);
      uiState.editingNodeId = newRoute.id; // Auto-open editor
      uiState.hasUnsavedChanges = true;
      ctx.refresh();
    };

    // Save/Cancel buttons at the bottom
    const actionRow = vpsSection.createDiv({
      cls: 'ptpv-button-row ptpv-routes-actions',
    });

    const btnSave = actionRow.createEl('button', {
      text: t.common.save || 'Sauvegarder',
      cls: uiState.hasUnsavedChanges ? 'mod-cta' : '',
    });
    btnSave.disabled = !uiState.hasUnsavedChanges;
    btnSave.onclick = async () => {
      logger.debug('Saving route tree changes', { vpsId: vps.id });

      // Validate before saving
      const validationResult = validateRouteTree(uiState.tempRouteTree!);
      if (!validationResult.valid) {
        const errorMsg = validationResult.conflicts
          .map((c) => `${c.message} at ${c.path}`)
          .join('\n');
        new Notice(`⚠️ Cannot save: Route conflicts detected\n${errorMsg}`, 8000);
        return;
      }

      // Apply temp changes to actual settings
      vps.routeTree = JSON.parse(JSON.stringify(uiState.tempRouteTree));
      uiState.hasUnsavedChanges = false;
      uiState.tempRouteTree = null;
      await ctx.save();
      ctx.refresh();
      new Notice(t.common.saved || 'Sauvegardé');
    };

    const btnCancel = actionRow.createEl('button', {
      text: t.common.cancel || 'Annuler',
    });
    btnCancel.disabled = !uiState.hasUnsavedChanges;
    btnCancel.onclick = () => {
      logger.debug('Cancelling route tree changes', { vpsId: vps.id });
      // Reset temp state
      uiState.tempRouteTree = null;
      uiState.hasUnsavedChanges = false;
      uiState.editingNodeId = null;
      ctx.refresh();
      new Notice(t.common.cancelled || 'Annulé');
    };
  });

  // Reset temp state on section unmount
  root.addEventListener('DOMContentLoaded', () => {
    uiState.tempRouteTree = null;
    uiState.hasUnsavedChanges = false;
  });
}

/**
 * Render a single route node in the tree (recursive)
 */
function renderRouteNode(
  container: HTMLElement,
  vps: VpsConfig,
  node: RouteNode,
  ctx: SettingsViewContext,
  depth: number,
  _isLastSibling: boolean
): void {
  const { logger } = ctx;

  const nodeContainer = container.createDiv({
    cls: 'ptpv-route-node',
    attr: { 'data-depth': depth.toString() },
  });

  // Compact item (always visible)
  const item = nodeContainer.createDiv({ cls: 'ptpv-route-item' });
  item.draggable = true;

  // Set data attributes for drag & drop
  item.setAttribute('data-node-id', node.id);

  // Drag event handlers
  item.ondragstart = (e) => {
    uiState.draggedNodeId = node.id;
    // Find parent
    const parent = findParentNode(uiState.tempRouteTree!, node.id);
    uiState.draggedNodeParentId = parent?.id || null;
    item.addClass('is-dragging');
    e.dataTransfer!.effectAllowed = 'move';
  };

  item.ondragend = () => {
    item.removeClass('is-dragging');
    // Clean up any drag-over classes
    document
      .querySelectorAll('.drag-over-top, .drag-over-bottom, .drag-over-child')
      .forEach((el) => {
        el.removeClass('drag-over-top');
        el.removeClass('drag-over-bottom');
        el.removeClass('drag-over-child');
      });
  };

  item.ondragover = (e) => {
    e.preventDefault();
    if (!uiState.draggedNodeId || uiState.draggedNodeId === node.id) return;

    const rect = item.getBoundingClientRect();
    const y = e.clientY - rect.top;
    const height = rect.height;

    // Remove all drag-over classes first
    item.removeClass('drag-over-top');
    item.removeClass('drag-over-bottom');
    item.removeClass('drag-over-child');

    // Determine drop zone
    if (y < height * 0.25) {
      item.addClass('drag-over-top');
      e.dataTransfer!.dropEffect = 'move';
    } else if (y > height * 0.75) {
      item.addClass('drag-over-bottom');
      e.dataTransfer!.dropEffect = 'move';
    } else {
      item.addClass('drag-over-child');
      e.dataTransfer!.dropEffect = 'move';
    }
  };

  item.ondragleave = () => {
    item.removeClass('drag-over-top');
    item.removeClass('drag-over-bottom');
    item.removeClass('drag-over-child');
  };

  item.ondrop = (e) => {
    e.preventDefault();
    item.removeClass('drag-over-top');
    item.removeClass('drag-over-bottom');
    item.removeClass('drag-over-child');

    if (!uiState.draggedNodeId || uiState.draggedNodeId === node.id) return;

    const rect = item.getBoundingClientRect();
    const y = e.clientY - rect.top;
    const height = rect.height;

    const draggedNode = findNodeById(uiState.tempRouteTree!, uiState.draggedNodeId);
    if (!draggedNode) return;

    // Prevent dropping a parent into its own child
    if (isDescendant(draggedNode, node.id)) {
      new Notice(
        ctx.t.settings.routes.cannotMoveParentToChild || 'Cannot move a parent into its child'
      );
      return;
    }

    // Remove from old location
    removeNodeFromTree(uiState.tempRouteTree!, uiState.draggedNodeId);

    // Determine drop position
    if (y < height * 0.25) {
      // Insert before target
      insertNodeBefore(uiState.tempRouteTree!, node.id, draggedNode);
    } else if (y > height * 0.75) {
      // Insert after target
      insertNodeAfter(uiState.tempRouteTree!, node.id, draggedNode);
    } else {
      // Add as child
      if (!node.children) node.children = [];
      node.children.push(draggedNode);
      uiState.expandedNodes.add(node.id);
    }

    uiState.hasUnsavedChanges = true;
    uiState.draggedNodeId = null;
    uiState.draggedNodeParentId = null;
    ctx.refresh();
  };

  // Indent based on depth
  item.style.paddingLeft = `${depth * 20}px`;

  // Drag handle icon (always first)
  const dragHandle = item.createEl('span', {
    cls: 'ptpv-route-drag-handle',
    attr: { 'aria-label': 'Drag to reorder' },
  });
  setIcon(dragHandle, 'grip-vertical');

  // Expand/collapse button (if has children)
  const hasChildren = node.children && node.children.length > 0;
  if (hasChildren) {
    const isExpanded = uiState.expandedNodes.has(node.id);
    const btnExpand = item.createEl('span', {
      cls: 'ptpv-route-expand-btn',
      attr: { 'aria-label': isExpanded ? 'Collapse' : 'Expand' },
    });
    setIcon(btnExpand, isExpanded ? 'chevron-down' : 'chevron-right');
    btnExpand.onclick = () => {
      if (uiState.expandedNodes.has(node.id)) {
        uiState.expandedNodes.delete(node.id);
      } else {
        uiState.expandedNodes.add(node.id);
      }
      ctx.refresh();
    };
  } else {
    // Spacer for alignment
    item.createDiv({ cls: 'ptpv-route-expand-spacer' });
  }

  // Label: segment + indicators + validation
  const label = item.createDiv({ cls: 'ptpv-route-label' });
  const segmentText = node.segment || '/';
  const indicators: string[] = [];
  if (node.vaultFolder) indicators.push('📁');
  if (node.customIndexFile) indicators.push('📄');
  if (node.additionalFiles && node.additionalFiles.length > 0) indicators.push('📎');
  if (node.flattenTree) indicators.push('⬇');

  // Check for validation errors
  const conflicts = getNodeConflicts(uiState.tempRouteTree!, node.id);
  if (conflicts.length > 0) {
    label.addClass('ptpv-route-has-conflicts');
    indicators.push('⚠️');

    // Add tooltip with conflict details
    const conflictMessages = conflicts
      .map((c) => {
        const nodesStr = c.conflictingNodes.map((n) => `#${n.id}`).join(', ');
        return `${c.type}: ${c.message} (${nodesStr})`;
      })
      .join('\n');

    label.setAttribute('title', `Route conflicts:\n${conflictMessages}`);
    label.setAttribute('aria-label', `Route has conflicts: ${conflictMessages}`);
  }

  label.textContent = `${segmentText} ${indicators.join(' ')}`;

  // Actions
  const actions = item.createDiv({ cls: 'ptpv-route-actions' });

  const btnEdit = actions.createEl('button', { text: ctx.t.settings.routes.editRoute });
  btnEdit.onclick = () => {
    uiState.editingNodeId = node.id;
    ctx.refresh();
  };

  const btnAddChild = actions.createEl('button', { text: ctx.t.settings.routes.addChildRoute });
  btnAddChild.onclick = () => {
    logger.debug('Adding child route', { parentId: node.id });
    const newChild: RouteNode = {
      id: `route-${Date.now()}`,
      segment: '',
      ignoredCleanupRuleIds: [],
    };
    if (!node.children) node.children = [];
    // Add to END of children list (user requirement)
    node.children.push(newChild);
    uiState.expandedNodes.add(node.id); // Auto-expand parent
    uiState.editingNodeId = newChild.id; // Auto-open editor
    uiState.hasUnsavedChanges = true;
    ctx.refresh();
  };

  const btnDelete = actions.createEl('button', { text: ctx.t.settings.routes.deleteRoute });
  btnDelete.onclick = () => {
    if (!canDeleteNode(uiState.tempRouteTree!, node)) {
      new Notice(ctx.t.settings.routes.deleteLastForbidden);
      return;
    }
    logger.debug('Route deleted', { nodeId: node.id });
    deleteNodeFromTree(uiState.tempRouteTree!, node.id);
    if (uiState.editingNodeId === node.id) {
      uiState.editingNodeId = null;
    }
    uiState.hasUnsavedChanges = true;
    ctx.refresh();
  };

  // Detailed editor (if this node is being edited)
  if (uiState.editingNodeId === node.id) {
    const editorContainer = nodeContainer.createDiv({ cls: 'ptpv-route-editor' });

    // Close button in top-right corner
    const closeBtn = editorContainer.createDiv({ cls: 'ptpv-route-editor-close' });
    setIcon(closeBtn, 'x');
    closeBtn.setAttribute('aria-label', ctx.t.settings.folders.closeEditor);
    closeBtn.setAttribute('title', ctx.t.settings.folders.closeEditor);
    closeBtn.onclick = () => {
      uiState.editingNodeId = null;
      ctx.refresh();
    };

    renderRouteEditor(editorContainer, vps, node, ctx);
  }

  // Render children (if expanded)
  if (hasChildren && uiState.expandedNodes.has(node.id)) {
    const childrenContainer = nodeContainer.createDiv({ cls: 'ptpv-route-children' });
    node.children!.forEach((child, index) => {
      renderRouteNode(
        childrenContainer,
        vps,
        child,
        ctx,
        depth + 1,
        index === node.children!.length - 1
      );
    });
  }
}

/**
 * Render detailed editor for a route node
 */
function renderRouteEditor(
  container: HTMLElement,
  vps: VpsConfig,
  node: RouteNode,
  ctx: SettingsViewContext
): void {
  const { t } = ctx;
  container.createEl('h4', { text: t.settings.routes.routeConfiguration });

  // Segment
  new Setting(container)
    .setName(t.settings.routes.segmentLabel)
    .setDesc(t.settings.routes.segmentDescription)
    .addText((text) => {
      text.setValue(node.segment || '').onChange((value) => {
        node.segment = value;
        uiState.hasUnsavedChanges = true;
      });
    });

  // Display Name (optional)
  new Setting(container)
    .setName(t.settings.routes.displayNameLabel)
    .setDesc(t.settings.routes.displayNameDescription)
    .addText((text) => {
      text
        .setPlaceholder(t.settings.routes.displayNamePlaceholder)
        .setValue(node.displayName || '')
        .onChange((value) => {
          node.displayName = value || undefined;
          uiState.hasUnsavedChanges = true;
        });
    });

  // Flatten Tree (always visible, disabled if no vaultFolder)
  const flattenSetting = new Setting(container)
    .setName(t.settings.folders.flattenTreeLabel)
    .setDesc(t.settings.folders.flattenTreeDescription);

  let flattenToggle: ToggleComponent | undefined; // Store reference to toggle component
  flattenSetting.addToggle((toggle) => {
    flattenToggle = toggle;
    toggle
      .setValue(node.flattenTree || false)
      .setDisabled(!node.vaultFolder)
      .onChange((value) => {
        node.flattenTree = value;
        uiState.hasUnsavedChanges = true;
      });
  });

  // Vault Folder (optional) - placed after flattenTree to have reference to toggle
  new Setting(container)
    .setName(t.settings.folders.vaultLabel)
    .setDesc(t.settings.folders.vaultDescription)
    .addSearch((search) => {
      new FolderSuggest(ctx.plugin.app, search.inputEl);
      search.setValue(node.vaultFolder || '').onChange((value) => {
        node.vaultFolder = value || undefined;
        // Update flattenTree toggle state without full refresh
        if (flattenToggle) {
          flattenToggle.setDisabled(!value);
        }
        uiState.hasUnsavedChanges = true;
      });
    });

  // Custom Index File
  new Setting(container)
    .setName(t.settings.folders.customIndexLabel)
    .setDesc(t.settings.folders.customIndexDescription)
    .addSearch((search) => {
      new FileSuggest(ctx.plugin.app, search.inputEl);
      search.setValue(node.customIndexFile || '').onChange((value) => {
        node.customIndexFile = value || undefined;
        uiState.hasUnsavedChanges = true;
      });
    });

  // Additional Files
  new Setting(container)
    .setName(t.settings.folders.additionalFilesLabel)
    .setDesc(t.settings.folders.additionalFilesDescription)
    .setHeading();

  const additionalFiles = node.additionalFiles || [];
  additionalFiles.forEach((filePath, index) => {
    const fileSetting = new Setting(container).addSearch((search) => {
      new FileSuggest(ctx.plugin.app, search.inputEl);
      search.setValue(filePath).onChange((value) => {
        if (!node.additionalFiles) node.additionalFiles = [];
        node.additionalFiles[index] = value;
        uiState.hasUnsavedChanges = true;
      });
    });

    fileSetting.addButton((btn) => {
      btn.setIcon('trash').onClick(() => {
        if (!node.additionalFiles) return;
        node.additionalFiles.splice(index, 1);
        uiState.hasUnsavedChanges = true;
        ctx.refresh();
      });
    });
  });

  // Add additional file button
  new Setting(container).addButton((btn) => {
    btn.setButtonText(t.settings.folders.addAdditionalFileButton).onClick(() => {
      if (!node.additionalFiles) node.additionalFiles = [];
      node.additionalFiles.push('');
      uiState.hasUnsavedChanges = true;
      ctx.refresh();
    });
  });

  // Ignored Cleanup Rules
  // TODO: Add UI for managing ignoredCleanupRuleIds
  // For now, users can manage this via JSON if needed

  // Close editor button
  new Setting(container).addButton((btn) => {
    btn
      .setButtonText(t.settings.folders.closeEditor)
      .setCta()
      .onClick(() => {
        uiState.editingNodeId = null;
        ctx.refresh();
      });
  });
}
