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

import type { DataviewBlock } from '@core-domain/dataview/dataview-block';
import { type Component, Platform } from 'obsidian';

import { RenderTracker } from './dataview-render-tracker';

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
 * Minimal shape of the Dataview-internal renderer passed to our fake Component's
 * addChild(), used to release it once rendering is known to be settled.
 */
interface CapturedRenderer {
  unload?: () => void;
}

/**
 * Upper bound on the wait for a view's own render work (its render() promise and the
 * MarkdownRenderer.render() calls it started). Only a view that never finishes reaches it.
 */
const DEFAULT_RENDER_SETTLE_MAX_MS = 10_000;

/**
 * Quiet tail kept after the render promises settled, for work a view starts without a promise.
 * It counts from the last DOM mutation, so a view that ran for a while waits no further.
 */
const DOM_TAIL_QUIET_MS = 150;
const DOM_TAIL_MAX_MS = 1000;

/** What counts as a DOM change, for both ways of waiting for the DOM to go quiet. */
const DOM_OBSERVE_OPTIONS: MutationObserverInit = {
  childList: true,
  subtree: true,
  characterData: true,
  attributes: true,
};

/** Rounds of "settle the tracked promises, then wait out the quiet tail" before giving up. */
const MAX_SETTLE_ROUNDS = 5;

/**
 * The global shims and the stableRender.js cache bypass belong to the whole process, not to an
 * executor: a new executor is created per publication, and two publications can overlap. The
 * lease count lives here for that reason (see DataviewExecutor.acquireGlobalShims).
 */
let sharedShimLeases = 0;
let restoreSharedShims: (() => void) | null = null;

/** Number of executions holding the global shims right now (introspection, used by the tests). */
export function activeShimLeaseCount(): number {
  return sharedShimLeases;
}

/** Handle on the DOM mutations of a container since it was created. */
interface DomActivity {
  /** Resolves once no mutation occurred for `quietMs`, or after `maxMs` at the latest. */
  quietFor(quietMs: number, maxMs: number): Promise<void>;
  dispose(): void;
}

export interface DataviewExecutorOptions {
  /** Safety cap on waiting for a view to finish rendering, in milliseconds. */
  readonly renderSettleMaxMs?: number;
}

/**
 * Dataview block executor (returns structured data, not HTML).
 */
export class DataviewExecutor {
  private readonly renderSettleMaxMs: number;

  /** Each warning below is emitted once per executor, not once per block. */
  private hasWarnedRenderNotCaptured = false;
  private hasWarnedTrackerUnavailable = false;

  constructor(
    private readonly dataviewApi: DataviewApi,
    private readonly app: ObsidianApp,
    options?: DataviewExecutorOptions
  ) {
    this.renderSettleMaxMs = options?.renderSettleMaxMs ?? DEFAULT_RENDER_SETTLE_MAX_MS;
  }

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
      const container = createDiv({ cls: 'dv-js-container' });

      // Create a minimal component for Dataview API.
      //
      // Dataview's executeJs() does `renderer.load()` then `component.addChild(renderer)`
      // (in that order): by the time addChild runs, the renderer's own onload() has already
      // called its render() without awaiting it (fire-and-forget), and it exposes no public
      // signal (confirmed by reading Dataview's own source: onload() discards render()'s
      // promise). The end of the render is awaited through the RenderTracker instead (see
      // awaitRender). We capture whatever children get added here purely so we can unload()
      // them below, once rendering is known to be settled — that is what
      // stops the 'dataview:refresh-views' listener and DOM watcher registered in onload()
      // from leaking on every republish. A plain array (not a single variable) because
      // nothing guarantees exactly one addChild() call.
      const capturedRenderers: CapturedRenderer[] = [];
      const component: Component = {
        load: () => {},
        onload: () => {},
        unload: () => {},
        addChild: (child: Component) => {
          capturedRenderers.push(child);
          return component;
        },
        removeChild: () => {},
        register: () => {},
        registerEvent: () => {},
        registerDomEvent: () => {},
        registerInterval: () => 0,
      } as unknown as Component;

