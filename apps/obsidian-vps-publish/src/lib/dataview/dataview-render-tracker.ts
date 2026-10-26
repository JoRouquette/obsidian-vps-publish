/**
 * Dataview render tracker
 *
 * Dataview's executeJs() returns before the script has finished rendering:
 * - the renderer's onload() calls `this.render()` and drops the returned promise;
 * - dv.list()/dv.table()/dv.paragraph() call `MarkdownRenderer.render()` (and the table/task
 *   cells `MarkdownRenderer.renderMarkdown()`) without awaiting it.
 *
 * Watching the DOM for a quiet period cannot tell "finished" from "has not reached its next
 * mutation yet": the first mutation is an empty reset (`container.innerHTML = ""`) and the
 * content may land hundreds of milliseconds later. Instead, this module collects the promises
 * themselves while one execution is in flight, so the executor can await the real end of the
 * work.
 *
 * Coupling to Dataview (0.5.68): the renderer is a Component whose public `container` field
 * is the element handed to executeJs(), and whose onload() calls `render()`. When that no
 * longer holds, `renderCaptured` stays false and the executor falls back to watching the DOM.
 *
 * The hooks are installed while at least one execution is tracked and removed afterwards. A
 * hook that someone else wrapped on top of ours cannot be removed: that layer is retired (it
 * passes calls straight through) and the next execution wraps whatever is there at that time,
 * so tracking survives a foreign wrapper or a foreign overwrite.
 */

import { Component, MarkdownRenderer } from 'obsidian';

interface Tracking {
  readonly container: HTMLElement;
  readonly pending: Promise<unknown>[];
  /** Markdown renders into a detached element of unknown origin (see `attribution`). */
  readonly candidates: { readonly promise: Promise<unknown>; readonly el: Node }[];
  renderCaptured: boolean;
}

type Attribution = 'yes' | 'maybe' | 'no';

type AnyFunction = (...args: unknown[]) => unknown;

interface Hook {
  install(): void;
  tryRestore(): void;
}

/** Number of microtask turns yielded before concluding that no further work was scheduled. */
const MICROTASK_YIELDS = 20;

const active = new Set<Tracking>();
const retiredContainers = new WeakSet<object>();
let hooks: Hook[] | null = null;

function isTracked(tracking: Tracking): boolean {
  return active.has(tracking);
}

/**
 * Whether a Markdown render targeting `el` belongs to the execution tracked in `tracking`.
 *
 * An element inside this container does; one inside another execution's container does not
 * (notes are processed concurrently, and each container is detached from the document). An
 * element attached to the live document is Obsidian's own UI or another plugin. What remains
 * is a detached element of unknown origin (a view may render into a temporary element that it
 * attaches later, or the render may be somebody else's): it is kept as a candidate and counts
 * only once its element shows up in the container.
 */
function attribution(tracking: Tracking, el: unknown): Attribution {
  if (!(el instanceof Node)) {
    return 'no';
  }
  if (tracking.container.contains(el)) {
    return 'yes';
  }
  for (const other of active) {
    if (other !== tracking && other.container.contains(el)) {
      return 'no';
    }
  }
  // A view that outlived its execution (safety cap, failure) may still render into its own,
  // now retired, container: that work is nobody else's. The container is a detached root.
  if (retiredContainers.has(el.getRootNode()) || el.isConnected) {
    return 'no';
  }
  // Detached, of unknown origin: it may be the view rendering into a temporary element that
  // it attaches to its container afterwards, or somebody else's render. Kept as a candidate,
  // and judged again when the tracker looks at what is pending: it counts once its element
  // is in the container, never before.
  return 'maybe';
}

/** Candidates whose element has since been attached to the container become pending work. */
function promoteCandidates(tracking: Tracking): void {
  for (let i = tracking.candidates.length - 1; i >= 0; i--) {
    const candidate = tracking.candidates[i];
    if (candidate && tracking.container.contains(candidate.el)) {
      tracking.pending.push(candidate.promise);
      tracking.candidates.splice(i, 1);
    }
  }
}

function trackInstanceRender(target: Record<string, unknown>, tracking: Tracking): void {
  const originalRender = target['render'];
  if (typeof originalRender !== 'function') {
    return;
  }
  target['render'] = function (this: unknown, ...args: unknown[]): unknown {
    const result = Reflect.apply(originalRender as AnyFunction, this, args);
    if (isTracked(tracking) && result instanceof Promise) {
      tracking.pending.push(result);
      tracking.renderCaptured = true;
    }
    return result;
  };
}

function trackMarkdownPromise(result: unknown, el: unknown): void {
  if (!(result instanceof Promise)) {
    return;
  }
  for (const tracking of active) {
    const verdict = attribution(tracking, el);
    if (verdict === 'yes') {
      tracking.pending.push(result);
    } else if (verdict === 'maybe' && el instanceof Node) {
      tracking.candidates.push({ promise: result, el });
    }
  }
}

/**
 * A hook on `owner[key]`. Each installation gets its own wrapper; a wrapper that is no longer
 * the current one (a foreign wrapper kept it in the chain after we could not remove it) passes
 * calls straight through, so a stale layer never tracks twice.
 */
