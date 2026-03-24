/**
 * Dataview Executor
 *
 * Executes Dataview queries and scripts using the Obsidian Dataview plugin API,
 * returning STRUCTURED DATA instead of HTML.
 *
 * CRITICAL DIFFERENCE from previous DataviewRenderer:
 * - Returns raw Dataview API results (objects, arrays)
 * - Does NOT render to HTML
 * - Allows downstream Markdown conversion
 *
 * ARCHITECTURE:
 * - Executes `dataview` queries (LIST, TABLE, TASK, CALENDAR) via dataviewApi.query()
 * - Executes `dataviewjs` scripts via dataviewApi.executeJs()
 * - Captures DOM for DataviewJS (to be converted to Markdown later)
 * - Returns stable error objects if execution fails
 *
 * USAGE:
 * ```typescript
 * const executor = new DataviewExecutor(dataviewApi, app);
 * const result = await executor.executeQuery('LIST where type="Book"', 'path/to/note.md');
 * // result contains structured data (values, headers, etc.)
 * ```
 */

import path from 'node:path';

import type { DataviewBlock } from '@core-domain/dataview/dataview-block';
import type { Component } from 'obsidian';

/**
 * Minimal Dataview API interface.
 */
export interface DataviewApi {
  /**
   * Execute a DQL query and return results.
   */
  query(
    query: string,
    filePath?: string
  ): Promise<{ successful: boolean; value?: DataviewQueryResult; error?: string }>;

  /**
   * Execute JavaScript code in Dataview context.
   */
  executeJs(
    code: string,
    container: HTMLElement,
    component: Component,
    filePath: string
  ): Promise<void>;
}

/**
 * Minimal Obsidian App interface.
 */
export interface ObsidianApp {
  workspace: {
    getActiveFile(): { path: string } | null;
  };
  vault?: {
    adapter?: unknown;
  };
}

type RequireLike = typeof require;

/**
 * Dataview query result value (from Dataview API).
 */
export interface DataviewQueryResult {
  values?: unknown[];
  headers?: string[];
  type?: string;
  [key: string]: unknown;
}

/**
 * Result of executing a Dataview query.
 */
export interface QueryExecutionResult {
  readonly success: boolean;
  readonly data?: DataviewQueryResult;
  readonly error?: string;
}

/**
 * Result of executing DataviewJS.
 */
export interface JsExecutionResult {
  readonly success: boolean;
  readonly container?: HTMLElement;
  readonly error?: string;
}

/**
 * Dataview block executor (returns structured data, not HTML).
 */
export class DataviewExecutor {
  constructor(
    private readonly dataviewApi: DataviewApi,
    private readonly app: ObsidianApp
  ) {}