      // Execute the JavaScript, with the require() / getResourcePath() shims and the
      // stableRender.js cache bypass in place (see acquireGlobalShims for why). They are
      // leased: installed by the first execution in flight, restored by the last one.
      let shimsAcquired = false;

      // Detached copy of the rendered DOM, taken before any renderer is unloaded.
      //
      // Unloading must come AFTER the capture: Dataview's dv.list()/dv.table()/dv.taskList()
      // register ReactRenderer children on the renderer, and ReactRenderer.onunload() unmounts
      // its Preact tree from the container (`render(null, containerEl)`), emptying it. Unloading
      // first, then reading the live container, published every such view as an empty block.
      let snapshot: HTMLElement;

      // Collects the promises of the view's own render work while this execution is in flight
      // (see dataview-render-tracker.ts). Created before executeJs() so that the render() that
      // Dataview starts inside it is seen. Disposed in the outer finally below.
      let renderTracker: RenderTracker | undefined;
      let domActivity: DomActivity | undefined;
      let cancelQuiescence: (() => void) | undefined;

      try {
        try {
          this.acquireGlobalShims();
          shimsAcquired = true;
          try {
            renderTracker = new RenderTracker(container);
          } catch (trackerError) {
            // The hooks cannot be installed (locked prototype, say): publish with the DOM
            // quiescence fallback rather than failing every block.
            if (!this.hasWarnedTrackerUnavailable) {
              this.hasWarnedTrackerUnavailable = true;
              console.warn(
                '[obsidian-vps-publish] dataview: render tracking is unavailable ' +
                  '(falling back to DOM quiescence):',
                trackerError
              );
            }
          }

          // Both detectors below are started before executeJs(): a fully synchronous view
          // finishes mutating the DOM inside executeJs()'s own call stack, so attaching an
          // observer afterwards would see nothing.
          domActivity = this.trackDomActivity(container);
          // Fallback, used only when no render() promise could be captured (Dataview changed,
          // or a stand-in that never loads a renderer).
          const domQuiescence = this.waitForDomQuiescence(container);
          cancelQuiescence = domQuiescence.cancel;
          await this.dataviewApi.executeJs(code, container, component, filePath);

          await this.awaitRender(renderTracker, domActivity, domQuiescence, filePath);
        } finally {
          cancelQuiescence?.();
          domActivity?.dispose();
          if (shimsAcquired) {
            this.releaseGlobalShims();
          }
        }

        // Force-load all lazy <details> nodes before capturing the DOM for publishing.
        //
        // Views using createLazyDetails() (geo-tree.js) populate content on demand via a
        // "toggle" event listener.  In JSDOM these events are never fired automatically, and
        // on the published static site there is no JS to fire them either.  We simulate the
        // sequence here: open each unloaded node and dispatch a synthetic toggle event so its
        // contentBuilder runs synchronously.  The outer loop repeats because loading a parent
        // node (continent) creates new lazy child nodes (nations, cities) that must also be
        // expanded — we iterate until no new unloaded nodes remain (max 10 passes).
        // Runs on the live container, while the renderers (and their listeners) are still loaded.
        for (let pass = 0; pass < 10; pass++) {
          const unloaded = Array.from(
            container.querySelectorAll<HTMLDetailsElement>('details:not([data-loaded="true"])')
          );
          if (unloaded.length === 0) break;
          for (const el of unloaded) {
            el.open = true;
            el.dispatchEvent(new Event('toggle'));
          }
        }

        snapshot = container.cloneNode(true) as HTMLElement;
      } finally {
        // Discharge every renderer captured above, now that the DOM has been copied, so
        // Obsidian runs each one's unload() and the 'dataview:refresh-views' listener and DOM
        // watcher registered in onload() stop leaking on every republish. Each call is
        // isolated: a renderer whose unload() throws must not stop the others from being
        // discharged. Also runs when execution failed, so a failing view does not leak either.
        this.unloadRenderers(capturedRenderers);
        renderTracker?.dispose();
      }

