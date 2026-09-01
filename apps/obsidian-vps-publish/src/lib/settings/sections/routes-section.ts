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
import { renderIgnoredCleanupRulesSettings } from './ignored-cleanup-rules-settings.util';

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
  searchQuery: string; // Filtre de l'arbre (éphémère, non persisté)
  /**
   * Redessine l'arbre **et** l'état des boutons Enregistrer/Annuler, sans
   * reconstruire tout l'onglet. Renseigné par `renderVpsRoutes`.
   */
  redraw: (() => void) | null;
}

/**
 * Redessine localement si possible, sinon retombe sur un rendu complet.
 *
 * Déplier, déplacer, ouvrir un éditeur ou supprimer un nœud sont des actions
 * **locales à l'arbre** : les faire passer par `ctx.refresh()` reconstruisait
 * tout l'onglet, et faisait perdre la position de défilement et le focus.
 *
 * Le repli sur `ctx.refresh()` couvre le cas où l'arbre n'a pas encore été
 * rendu — il ne devrait pas se produire, mais il évite une action sans effet.
 */
function redrawTree(state: RoutesUIState, ctx: SettingsViewContext): void {
  if (state.redraw) {
    state.redraw();
    return;
  }
  ctx.refresh();
}

/** Le tri alphabétique des racines est-il actif pour ce serveur ? */
function rootsAreSorted(vps: VpsConfig): boolean {
  return vps.sortRoutesAlphabetically !== false;
}

/**
 * Ordre d'affichage des **racines** uniquement.
 *
 * L'asymétrie racines/enfants est **voulue** : les racines sont classées pour
 * rester lisibles, les enfants gardent l'ordre que l'utilisateur leur a donné.
 * L'ordre n'ayant aucune signification fonctionnelle — le domaine ne fait que
 * parcourir l'arbre, les routes étant adressées par leurs segments — c'est un
 * choix de présentation, réglable par serveur.
 *
 * Corollaire assumé : tant que le tri est actif, réordonner une racine à la main
 * ne peut rien produire. Les commandes de déplacement sont donc masquées à ce
 * niveau (voir `renderRouteNode`), plutôt que de rester cliquables sans effet.
 */
function orderedRoots(nodes: RouteNode[], vps: VpsConfig): RouteNode[] {
  if (!rootsAreSorted(vps)) return nodes;

  return [...nodes].sort((a, b) => {
    const segmentA = (a.segment || '').toLowerCase();
    const segmentB = (b.segment || '').toLowerCase();
    // La racine du site (segment vide) reste en tête.
    if (segmentA === '' && segmentB !== '') return -1;
    if (segmentA !== '' && segmentB === '') return 1;
    return segmentA.localeCompare(segmentB);
  });
}

/** Un nœud correspond-il à la recherche, par son segment, son nom ou son dossier ? */
function nodeMatchesQuery(node: RouteNode, query: string): boolean {
  const haystack = [node.segment, node.displayName, node.vaultFolder, node.customIndexFile]
    .filter((value): value is string => typeof value === 'string' && value.length > 0)
    .join(' ')
    .toLowerCase();
  return haystack.includes(query);
}

/**
 * Identifiants des nœuds à afficher pour une recherche donnée : ceux qui
 * correspondent, **plus leurs ancêtres**, sans quoi un résultat profond
 * n'aurait aucun chemin pour être atteint.
 */
function visibleNodeIds(roots: RouteNode[], query: string): Set<string> {
  const visible = new Set<string>();

  const walk = (node: RouteNode): boolean => {
    let anyChildMatches = false;
    for (const child of node.children ?? []) {
      // Pas de court-circuit : tous les descendants doivent être évalués.
      anyChildMatches = walk(child) || anyChildMatches;
    }
    const matches = nodeMatchesQuery(node, query) || anyChildMatches;
    if (matches) visible.add(node.id);
    return matches;
  };

  roots.forEach(walk);
  return visible;
}

