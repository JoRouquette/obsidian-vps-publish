import type { RouteNode } from '@core-domain/entities/route-node';
import { getNodeConflicts, validateRouteTree } from '@core-domain/entities/route-node-validation';
import type { VpsConfig } from '@core-domain/entities/vps-config';
import { Notice, setIcon, Setting, ToggleComponent } from 'obsidian';

import { translate } from '../../../i18n';
import { FileSuggest } from '../../suggesters/file-suggester';
import { FolderSuggest } from '../../suggesters/folder-suggester';
import type { SettingsViewContext } from '../context';

/**
 * UI State (non-persisted, ephemeral)
 */
interface RoutesUIState {
  editingNodeId: string | null; // null = no editor open
  expandedNodes: Set<string>; // IDs of expanded nodes in tree view
}

/**
 * Global UI state (module-level, reset on each render)
 */
let uiState: RoutesUIState = {
  editingNodeId: null,
  expandedNodes: new Set<string>(),
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

    const routeTree = vps.routeTree;

    // Ensure at least one root route
    if (routeTree.roots.length === 0) {
      routeTree.roots.push({
        id: `route-${Date.now()}`,
        segment: '',
        ignoredCleanupRuleIds: [],
      });
    }

    // Validate route tree and display global warning if needed
    const validationResult = validateRouteTree(routeTree);
    if (!validationResult.valid) {
      const warningContainer = vpsSection.createDiv({ cls: 'ptpv-validation-warning' });
      warningContainer.createEl('strong', { text: '⚠️ Route Configuration Issues' });

      const conflictsList = warningContainer.createEl('ul');
      validationResult.conflicts.forEach((conflict) => {
        const item = conflictsList.createEl('li');
        item.textContent = `${conflict.message} at ${conflict.path}`;
        item.style.color = 'var(--text-error)';
      });

      const helpText = warningContainer.createEl('div', { cls: 'setting-item-description' });
      helpText.textContent =
        'Please fix these conflicts before publishing. Hover over route labels with ⚠️ for details.';
    }

    // Render tree container
    const treeContainer = vpsSection.createDiv({ cls: 'ptpv-routes-tree' });

    const updateTree = () => {
      treeContainer.empty();
      // Sort roots alphabetically by segment before rendering
      const sortedRoots = [...routeTree.roots].sort((a, b) => {
        const segmentA = (a.segment || '/').toLowerCase();
        const segmentB = (b.segment || '/').toLowerCase();
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
      void ctx.save().then(() => ctx.refresh());
    };
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

  // Indent based on depth
  item.style.paddingLeft = `${depth * 20}px`;

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
  const conflicts = getNodeConflicts(vps.routeTree!, node.id);
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
    void ctx.save().then(() => ctx.refresh());
  };

  const btnDelete = actions.createEl('button', { text: ctx.t.settings.routes.deleteRoute });
  btnDelete.onclick = () => {
    if (!canDeleteNode(vps, node)) {
      new Notice(ctx.t.settings.routes.deleteLastForbidden);
      return;
    }
    logger.debug('Route deleted', { nodeId: node.id });
    deleteNodeFromTree(vps.routeTree!, node.id);
    if (uiState.editingNodeId === node.id) {
      uiState.editingNodeId = null;
    }
    void ctx.save().then(() => ctx.refresh());
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
        void ctx.save();
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
          void ctx.save();
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
        void ctx.save();
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
        void ctx.save();
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
        void ctx.save();
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
        void ctx.save();
      });
    });

    fileSetting.addButton((btn) => {
      btn.setIcon('trash').onClick(() => {
        if (!node.additionalFiles) return;
        node.additionalFiles.splice(index, 1);
        void ctx.save().then(() => ctx.refresh());
      });
    });
  });

  // Add additional file button
  new Setting(container).addButton((btn) => {
    btn.setButtonText(t.settings.folders.addAdditionalFileButton).onClick(() => {
      if (!node.additionalFiles) node.additionalFiles = [];
      node.additionalFiles.push('');
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

/**
 * Check if a node can be deleted
 */
function canDeleteNode(vps: VpsConfig, node: RouteNode): boolean {
  if (!vps.routeTree || !vps.routeTree.roots) return false;

  // If it's a root node, ensure it's not the last root
  const isRoot = vps.routeTree.roots.some((r) => r.id === node.id);
  if (isRoot && vps.routeTree.roots.length <= 1) {
    return false;
  }

  return true;
}

/**
 * Delete a node from the tree (recursive search)
 */
function deleteNodeFromTree(routeTree: { roots: RouteNode[] }, nodeId: string): boolean {
  // Check roots
  const rootIndex = routeTree.roots.findIndex((r) => r.id === nodeId);
  if (rootIndex !== -1) {
    routeTree.roots.splice(rootIndex, 1);
    return true;
  }

  // Recursively check children
  for (const root of routeTree.roots) {
    if (deleteNodeFromChildren(root, nodeId)) {
      return true;
    }
  }

  return false;
}

/**
 * Delete a node from children (recursive)
 */
function deleteNodeFromChildren(parent: RouteNode, nodeId: string): boolean {
  if (!parent.children) return false;

  const childIndex = parent.children.findIndex((c) => c.id === nodeId);
  if (childIndex !== -1) {
    parent.children.splice(childIndex, 1);
    return true;
  }

  // Recursively check grandchildren
  for (const child of parent.children) {
    if (deleteNodeFromChildren(child, nodeId)) {
      return true;
    }
  }

  return false;
}