      // Empty output is valid: the converter detects an empty container and removes the block.
      return {
        success: true,
        container: snapshot,
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
   * Wait for the end of the view's rendering.
   *
   * executeJs() returns before the view has finished: onload() calls render() without awaiting
   * it, and dv.list()/dv.table() do not await the Markdown render. A quiet period on the DOM
   * cannot tell that from "done": the first mutation is an empty reset, so any view slower
   * than the quiet window was captured empty. The tracker waits for the real promises instead,
   * never re-running the script (which duplicated content).
   *
   * Some work starts later and without a promise: Dataview's table and list cells call
   * renderMarkdown() from a Preact effect, scheduled after the next paint (or 100 ms later in a
   * hidden window), and a view may use a timer. A quiet tail on the DOM, counted from the last
   * mutation, covers that; whatever it starts through the tracked APIs is then settled in a
   * further round. Bounded by the safety cap (and a number of rounds) so a view that never
   * finishes cannot hang publishing.
   *
   * Without any captured render() (Dataview changed, no renderer created for this file, or a
   * stand-in), fall back to waiting for the DOM to go quiet.
   *
   * Known limit: work that carries no promise and starts more than the tail after the last DOM
   * mutation is not waited for. The case at hand is a DQL query embedded in a view with
   * dv.execute(): Dataview mounts a ReactRenderer (not bound to `container`, no render()
   * promise to capture) that fills in once the query has run.
   */
  private async awaitRender(
    tracker: RenderTracker | undefined,
    activity: DomActivity,
    quiescence: { done: Promise<void>; cancel: () => void },
    filePath: string
  ): Promise<void> {
    if (!tracker?.renderCaptured) {
      if (!this.hasWarnedRenderNotCaptured) {
        this.hasWarnedRenderNotCaptured = true;
        console.warn(
          '[obsidian-vps-publish] dataview: no renderer render() could be captured ' +
            `(first seen on ${filePath}); falling back to DOM quiescence, so slow views may be ` +
            'published incomplete. Expected when Dataview is disabled for a file; otherwise ' +
            'Dataview may have changed its renderer.'
        );
      }
      await quiescence.done;
      return;
    }

    quiescence.cancel();
    const deadline = Date.now() + this.renderSettleMaxMs;
    for (let round = 0; round < MAX_SETTLE_ROUNDS; round++) {
      const settled = await tracker.settle(Math.max(0, deadline - Date.now()));
      if (!settled) {
        console.warn(
          `[obsidian-vps-publish] dataview view still rendering after ${this.renderSettleMaxMs} ms (${filePath}); capturing it as it is.`
        );
        return;
      }
      // The tail counts against the same safety cap as the rest of the wait.
      await activity.quietFor(
        DOM_TAIL_QUIET_MS,
        Math.min(DOM_TAIL_MAX_MS, Math.max(0, deadline - Date.now()))
      );
      if (!tracker.hasPending) {
        return;
      }
    }
    console.warn(
      `[obsidian-vps-publish] dataview view still starting renders after ${MAX_SETTLE_ROUNDS} settle rounds (${filePath}); capturing it as it is.`
    );
  }

  /**
   * Install the require() / getResourcePath() shims and bypass the stableRender.js cache, for
   * as long as at least one execution is in flight.
   *
   * Legacy DataviewJS views in some vaults still use require("//_assets/..."), which Electron
   * treats as an invalid absolute module path: require() is shimmed so these old-style
   * vault-root imports still resolve. getResourcePath() is shimmed so that views that call
   *   img.src = app.vault.adapter.getResourcePath(vaultRelativePath)
   * produce vault-relative paths in the captured DOM (e.g. "_assets/_icones/Continent.ico")
   * instead of Obsidian-internal app:// URLs. The downstream DetectAssetsService filters the
   * app:// scheme as an external URL, which would silently drop these assets from the upload
   * queue and leave broken images on the published site.
   *
   * stableRender.js stores serialized container.innerHTML in globalThis.__stableRenderCache.
   * If the data hash matches a previous Obsidian session, shouldRender() restores the stale
   * HTML and returns false: the view script exits early without re-rendering. During
   * publishing this produces broken output (cached HTML from an older version of the view is
   * published as-is). The map is cleared on every acquisition so each shouldRender() call is
   * a cache miss and the script always runs in full; the entries present before the first
   * execution are put back by the last one, so Obsidian's own rendering state is unaffected.
   * stableRender.js closes over its internal `cache` reference at module-load time, so the Map
   * must be mutated, not reassigned. Plugin and stableRender.js share the same realm: `window`
   * is the global carrying that cache.
   *
   * Shared state, hence the module-level lease count: the first acquisition installs and
   * records, the last release restores, whichever executor they come from. If installing
   * fails, nothing stays installed and the count is unchanged. The shims are bound to the
   * `app` of the executor that installs them (one app per process in the plugin).
   *
   * The lease lasts for the whole wait for rendering, since a view may call require() or
   * getResourcePath() from a late render; overlapping executions can therefore keep the shims
   * (and the cache bypass) in place for a whole batch, and Obsidian's own UI sees them too:
   * images of an open note resolve to vault-relative paths, and stableRender.js entries
   * written meanwhile are dropped on restore. Accepted trade-off, bounded by the publication:
   * the shims are global by nature (views call the global require and the adapter), the
   * previous per-execution scheme had the same effect for each execution, and publishing is
   * an explicit user action that the user watches. They are restored when the batch ends.
   */
  private acquireGlobalShims(): void {
    const stableRenderCache = (window as unknown as Record<string, unknown>)[
      '__stableRenderCache'
    ] as Map<unknown, unknown> | undefined;

    if (sharedShimLeases === 0) {
      const restoreRequire = this.installVaultRootRequireShim();
      let restoreGetResourcePath: (() => void) | null = null;
      try {
        restoreGetResourcePath = this.installGetResourcePathShim();
      } catch (error) {
        restoreRequire?.();
        throw error;
      }
      const savedCacheEntries = stableRenderCache ? [...stableRenderCache.entries()] : null;
      // Each step is isolated: one that throws must not leave the others undone, the lease
      // being already released by then.
      const attempt = (step: () => void): void => {
        try {
          step();
        } catch (restoreError) {
          console.error('[obsidian-vps-publish] dataview shim restore failed:', restoreError);
        }
      };
      restoreSharedShims = () => {
        attempt(() => restoreRequire?.());
        attempt(() => restoreGetResourcePath?.());
        attempt(() => {
          if (stableRenderCache && savedCacheEntries) {
            stableRenderCache.clear();
            for (const [k, v] of savedCacheEntries) {
              stableRenderCache.set(k, v);
            }
          }
        });
      };
    }

    stableRenderCache?.clear();
    sharedShimLeases++;
  }

  private releaseGlobalShims(): void {
    sharedShimLeases--;
    if (sharedShimLeases === 0) {
      const restore = restoreSharedShims;
      restoreSharedShims = null;
      restore?.();
    }
  }

  /**
   * Start recording the container's DOM mutations. Started before executeJs() so that a view
   * that finishes inside its own synchronous call stack is still accounted for.
   */
  private trackDomActivity(container: HTMLElement): DomActivity {
    let lastMutationAt = Date.now();
    const observer = new MutationObserver(() => {
      lastMutationAt = Date.now();
    });
    observer.observe(container, DOM_OBSERVE_OPTIONS);

    return {
      quietFor: (quietMs: number, maxMs: number): Promise<void> =>
        new Promise<void>((resolve) => {
          const deadline = Date.now() + maxMs;
          const check = (): void => {
            // The observer callback is delivered as a microtask: take its pending records.
            if (observer.takeRecords().length > 0) {
              lastMutationAt = Date.now();
            }
            const now = Date.now();
            const remainingQuietMs = lastMutationAt + quietMs - now;
            if (remainingQuietMs <= 0 || now >= deadline) {
              resolve();
              return;
            }
            window.setTimeout(check, Math.min(remainingQuietMs, deadline - now));
          };
          check();
        }),
      dispose: (): void => observer.disconnect(),
    };
  }

  /**
   * Unload every captured Dataview renderer, each call isolated so one failure cannot skip
   * the others.
   */
  private unloadRenderers(renderers: readonly CapturedRenderer[]): void {
    for (const renderer of renderers) {
      try {
        renderer.unload?.();
      } catch (unloadError) {
        console.error('[obsidian-vps-publish] dataview renderer unload() failed:', unloadError);
      }
    }
  }

  /**
   * Wait until a container's subtree stops changing, instead of guessing a fixed delay.
   *
   * There is no signal for "nothing is going to happen" versus "the script hasn't reached
   * its next mutation yet", so the quiet window only starts counting down once at least one
   * mutation has actually been observed; before that, only `maxWaitMs` can end the wait. That
   * keeps a genuinely empty view no worse than before (it waits out the full cap, same as the
   * old fixed-delay loop did), while a view that does mutate resolves `quietMs` after its last
   * mutation rather than on a fixed schedule.
   */
  private waitForDomQuiescence(
    container: HTMLElement,
    quietMs = 100,
    maxWaitMs = 2000
  ): { done: Promise<void>; cancel: () => void } {
    let cancel: () => void = () => {};
    const done = new Promise<void>((resolve) => {
      let settled = false;
      let quietTimer: ReturnType<Window['setTimeout']> | undefined;

      const finish = (): void => {
        if (settled) return;
        settled = true;
        observer.disconnect();
        window.clearTimeout(quietTimer);
        window.clearTimeout(maxTimer);
        resolve();
      };
      cancel = finish;

      const onMutation = (): void => {
        window.clearTimeout(quietTimer);
        quietTimer = window.setTimeout(finish, quietMs);
      };

      const observer = new MutationObserver(onMutation);
      observer.observe(container, DOM_OBSERVE_OPTIONS);

      const maxTimer = window.setTimeout(finish, maxWaitMs);
    });
    return { done, cancel: () => cancel() };
  }

  private installVaultRootRequireShim(): (() => void) | null {
    // Garde de plateforme d'abord : les modules Node ne sont chargés qu'ici, via
    // window.require, parce qu'ils n'existent pas sur mobile. Le manifest déclare
    // isDesktopOnly, mais la règle obsidianmd/no-nodejs-modules exige la garde
    // explicite — un import statique ne peut, lui, jamais être gardé. import() est
    // écarté : il rendrait cette fonction asynchrone.
    if (!Platform.isDesktop) {
      return null;
    }

    const basePath = this.getVaultBasePath();
    if (!basePath) {
      return null;
    }

    const globalScope = window;

    const originalRequire =
      typeof globalScope.require === 'function'
        ? globalScope.require
        : typeof globalScope.window?.require === 'function'
          ? globalScope.window.require
          : null;

    if (!originalRequire) {
      return null;
    }

    let createRequire: (typeof import('node:module'))['createRequire'];
    let path: typeof import('node:path');
    // A wrapped require() may refuse the `node:` scheme while still serving the bare names.
    const loadBuiltin = (name: 'module' | 'path'): unknown => {
      try {
        return originalRequire(`node:${name}`);
      } catch {
        return originalRequire(name);
      }
    };
    try {
      ({ createRequire } = loadBuiltin('module') as typeof import('node:module'));
      path = loadBuiltin('path') as typeof import('node:path');
    } catch (loadError) {
      console.error(
        '[obsidian-vps-publish] dataview vault-root require shim disabled: node modules unavailable:',
        loadError
      );
      return null;
    }

    // Use Node.js createRequire to load vault files from the filesystem.
    //
    // DO NOT call originalRequire(absolutePath) for vault files: in Obsidian,
    // the global require is wrapped by plugins such as obsidian-codescript-toolkit
    // which reject synchronous loads from absolute filesystem paths ("Cannot require
    // synchronously from URL").  createRequire bypasses those wrappers entirely and
    // uses Node.js's native module loader, which handles absolute paths correctly.
    //
    // We always resolve to an ABSOLUTE path before calling vaultRequire so the result
    // is unambiguous regardless of the process CWD or how createRequire anchors
    // relative paths.  Passing a relative path ('./_assets/...') would be resolved
    // from the anchor file passed to createRequire — which could silently resolve to
    // the wrong directory (e.g. the current note's folder instead of the vault root).
    const vaultRequire = createRequire(path.join(basePath, '_stub_'));

    const wrappedRequire = ((request: string): unknown => {
      if (this.isLegacyVaultRootRequire(request)) {
        const vaultRelativePath = request.replace(/^\/+/, '').replace(/[\\/]+/g, path.sep);
        const absoluteVaultPath = path.join(basePath, vaultRelativePath);
        return vaultRequire(absoluteVaultPath);
      }

      return originalRequire(request);
    }) as RequireLike;

    wrappedRequire.resolve = originalRequire.resolve?.bind(originalRequire);
    wrappedRequire.cache = originalRequire.cache;
    wrappedRequire.main = originalRequire.main;

    const previousGlobalRequire = globalScope.require;
    const previousWindowRequire = globalScope.window?.require;

    globalScope.require = wrappedRequire;
    if (globalScope.window) {
      globalScope.window.require = wrappedRequire;
    }

    // Put the previous value back only where our shim is still the current one: the shims
    // stay installed for a whole batch, so another plugin may have replaced or wrapped
    // require() meanwhile, and that must not be undone.
    return () => {
      if (globalScope.require === wrappedRequire) {
        if (previousGlobalRequire) {
          globalScope.require = previousGlobalRequire;
        } else {
          Reflect.deleteProperty(globalScope, 'require');
        }
      }

      if (globalScope.window && globalScope.window.require === wrappedRequire) {
        if (previousWindowRequire) {
          globalScope.window.require = previousWindowRequire;
        } else {
          Reflect.deleteProperty(globalScope.window, 'require');
        }
      }
    };
  }

  /**
   * Shim app.vault.adapter.getResourcePath() to return the vault-relative path as-is.
   *
   * In Obsidian/Electron, getResourcePath(relativePath) returns an app:// URL that the
   * renderer can load as a local file.  During publishing we capture the DataviewJS DOM as
   * HTML and hand it to DetectAssetsService, which rejects app:// URLs as external.
   * Returning the bare vault-relative path lets the downstream detection pipeline see
   * "_assets/_icones/Continent.ico" in <img src="..."> tags and upload those files.
   *
   * The shim is installed for the duration of the executions in flight and restored afterward.
   */
  private installGetResourcePathShim(): (() => void) | null {
    const adapter = this.app.vault?.adapter as Record<string, unknown> | undefined;
    if (!adapter || typeof adapter['getResourcePath'] !== 'function') {
      return null;
    }

    const original = adapter['getResourcePath'] as (resourcePath: string) => string;
    const shim = (resourcePath: string): string => resourcePath;
    adapter['getResourcePath'] = shim;

    // Only where our shim is still the current one (see installVaultRootRequireShim).
    return () => {
      if (adapter['getResourcePath'] === shim) {
        adapter['getResourcePath'] = original;
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