/** Tous les identifiants de l'arbre, pour « tout déplier ». */
function allNodeIds(roots: RouteNode[]): string[] {
  const ids: string[] = [];
  const walk = (node: RouteNode): void => {
    ids.push(node.id);
    (node.children ?? []).forEach(walk);
  };
  roots.forEach(walk);
  return ids;
}

/**
 * Per-VPS UI state (keyed by VPS ID, prevents cross-VPS state corruption)
 */
const uiStates = new Map<string, RoutesUIState>();

function getOrCreateUiState(vpsId: string): RoutesUIState {
  let state = uiStates.get(vpsId);
  if (!state) {
    state = {
      editingNodeId: null,
      expandedNodes: new Set<string>(),
      tempRouteTree: null,
      hasUnsavedChanges: false,
      draggedNodeId: null,
      draggedNodeParentId: null,
      searchQuery: '',
      redraw: null,
    };
    uiStates.set(vpsId, state);
  }
  return state;
}

/**
 * Indique si l'arbre de routes d'un serveur porte des modifications non
 * enregistrées.
 *
 * Cette section est la seule du plugin à travailler sur un **brouillon** validé
 * par un bouton « Enregistrer » ; partout ailleurs l'écriture est immédiate.
 * Exposer l'état permet de le signaler à l'utilisateur au lieu de le laisser
 * découvrir la différence en perdant son travail.
 */
export function hasUnsavedRouteChanges(vpsId: string): boolean {
  return uiStates.get(vpsId)?.hasUnsavedChanges ?? false;
}

/**
 * Arbre de routes d'**un** serveur. C'est la brique que l'API déclarative place
 * sous la page du serveur concerné.
 */
