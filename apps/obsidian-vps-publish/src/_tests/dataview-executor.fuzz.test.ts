/**
 * @jest-environment jsdom
 */

/**
 * Seeded randomized scenarios against a Dataview-like renderer (same contract as Dataview
 * 0.5.68: onload() calls an unawaited render(); Markdown renders are fire-and-forget).
 *
 * Property: whatever the timings, every piece of content the view produces, however late and
 * through whichever path, is in the captured block, no safety-cap warning fires, and the
 * module-level state is back to rest. Seeds are fixed so a failure is reproducible; set
 * DV_FUZZ_SEED to explore another range.
 */

import { type Component, Component as ObsidianComponent, MarkdownRenderer } from 'obsidian';

import {
  activeShimLeaseCount,
  type DataviewApi,
  DataviewExecutor,
} from '../lib/dataview/dataview-executor';
import { activeRenderTrackerCount } from '../lib/dataview/dataview-render-tracker';

const sleep = (ms: number): Promise<void> => new Promise((resolve) => setTimeout(resolve, ms));

function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

class FakeDataviewRenderer extends ObsidianComponent {
  constructor(
    readonly container: HTMLElement,
    private readonly script: (container: HTMLElement) => Promise<void>
  ) {
    super();
  }
  onload(): void {
    void this.render();
  }
  async render(): Promise<void> {
    const marker = document.createElement('i');
    this.container.appendChild(marker);
    marker.remove();
    try {
      await this.script(this.container);
    } catch (error) {
      const pre = document.createElement('pre');
      pre.textContent = String(error);
      this.container.appendChild(pre);
    }
  }
}

const jsBlock = {
  kind: 'js' as const,
  contentRaw: 'fuzz',
  langRaw: 'dataviewjs',
  startIndex: 0,
  endIndex: 0,
  startLine: 1,
  endLine: 1,
};

interface Scenario {
  readonly id: string;
  readonly expected: string[];
  readonly script: (container: HTMLElement) => Promise<void>;
}

function buildScenario(seed: number, label: string): Scenario {
  const rnd = mulberry32(seed);
  const int = (min: number, max: number): number => min + Math.floor(rnd() * (max - min + 1));
  const expected: string[] = [];
  const steps = int(1, 4);
  const plan: { wait: number; kind: number; delay: number; token: string }[] = [];
  for (let i = 0; i < steps; i++) {
    const token = `${label}-${seed}-${i}`;
    expected.push(token);
    plan.push({ wait: int(0, 250), kind: int(0, 4), delay: int(0, 250), token });
  }
  const script = async (container: HTMLElement): Promise<void> => {
    for (const step of plan) {
      await sleep(step.wait);
      const el = container.appendChild(document.createElement('span'));
      switch (step.kind) {
        case 0: // plain DOM content
          el.textContent = step.token;
          break;
        case 1: // fire-and-forget MarkdownRenderer.render into an attached element
          void MarkdownRenderer.render(
            null as never,
            `${step.token}|${step.delay}`,
            el,
            '',
            null as never
          );
          break;
        case 2: // deprecated renderMarkdown, as dv.table cells use
          void (
            MarkdownRenderer as unknown as {
              renderMarkdown: (m: string, e: HTMLElement) => Promise<void>;
            }
          ).renderMarkdown(`${step.token}|${step.delay}`, el);
          break;
        case 3: {
          // Preact-style effect: the render starts from a timer after the mount
          window.setTimeout(() => {
            void MarkdownRenderer.render(
              null as never,
              `${step.token}|${step.delay}`,
              el,
              '',
              null as never
            );
          }, 100);
          // keep the view alive until the timer fired so it is not the view's own wait
          break;
        }
        default: {
          // temporary detached element, attached while it renders
          const tmp = document.createElement('span');
          el.remove();
          void MarkdownRenderer.render(
            null as never,
            `${step.token}|${step.delay}`,
            tmp,
            '',
            null as never
          );
          await sleep(10);
          container.appendChild(tmp);
        }
      }
    }
  };
  return { id: `${label}-${seed}`, expected, script };
}

describe('DataviewExecutor fuzz (seeded)', () => {
  beforeEach(() => {
    jest.spyOn(ObsidianComponent.prototype, 'load').mockImplementation(function (
      this: ObsidianComponent
    ) {
      this.onload();
    });
    const renderLike = async (markdown: string, el: HTMLElement): Promise<void> => {
      const delay = Number(markdown.split('|')[1] ?? 0);
      await sleep(delay);
      el.textContent = markdown.split('|')[0] ?? '';
    };
    jest
      .spyOn(MarkdownRenderer, 'render')
      .mockImplementation(async (_app, markdown, el: HTMLElement) => renderLike(markdown, el));
    (MarkdownRenderer as unknown as Record<string, unknown>)['renderMarkdown'] ??= () => undefined;
    jest
      .spyOn(
        MarkdownRenderer as unknown as {
          renderMarkdown: (m: string, e: HTMLElement) => Promise<void>;
        },
        'renderMarkdown'
      )
      .mockImplementation(async (markdown: string, el: HTMLElement) => renderLike(markdown, el));
  });

  afterEach(() => {
    jest.restoreAllMocks();
    expect(activeShimLeaseCount()).toBe(0);
    expect(activeRenderTrackerCount()).toBe(0);
  });

  const base = Number(process.env['DV_FUZZ_SEED'] ?? 1000);
  const BATCHES = 12;
  const CONCURRENCY = 4;

  it(`keeps all late content, alone or concurrent (${BATCHES * CONCURRENCY} scenarios from seed ${base})`, async () => {
    const warn = jest.spyOn(console, 'warn').mockImplementation(() => {});
    const failures: string[] = [];

    for (let b = 0; b < BATCHES; b++) {
      const scenarios = Array.from({ length: b % 3 === 0 ? 1 : CONCURRENCY }, (_, i) =>
        buildScenario(base + b * 10 + i, `b${b}s${i}`)
      );
      const api: DataviewApi = {
        query: jest.fn(),
        executeJs: jest.fn(async (code: string, container: HTMLElement, component: Component) => {
          const scenario = scenarios.find((s) => s.id === code);
          const renderer = new FakeDataviewRenderer(container, scenario!.script);
          renderer.load();
          component.addChild(renderer as unknown as Component);
        }),
      };
      const executor = new DataviewExecutor(api, { workspace: { getActiveFile: () => null } });
      const results = await Promise.all(
        scenarios.map((s) => executor.executeBlock({ ...jsBlock, contentRaw: s.id }, `${s.id}.md`))
      );
      results.forEach((result, i) => {
        const scenario = scenarios[i]!;
        const container =
          result && typeof result === 'object' && 'container' in result
            ? (result as { container: HTMLElement }).container
            : null;
        const text = container?.textContent ?? '';
        const missing = scenario.expected.filter((token) => !text.includes(token));
        if (!container || missing.length > 0) {
          failures.push(`${scenario.id}: missing ${missing.join(',')}`);
        }
      });
    }

    expect(failures).toEqual([]);
    expect(warn).not.toHaveBeenCalledWith(expect.stringContaining('still'));
  }, 180000);
});
