/**
 * @jest-environment jsdom
 */

import { MarkdownRenderer } from 'obsidian';

import { RenderTracker } from '../lib/dataview/dataview-render-tracker';

describe('RenderTracker attribution of a render into an element moved into the container later', () => {
  const sleep = (ms: number): Promise<void> => new Promise((resolve) => setTimeout(resolve, ms));
  const trackers: RenderTracker[] = [];
  let render: jest.SpyInstance;

  const track = (container: HTMLElement): RenderTracker => {
    const tracker = new RenderTracker(container);
    trackers.push(tracker);
    return tracker;
  };
  const renderInto = (el: HTMLElement): void => {
    void MarkdownRenderer.render(null as never, 'x', el, '', null as never);
  };

  beforeEach(() => {
    render = jest.spyOn(MarkdownRenderer, 'render').mockImplementation(async () => {
      await sleep(300);
    });
  });

  afterEach(() => {
    for (const tracker of trackers.splice(0)) {
      tracker.dispose();
    }
    document.body.replaceChildren();
    jest.restoreAllMocks();
  });

  it('excludes for good an element connected to the live document, even if the view moves it into the container', async () => {
    const container = document.createElement('div');
    const tracker = track(container);
    const el = document.body.appendChild(document.createElement('div'));

    renderInto(el);
    container.appendChild(el);

    // Positive control: the render did happen, and the element is now in the container.
    expect(render).toHaveBeenCalledTimes(1);
    expect(container.contains(el)).toBe(true);
    expect(tracker.hasPending).toBe(false);
    expect(await tracker.settle(50)).toBe(true);
  });

  it('excludes for good an element of a retired container, even if the view moves it into the container', async () => {
    const retired = document.createElement('div');
    track(retired).dispose();
    const el = retired.appendChild(document.createElement('div'));
    const container = document.createElement('div');
    const tracker = track(container);

    renderInto(el);
    container.appendChild(el);

    // Positive control: the render did happen, the element is detached and now in the container.
    expect(render).toHaveBeenCalledTimes(1);
    expect(el.isConnected).toBe(false);
    expect(container.contains(el)).toBe(true);
    expect(tracker.hasPending).toBe(false);
    expect(await tracker.settle(50)).toBe(true);
  });

  it('still waits for a detached element moved into the container later', async () => {
    const container = document.createElement('div');
    const tracker = track(container);
    const el = document.createElement('div');

    renderInto(el);
    expect(tracker.hasPending).toBe(false);
    container.appendChild(el);

    expect(render).toHaveBeenCalledTimes(1);
    expect(tracker.hasPending).toBe(true);
    expect(await tracker.settle(50)).toBe(false);
  });
});