export function renderVpsRoutes(root: HTMLElement, vps: VpsConfig, ctx: SettingsViewContext): void {
  const { t, logger } = ctx;

  {
    const vpsSection = root.createDiv({ cls: 'ptpv-routes-vps-section' });

    const state = getOrCreateUiState(vps.id);

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
    if (!state.tempRouteTree) {
      state.tempRouteTree = JSON.parse(JSON.stringify(vps.routeTree));
    }

    const routeTree = state.tempRouteTree!; // Non-null assertion safe here after check

    // Ensure at least one root route
    if (routeTree.roots.length === 0) {
      routeTree.roots.push({
        id: `route-${Date.now()}`,
        segment: '',
        ignoredCleanupRuleIds: [],
      });
      state.hasUnsavedChanges = true;
    }

    // Barre d'outils de l'arbre : recherche, pliage global, ordre d'affichage.
    const toolbar = vpsSection.createDiv({ cls: 'ptpv-routes-toolbar' });
    const treeContainer = vpsSection.createDiv({ cls: 'ptpv-routes-tree' });

    // Les boutons Enregistrer/Annuler vivent hors du conteneur d'arbre : un
    // re-rendu local de l'arbre seul les laisserait désactivés alors que
    // l'utilisateur vient de modifier quelque chose. On redessine donc les deux.
    // Renseigné plus bas, une fois les boutons créés.
    let refreshActions: () => void = () => {};
    const redraw = (): void => {
      updateTree();
      refreshActions();
    };

    const updateTree = () => {
      treeContainer.empty();

      const query = state.searchQuery.trim().toLowerCase();
      // `null` = pas de filtre actif ; sinon, ensemble des nœuds à afficher.
      const visible = query ? visibleNodeIds(routeTree.roots, query) : null;

      const roots = orderedRoots(routeTree.roots, vps).filter(
        (node) => !visible || visible.has(node.id)
      );

      if (roots.length === 0) {
        treeContainer.createDiv({
          cls: 'ptpv-routes-no-results',
          text: t.settings.routes.noResults ?? 'No route matches this search',
        });
        return;
      }

      roots.forEach((rootNode, index) => {
        renderRouteNode(
          treeContainer,
          vps,
          rootNode,
          ctx,
          0,
          index === roots.length - 1,
          state,
          visible
        );
      });
    };

    // --- Barre d'outils ---------------------------------------------------
    // Ces trois commandes ne re-rendent que l'arbre, pas tout l'onglet : un
    // `ctx.refresh()` à chaque frappe rendrait la recherche inutilisable, le
    // champ perdant le focus entre deux caractères.
    new Setting(toolbar)
      .setName(t.settings.routes.searchLabel ?? 'Search')
      .addSearch((search) => {
        search
          .setPlaceholder(t.settings.routes.searchPlaceholder ?? 'Segment, name or folder')
          .setValue(state.searchQuery)
          .onChange((value) => {
            state.searchQuery = value;
            redraw();
          });
      })
      .addExtraButton((btn) => {
        btn
          .setIcon('chevrons-down-up')
          .setTooltip(t.settings.routes.collapseAll ?? 'Collapse all')
          .onClick(() => {
            state.expandedNodes.clear();
            redraw();
          });
      })
      .addExtraButton((btn) => {
        btn
          .setIcon('chevrons-up-down')
          .setTooltip(t.settings.routes.expandAll ?? 'Expand all')
          .onClick(() => {
            allNodeIds(routeTree.roots).forEach((id) => state.expandedNodes.add(id));
            redraw();
          });
      });

    new Setting(toolbar)
      .setName(t.settings.routes.sortAlphabeticallyLabel ?? 'Sort alphabetically')
      .setDesc(
        t.settings.routes.sortAlphabeticallyDescription ??
          'Display only — route order has no effect on the published site.'
      )
      .addToggle((toggle) => {
        toggle.setValue(vps.sortRoutesAlphabetically ?? true).onChange((value) => {
          logger.debug('Route sorting changed', { vpsId: vps.id, sortAlphabetically: value });
          vps.sortRoutesAlphabetically = value;
          void ctx.save();
          redraw();
        });
      });

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
      state.editingNodeId = newRoute.id; // Auto-open editor
      state.hasUnsavedChanges = true;
      redraw();
    };

    // Save/Cancel buttons at the bottom
    const actionRow = vpsSection.createDiv({
      cls: 'ptpv-button-row ptpv-routes-actions',
    });

    const btnSave = actionRow.createEl('button', {
      text: t.common.save || 'Sauvegarder',
    });
    btnSave.onclick = async () => {
      logger.debug('Saving route tree changes', { vpsId: vps.id });

      // Validate before saving
      const validationResult = validateRouteTree(state.tempRouteTree!);
      if (!validationResult.valid) {
        const errorMsg = validationResult.conflicts
          .map((c) => `${c.message} at ${c.path}`)
          .join('\n');
        new Notice(`⚠️ Cannot save: Route conflicts detected\n${errorMsg}`, 8000);
        return;
      }

      // Apply temp changes to actual settings
      vps.routeTree = JSON.parse(JSON.stringify(state.tempRouteTree));
      state.hasUnsavedChanges = false;
      state.tempRouteTree = null;
      await ctx.save();
      ctx.refresh();
      new Notice(t.common.saved || 'Sauvegardé');
    };

    const btnCancel = actionRow.createEl('button', {
      text: t.common.cancel || 'Annuler',
    });
    btnCancel.onclick = () => {
      logger.debug('Cancelling route tree changes', { vpsId: vps.id });
      // Reset temp state
      state.tempRouteTree = null;
      state.hasUnsavedChanges = false;
      state.editingNodeId = null;
      // Rendu complet volontaire : le brouillon est jeté, et le badge « non
      // enregistré » du titre vit hors de cette section.
      ctx.refresh();
      new Notice(t.common.cancelled || 'Annulé');
    };

    // Refléter l'état « non enregistré » sur les deux boutons. Appelé par
    // `redraw()`, donc à chaque action locale sur l'arbre.
    refreshActions = () => {
      btnSave.disabled = !state.hasUnsavedChanges;
      btnSave.toggleClass('mod-cta', state.hasUnsavedChanges);
      btnCancel.disabled = !state.hasUnsavedChanges;
    };
    refreshActions();

    // À partir d'ici, les actions locales de l'arbre passent par `redraw()`.
    state.redraw = redraw;
  }
}