function createHook(
  owner: Record<string, unknown> | undefined,
  key: string,
  makeWrapper: (original: AnyFunction, isCurrent: () => boolean) => AnyFunction
): Hook {
  let original: unknown;
  let wrapper: AnyFunction | null = null;
  return {
    install(): void {
      if (!owner) {
        return;
      }
      // Still ours and in place: nothing to do.
      if (wrapper && owner[key] === wrapper) {
        return;
      }
      original = owner[key];
      if (typeof original !== 'function') {
        wrapper = null;
        return;
      }
      const installed = makeWrapper(original as AnyFunction, () => wrapper === installed);
      wrapper = installed;
      owner[key] = installed;
    },
    tryRestore(): void {
      if (!wrapper || !owner) {
        return;
      }
      if (owner[key] === wrapper) {
        owner[key] = original;
      }
      // Restored, or shadowed by someone else's value: either way this wrapper is retired and
      // the next installation wraps whatever is there then.
      wrapper = null;
    },
  };
}

function createHooks(): Hook[] {
  const componentPrototype = Component?.prototype as unknown as Record<string, unknown> | undefined;
  const markdownRenderer = MarkdownRenderer as unknown as Record<string, unknown> | undefined;

  return [
    // Dataview's renderer is loaded through Component.load(), which runs onload() and so the
    // fire-and-forget render(). Wrap the instance's render() just before that happens.
    createHook(
      componentPrototype,
      'load',
      (originalLoad, isCurrent) =>
        function (this: unknown, ...args: unknown[]): unknown {
          const target = this as Record<string, unknown> | null;
          if (isCurrent() && target && typeof target === 'object') {
            for (const tracking of active) {
              if (target['container'] === tracking.container) {
                trackInstanceRender(target, tracking);
                break;
              }
            }
          }
          return Reflect.apply(originalLoad, this, args);
        }
    ),
    // render(app, markdown, el, sourcePath, component)
    createHook(
      markdownRenderer,
      'render',
      (originalRender, isCurrent) =>
        function (this: unknown, ...args: unknown[]): unknown {
          const result = Reflect.apply(originalRender, this, args);
          if (isCurrent()) {
            trackMarkdownPromise(result, args[2]);
          }
          return result;
        }
    ),
    // Deprecated renderMarkdown(markdown, el, sourcePath, component), still used by Dataview's
    // table and task cells.
    createHook(
      markdownRenderer,
      'renderMarkdown',
      (originalRenderMarkdown, isCurrent) =>
        function (this: unknown, ...args: unknown[]): unknown {
          const result = Reflect.apply(originalRenderMarkdown, this, args);
          if (isCurrent()) {
            trackMarkdownPromise(result, args[1]);
          }
          return result;
        }
    ),
  ];
}

async function yieldMicrotasks(): Promise<void> {
  for (let i = 0; i < MICROTASK_YIELDS; i++) {
    await Promise.resolve();
  }
}

function settledWithin(promises: Promise<unknown>[], timeoutMs: number): Promise<boolean> {
  return new Promise((resolve) => {
    const timer = window.setTimeout(() => resolve(false), timeoutMs);
    void Promise.allSettled(promises).then(() => {
      window.clearTimeout(timer);
      resolve(true);
    });
  });
}

/** Number of executions being tracked right now (introspection, used by the tests). */
export function activeRenderTrackerCount(): number {
  return active.size;
}

/**
 * Handle on the renders started while one DataviewJS execution is in flight.
 */
export class RenderTracker {
  private readonly tracking: Tracking;
  private disposed = false;

  constructor(container: HTMLElement) {
    this.tracking = { container, pending: [], candidates: [], renderCaptured: false };
    hooks ??= createHooks();
    try {
      for (const hook of hooks) {
        hook.install();
      }
    } catch (error) {
      // Nothing was registered yet: leave no trace of a tracker that cannot work.
      this.releaseHooks();
      throw error;
    }
    active.add(this.tracking);
  }

  /**
   * True once a renderer bound to the container has had its render() promise captured. When it
   * stays false (Dataview changed, or a stand-in that never loads a renderer), the caller must
   * fall back to another way of detecting the end of rendering.
   */
  get renderCaptured(): boolean {
    return this.tracking.renderCaptured;
  }

  /** True while a captured render() or Markdown render has not been waited for yet. */
  get hasPending(): boolean {
    promoteCandidates(this.tracking);
    return this.tracking.pending.length > 0;
  }

  /**
   * Wait until every captured render() and Markdown render has settled, including the ones
   * started by the work being awaited. Resolves false when `maxWaitMs` elapsed first.
   */
  async settle(maxWaitMs: number): Promise<boolean> {
    const deadline = Date.now() + maxWaitMs;
    for (;;) {
      await yieldMicrotasks();
      promoteCandidates(this.tracking);
      const batch = this.tracking.pending.splice(0);
      if (batch.length === 0) {
        return true;
      }
      const remainingMs = deadline - Date.now();
      if (remainingMs <= 0 || !(await settledWithin(batch, remainingMs))) {
        return false;
      }
    }
  }

  /** Stop tracking and remove the hooks when no other execution is tracked. */
  dispose(): void {
    if (this.disposed) {
      return;
    }
    this.disposed = true;
    active.delete(this.tracking);
    retiredContainers.add(this.tracking.container);
    this.releaseHooks();
  }

  private releaseHooks(): void {
    if (active.size > 0 || !hooks) {
      return;
    }
    for (const hook of hooks) {
      hook.tryRestore();
    }
  }
}