  /**
   * Execute a Dataview block and return structured data.
   *
   * @param block - Parsed Dataview block
   * @param filePath - Path of the note being processed (for context)
   * @returns Execution result with structured data
   */
  async executeBlock(
    block: DataviewBlock,
    filePath: string
  ): Promise<QueryExecutionResult | JsExecutionResult> {
    try {
      if (block.kind === 'query') {
        return await this.executeQuery(block.contentRaw, filePath);
      } else {
        return await this.executeJs(block.contentRaw, filePath);
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      return {
        success: false,
        error: errorMessage,
      };
    }
  }

  /**
   * Execute a DQL query and return structured data.
   */
  private async executeQuery(query: string, filePath: string): Promise<QueryExecutionResult> {
    try {
      const result = await this.dataviewApi.query(query, filePath);

      if (!result.successful || result.error) {
        return {
          success: false,
          error: result.error || 'Query execution failed',
        };
      }

      return {
        success: true,
        data: result.value,
      };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      return {
        success: false,
        error: errorMessage,
      };
    }
  }

  /**
   * Execute DataviewJS and return captured DOM.
   *
   * STRATEGY:
   * - Create temporary container
   * - Execute JS via Dataview API
   * - Wait for DOM updates
   * - Return container for Markdown conversion
   */
  private async executeJs(code: string, filePath: string): Promise<JsExecutionResult> {
    try {
      // Create a temporary container for rendering
      const container = document.createElement('div');
      container.className = 'dv-js-container';

      // Create a minimal component for Dataview API
      const component: Component = {
        load: () => {},
        onload: () => {},
        unload: () => {},
        addChild: () => component,
        removeChild: () => {},
        register: () => {},
        registerEvent: () => {},
        registerDomEvent: () => {},
        registerInterval: () => 0,
      } as unknown as Component;

      // Execute the JavaScript.
      // Legacy DataviewJS views in some vaults still use require("//_assets/..."),
      // which Electron treats as an invalid absolute module path. During publishing,
      // shim require() so these old-style vault-root imports still resolve.
      const restoreRequire = this.installVaultRootRequireShim();
      try {
        await this.dataviewApi.executeJs(code, container, component, filePath);
      } finally {
        restoreRequire?.();
      }

      // Wait for DOM updates to complete (Dataview may render asynchronously)
      const maxWaitMs = 500;
      const startTime = Date.now();
      let lastChildCount = 0;

      while (Date.now() - startTime < maxWaitMs) {
        const currentChildCount = this.countMeaningfulChildren(container);

        // If we have meaningful content and it's stable
        if (currentChildCount > 0 && currentChildCount === lastChildCount) {
          break;
        }

        lastChildCount = currentChildCount;
        await new Promise((resolve) => setTimeout(resolve, 50));
      }

      // Check if we got any meaningful output
      // Use countMeaningfulChildren() instead of innerHTML.trim() to detect truly empty containers
      const meaningfulChildCount = this.countMeaningfulChildren(container);
      if (meaningfulChildCount === 0) {
        // Empty output is valid - return success with empty container
        // The converter will detect this and return '' (block will be removed)
        return {
          success: true,
          container,
        };
      }

      return {
        success: true,
        container,
      };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      return {
        success: false,
        error: errorMessage,
      };
    }
  }

  /**
   * Count meaningful child nodes in a container (ignoring empty elements).
   */
  private countMeaningfulChildren(container: HTMLElement): number {
    if (!container || !container.childNodes) {
      return 0;
    }

    let count = 0;

    const countNodes = (node: Node): void => {
      if (node.nodeType === Node.TEXT_NODE) {
        if (node.textContent && node.textContent.trim().length > 0) {
          count++;
        }
      } else if (node.nodeType === Node.ELEMENT_NODE) {
        const el = node as HTMLElement;
        // Count non-empty elements
        if (el.children.length > 0 || (el.textContent && el.textContent.trim().length > 0)) {
          count++;
        }
        // Recurse through children if they exist
        if (el.childNodes && el.childNodes.length > 0) {
          for (let i = 0; i < el.childNodes.length; i++) {
            countNodes(el.childNodes[i]);
          }
        }
      }
    };

    for (let i = 0; i < container.childNodes.length; i++) {
      countNodes(container.childNodes[i]);
    }

    return count;
  }

  private installVaultRootRequireShim(): (() => void) | null {
    const basePath = this.getVaultBasePath();
    if (!basePath) {
      return null;
    }

    const globalScope = globalThis as typeof globalThis & {
      require?: RequireLike;
      window?: Window & { require?: RequireLike };
    };

    const originalRequire =
      typeof globalScope.require === 'function'
        ? globalScope.require
        : typeof globalScope.window?.require === 'function'
          ? globalScope.window.require
          : null;

    if (!originalRequire) {
      return null;
    }

    const wrappedRequire = ((request: string) => {
      if (this.isLegacyVaultRootRequire(request)) {
        const vaultRelativePath = request.replace(/^\/+/, '').replace(/[\\/]+/g, path.sep);
        return originalRequire(path.join(basePath, vaultRelativePath));
      }

      return originalRequire(request);
    }) as RequireLike;

    wrappedRequire.resolve = originalRequire.resolve?.bind(originalRequire);
    wrappedRequire.cache = originalRequire.cache;
    wrappedRequire.extensions = originalRequire.extensions;
    wrappedRequire.main = originalRequire.main;

    const previousGlobalRequire = globalScope.require;
    const previousWindowRequire = globalScope.window?.require;

    globalScope.require = wrappedRequire;
    if (globalScope.window) {
      globalScope.window.require = wrappedRequire;
    }

    return () => {
      if (previousGlobalRequire) {
        globalScope.require = previousGlobalRequire;
      } else {
        Reflect.deleteProperty(globalScope, 'require');
      }

      if (globalScope.window) {
        if (previousWindowRequire) {
          globalScope.window.require = previousWindowRequire;
        } else {
          Reflect.deleteProperty(globalScope.window, 'require');
        }
      }
    };
  }

  private getVaultBasePath(): string | null {
    const adapter = this.app.vault?.adapter as
      | {
          getBasePath?: () => string;
          basePath?: string;
        }
      | undefined;
    if (!adapter) {
      return null;
    }

    if (typeof adapter.getBasePath === 'function') {
      const value = adapter.getBasePath();
      return typeof value === 'string' && value.trim().length > 0 ? value : null;
    }

    if (typeof adapter.basePath === 'string' && adapter.basePath.trim().length > 0) {
      return adapter.basePath;
    }

    return null;
  }

  private isLegacyVaultRootRequire(request: string): boolean {
    if (typeof request !== 'string') {
      return false;
    }

    if (!request.startsWith('/')) {
      return false;
    }

    return !/^[a-zA-Z]+:/.test(request);
  }
}