/**
 * Chemin `display()` (Obsidian < 1.13) : un bloc de routes par serveur, à la
 * suite, sur un seul écran.
 */
export function renderRoutesSection(root: HTMLElement, ctx: SettingsViewContext): void {
  const { t, settings } = ctx;

  const routesBlock = root.createDiv({ cls: 'ptpv-block' });

  settings.vpsConfigs.forEach((vps, vpsIndex) => {
    const name =
      vps.name || translate(t, 'common.vpsNumberFallback', { number: (vpsIndex + 1).toString() });
    const heading = new Setting(routesBlock).setName(`${name} - Routes`).setHeading();

    // Le brouillon des routes est invisible autrement : on le signale ici.
    if (hasUnsavedRouteChanges(vps.id)) {
      heading.nameEl.createSpan({
        cls: 'ptpv-unsaved-badge',
        text: t.settings.routes?.unsavedBadge ?? 'Unsaved changes',
      });
    }

    renderVpsRoutes(routesBlock, vps, ctx);
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
  _isLastSibling: boolean,
  state: RoutesUIState,
  // Ensemble des nœuds retenus par la recherche, ou `null` si aucun filtre.
  visible: Set<string> | null = null
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
    state.draggedNodeId = node.id;
    // Find parent
    const parent = findParentNode(state.tempRouteTree!, node.id);
    state.draggedNodeParentId = parent?.id || null;
    item.addClass('is-dragging');
    e.dataTransfer!.effectAllowed = 'move';
  };

  item.ondragend = () => {
    item.removeClass('is-dragging');
    // Clean up any drag-over classes
    activeDocument
      .querySelectorAll('.drag-over-top, .drag-over-bottom, .drag-over-child')
      .forEach((el) => {
        el.removeClass('drag-over-top');
        el.removeClass('drag-over-bottom');
        el.removeClass('drag-over-child');
      });
  };

  item.ondragover = (e) => {
    e.preventDefault();
    if (!state.draggedNodeId || state.draggedNodeId === node.id) return;

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

    if (!state.draggedNodeId || state.draggedNodeId === node.id) return;

    const rect = item.getBoundingClientRect();
    const y = e.clientY - rect.top;
    const height = rect.height;

    const draggedNode = findNodeById(state.tempRouteTree!, state.draggedNodeId);
    if (!draggedNode) return;

    // Prevent dropping a parent into its own child
    if (isDescendant(draggedNode, node.id)) {
      new Notice(
        ctx.t.settings.routes.cannotMoveParentToChild || 'Cannot move a parent into its child'
      );
      return;
    }

    // Remove from old location
    removeNodeFromTree(state.tempRouteTree!, state.draggedNodeId);

    // Determine drop position
    if (y < height * 0.25) {
      // Insert before target
      insertNodeBefore(state.tempRouteTree!, node.id, draggedNode);
    } else if (y > height * 0.75) {
      // Insert after target
      insertNodeAfter(state.tempRouteTree!, node.id, draggedNode);
    } else {
      // Add as child
      if (!node.children) node.children = [];
      node.children.push(draggedNode);
      state.expandedNodes.add(node.id);
    }

    state.hasUnsavedChanges = true;
    state.draggedNodeId = null;
    state.draggedNodeParentId = null;
    redrawTree(state, ctx);
  };

  // Indent based on depth
  item.setCssStyles({ paddingLeft: `${depth * 20}px` });

  // Le tri alphabétique ne s'applique qu'aux racines, délibérément. Tant qu'il
  // est actif, replacer une racine à la main n'aurait aucun effet visible : on
  // masque donc les commandes de déplacement à ce niveau, au lieu de les laisser
  // cliquables, sans résultat, et salissant l'état « non enregistré ».
  // Les enfants, eux, gardent toujours leur ordre manuel.
  const canReorder = depth > 0 || !rootsAreSorted(vps);

  if (canReorder) {
    // Drag handle icon (always first)
    const dragHandle = item.createSpan({
      cls: 'ptpv-route-drag-handle',
      attr: { 'aria-label': 'Drag to reorder' },
    });
    setIcon(dragHandle, 'grip-vertical');

    // Keyboard move buttons (accessible alternative to drag & drop)
    const moveControls = item.createDiv({ cls: 'ptpv-route-move-controls' });

    const moveUpBtn = moveControls.createEl('button', {
      cls: 'ptpv-route-move-btn clickable-icon',
      attr: {
        'aria-label': ctx.t.routesKeyboard?.moveUp ?? 'Move up',
        tabindex: '0',
      },
    });
    setIcon(moveUpBtn, 'chevron-up');
    moveUpBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      moveNodeUp(state, node, { refresh: () => redrawTree(state, ctx) });
    });

    const moveDownBtn = moveControls.createEl('button', {
      cls: 'ptpv-route-move-btn clickable-icon',
      attr: {
        'aria-label': ctx.t.routesKeyboard?.moveDown ?? 'Move down',
        tabindex: '0',
      },
    });
    setIcon(moveDownBtn, 'chevron-down');
    moveDownBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      moveNodeDown(state, node, { refresh: () => redrawTree(state, ctx) });
    });
  } else {
    // Conserver l'alignement des colonnes avec les lignes réordonnables.
    item.createDiv({ cls: 'ptpv-route-move-spacer' });
  }

  // Expand/collapse button (if has children)
  const hasChildren = node.children && node.children.length > 0;
  if (hasChildren) {
    const isExpanded = state.expandedNodes.has(node.id);
    const btnExpand = item.createSpan({
      cls: 'ptpv-route-expand-btn',
      attr: { 'aria-label': isExpanded ? 'Collapse' : 'Expand' },
    });
    setIcon(btnExpand, isExpanded ? 'chevron-down' : 'chevron-right');
    btnExpand.onclick = () => {
      if (state.expandedNodes.has(node.id)) {
        state.expandedNodes.delete(node.id);
      } else {
        state.expandedNodes.add(node.id);
      }
      redrawTree(state, ctx);
    };
  } else {
    // Spacer for alignment
    item.createDiv({ cls: 'ptpv-route-expand-spacer' });
  }

  // Label : segment, puis le dossier publié, puis les indicateurs.
  const label = item.createDiv({ cls: 'ptpv-route-label' });
  const t = ctx.t;

  // Le nœud à segment vide est la racine du site : le dire, plutôt que « / » nu.
  if (node.segment) {
    label.createSpan({ cls: 'ptpv-route-segment', text: node.segment });
  } else {
    label.createSpan({ cls: 'ptpv-route-segment', text: '/' });
    label.createSpan({
      cls: 'ptpv-route-root-hint',
      text: t.settings.routes.rootRouteHint ?? 'site root',
    });
  }

  if (node.displayName) {
    label.createSpan({ cls: 'ptpv-route-display-name', text: node.displayName });
  }

  // Le dossier publié est l'information la plus utile de la ligne : sans lui, il
  // fallait ouvrir chaque nœud pour savoir ce que la route expose.
  if (node.vaultFolder) {
    label.createSpan({ cls: 'ptpv-route-folder', text: node.vaultFolder });
  }

  // Indicateurs : icônes natives plutôt qu'emoji, avec une infobulle qui dit ce
  // qu'elles signifient.
  const indicators = label.createSpan({ cls: 'ptpv-route-indicators' });
  const addIndicator = (icon: string, tooltip: string): void => {
    const el = indicators.createSpan({ cls: 'ptpv-route-indicator', attr: { title: tooltip } });
    setIcon(el, icon);
  };

  if (node.customIndexFile) {
    addIndicator('file-text', t.settings.routes.indicatorCustomIndex ?? 'Custom index file');
  }
  if (node.additionalFiles && node.additionalFiles.length > 0) {
    addIndicator(
      'paperclip',
      `${t.settings.routes.indicatorAdditionalFiles ?? 'Additional files'} (${node.additionalFiles.length})`
    );
  }
  if (node.flattenTree) {
    addIndicator('chevrons-down', t.settings.routes.indicatorFlatten ?? 'Flattened tree');
  }

  // Check for validation errors
  const conflicts = getNodeConflicts(state.tempRouteTree!, node.id);
  if (conflicts.length > 0) {
    label.addClass('ptpv-route-has-conflicts');

    const conflictMessages = conflicts
      .map((c) => {
        const nodesStr = c.conflictingNodes.map((n) => `#${n.id}`).join(', ');
        return `${c.type}: ${c.message} (${nodesStr})`;
      })
      .join('\n');

    addIndicator('alert-triangle', conflictMessages);
    label.setAttribute('title', `Route conflicts:\n${conflictMessages}`);
    label.setAttribute('aria-label', `Route has conflicts: ${conflictMessages}`);
  }

  // Actions
  const actions = item.createDiv({ cls: 'ptpv-route-actions' });

  const btnEdit = actions.createEl('button', { text: ctx.t.settings.routes.editRoute });
  btnEdit.onclick = () => {
    state.editingNodeId = node.id;
    redrawTree(state, ctx);
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
    state.expandedNodes.add(node.id); // Auto-expand parent
    state.editingNodeId = newChild.id; // Auto-open editor
    state.hasUnsavedChanges = true;
    redrawTree(state, ctx);
  };

  const btnDelete = actions.createEl('button', { text: ctx.t.settings.routes.deleteRoute });
  btnDelete.onclick = () => {
    if (!canDeleteNode(state.tempRouteTree!, node)) {
      new Notice(ctx.t.settings.routes.deleteLastForbidden);
      return;
    }
    logger.debug('Route deleted', { nodeId: node.id });
    deleteNodeFromTree(state.tempRouteTree!, node.id);
    if (state.editingNodeId === node.id) {
      state.editingNodeId = null;
    }
    state.hasUnsavedChanges = true;
    redrawTree(state, ctx);
  };

  // Detailed editor (if this node is being edited)
  if (state.editingNodeId === node.id) {
    const editorContainer = nodeContainer.createDiv({ cls: 'ptpv-route-editor' });

    // Close button in top-right corner
    const closeBtn = editorContainer.createDiv({ cls: 'ptpv-route-editor-close' });
    setIcon(closeBtn, 'x');
    closeBtn.setAttribute('aria-label', ctx.t.settings.folders.closeEditor);
    closeBtn.setAttribute('title', ctx.t.settings.folders.closeEditor);
    closeBtn.onclick = () => {
      state.editingNodeId = null;
      redrawTree(state, ctx);
    };

    renderRouteEditor(editorContainer, vps, node, ctx, state);
  }

  // Render children (if expanded).
  // Une recherche active déplie d'office : masquer un résultat derrière un nœud
  // replié reviendrait à ne pas le trouver.
  if (hasChildren && (state.expandedNodes.has(node.id) || visible)) {
    // Les enfants gardent leur ordre stocké : c'est délibéré, le tri ne concerne
    // que les racines.
    const children = node.children!.filter((child) => !visible || visible.has(child.id));
    if (children.length > 0) {
      const childrenContainer = nodeContainer.createDiv({ cls: 'ptpv-route-children' });
      children.forEach((child, index) => {
        renderRouteNode(
          childrenContainer,
          vps,
          child,
          ctx,
          depth + 1,
          index === children.length - 1,
          state,
          visible
        );
      });
    }
  }
}

