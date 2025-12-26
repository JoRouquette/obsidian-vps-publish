import { CancellationError } from '@core-domain';

import { AbortCancellationAdapter } from '../lib/infra/abort-cancellation.adapter';

describe('AbortCancellationAdapter', () => {
  it('should not be cancelled initially', () => {
    const controller = new AbortController();
    const adapter = new AbortCancellationAdapter(controller.signal);

    expect(adapter.isCancelled).toBe(false);
  });

  it('should detect cancellation after abort', () => {
    const controller = new AbortController();
    const adapter = new AbortCancellationAdapter(controller.signal);

    controller.abort();

    expect(adapter.isCancelled).toBe(true);
  });

  it('should throw CancellationError when throwIfCancelled is called after abort', () => {
    const controller = new AbortController();
    const adapter = new AbortCancellationAdapter(controller.signal);

    controller.abort();

    expect(() => adapter.throwIfCancelled()).toThrow(CancellationError);
  });

  it('should invoke callback on cancellation', () => {
    const controller = new AbortController();
    const adapter = new AbortCancellationAdapter(controller.signal);

    const callback = jest.fn();
    adapter.onCancel(callback);

    controller.abort();

    expect(callback).toHaveBeenCalledTimes(1);
  });

  it('should invoke multiple callbacks on cancellation', () => {
    const controller = new AbortController();
    const adapter = new AbortCancellationAdapter(controller.signal);

    const callback1 = jest.fn();
    const callback2 = jest.fn();
    adapter.onCancel(callback1);
    adapter.onCancel(callback2);

    controller.abort();

    expect(callback1).toHaveBeenCalledTimes(1);
    expect(callback2).toHaveBeenCalledTimes(1);
  });

  it('should invoke callback even if already cancelled when registered', () => {
    const controller = new AbortController();
    controller.abort(); // Abort before creating adapter

    const adapter = new AbortCancellationAdapter(controller.signal);
    const callback = jest.fn();

    adapter.onCancel(callback);

    // Callback should be called immediately because signal was already aborted
    expect(callback).toHaveBeenCalledTimes(1);
  });
});