/**
 * Render detailed editor for a route node
 */
function renderRouteEditor(
  container: HTMLElement,
  vps: VpsConfig,
  node: RouteNode,
  ctx: SettingsViewContext,
  state: RoutesUIState
): void {
  const { t, logger } = ctx;
  container.createEl('h4', { text: t.settings.routes.routeConfiguration });

  // Segment
  new Setting(container)
    .setName(t.settings.routes.segmentLabel)
    .setDesc(t.settings.routes.segmentDescription)
    .addText((text) => {
      text.setValue(node.segment || '').onChange((value) => {
        node.segment = value;
        state.hasUnsavedChanges = true;
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
          state.hasUnsavedChanges = true;
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
        state.hasUnsavedChanges = true;
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
        state.hasUnsavedChanges = true;
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
        state.hasUnsavedChanges = true;
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
        state.hasUnsavedChanges = true;
      });
    });

    fileSetting.addButton((btn) => {
      btn.setIcon('trash').onClick(() => {
        if (!node.additionalFiles) return;
        node.additionalFiles.splice(index, 1);
        state.hasUnsavedChanges = true;
        redrawTree(state, ctx);
      });
    });
  });

  // Add additional file button
  new Setting(container).addButton((btn) => {
    btn.setButtonText(t.settings.folders.addAdditionalFileButton).onClick(() => {
      if (!node.additionalFiles) node.additionalFiles = [];
      node.additionalFiles.push('');
      state.hasUnsavedChanges = true;
      redrawTree(state, ctx);
    });
  });

  renderIgnoredCleanupRulesSettings(container, vps, node, ctx, logger, 'route');

  // Close editor button
  new Setting(container).addButton((btn) => {
    btn
      .setButtonText(t.settings.folders.closeEditor)
      .setCta()
      .onClick(() => {
        state.editingNodeId = null;
        redrawTree(state, ctx);
      });
  });
}

// ---------------------------------------------------------------------------
// Keyboard Move Helpers
// ---------------------------------------------------------------------------

interface MoveUIState {
  tempRouteTree: { roots: RouteNode[] } | null;
  hasUnsavedChanges: boolean;
}

interface MoveContext {
  refresh: () => void;
}

/**
 * Get siblings array and current index for a node
 */
function getSiblingsAndIndex(
  routeTree: { roots: RouteNode[] },
  node: RouteNode
): { siblings: RouteNode[]; index: number } | null {
  // Check if it's a root node
  const rootIndex = routeTree.roots.findIndex((r) => r.id === node.id);
  if (rootIndex !== -1) {
    return { siblings: routeTree.roots, index: rootIndex };
  }

  // Find parent and get siblings
  const parent = findParentNode(routeTree, node.id);
  if (parent && parent.children) {
    const index = parent.children.findIndex((c) => c.id === node.id);
    if (index !== -1) {
      return { siblings: parent.children, index };
    }
  }

  return null;
}

/**
 * Move a node up in its siblings array
 */
function moveNodeUp(uiState: MoveUIState, node: RouteNode, ctx: MoveContext): void {
  if (!uiState.tempRouteTree) return;

  const result = getSiblingsAndIndex(uiState.tempRouteTree, node);
  if (!result) return;

  const { siblings, index } = result;

  // Can't move up if already first
  if (index === 0) return;

  // Swap with previous sibling
  [siblings[index - 1], siblings[index]] = [siblings[index], siblings[index - 1]];

  uiState.hasUnsavedChanges = true;
  ctx.refresh();
}

/**
 * Move a node down in its siblings array
 */
function moveNodeDown(uiState: MoveUIState, node: RouteNode, ctx: MoveContext): void {
  if (!uiState.tempRouteTree) return;

  const result = getSiblingsAndIndex(uiState.tempRouteTree, node);
  if (!result) return;

  const { siblings, index } = result;

  // Can't move down if already last
  if (index >= siblings.length - 1) return;

  // Swap with next sibling
  [siblings[index], siblings[index + 1]] = [siblings[index + 1], siblings[index]];

  uiState.hasUnsavedChanges = true;
  ctx.refresh();
}
