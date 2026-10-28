import { clearIntervalSafe, setIntervalSafe, setTimeoutSafe } from '../utils/timers.util';

interface WindowTimersStub {
  setTimeout: jest.Mock;
  setInterval: jest.Mock;
  clearInterval: jest.Mock;
}

const setWindow = (stub: WindowTimersStub): void => {
  Object.defineProperty(globalThis, 'window', { value: stub, configurable: true, writable: true });
};

describe('timers.util', () => {
  beforeEach(() => {
    // The mirror jest setup aliases window on globalThis: start every test without it.
    Reflect.deleteProperty(globalThis, 'window');
  });

  afterEach(() => {
    Reflect.deleteProperty(globalThis, 'window');
    jest.useRealTimers();
    jest.restoreAllMocks();
  });

  describe('without window', () => {
    it('does not throw a ReferenceError and runs the timeout callback', () => {
      jest.useFakeTimers();
      expect(typeof window).toBe('undefined');
      const callback = jest.fn();

      expect(() => setTimeoutSafe(callback, 10)).not.toThrow();
      jest.advanceTimersByTime(10);

      expect(callback).toHaveBeenCalledTimes(1);
    });

    it('runs an interval repeatedly until it is cleared', () => {
      jest.useFakeTimers();
      const callback = jest.fn();

      const handle = setIntervalSafe(callback, 5);
      jest.advanceTimersByTime(15);
      clearIntervalSafe(handle);
      jest.advanceTimersByTime(15);

      expect(callback).toHaveBeenCalledTimes(3);
    });
  });

  describe('with window', () => {
    const createStub = (): WindowTimersStub => ({
      setTimeout: jest.fn().mockReturnValue(1),
      setInterval: jest.fn().mockReturnValue(2),
      clearInterval: jest.fn(),
    });

    it('uses window.setTimeout and not the global one', () => {
      const stub = createStub();
      setWindow(stub);
      const globalSpy = jest.spyOn(globalThis, 'setTimeout');
      const callback = jest.fn();

      const handle = setTimeoutSafe(callback, 42);

      expect(stub.setTimeout).toHaveBeenCalledWith(callback, 42);
      expect(globalSpy).not.toHaveBeenCalled();
      expect(handle).toBe(1);
    });

    it('uses window.setInterval and window.clearInterval and not the global ones', () => {
      const stub = createStub();
      setWindow(stub);
      const setSpy = jest.spyOn(globalThis, 'setInterval');
      const clearSpy = jest.spyOn(globalThis, 'clearInterval');
      const callback = jest.fn();

      const handle = setIntervalSafe(callback, 7);
      clearIntervalSafe(handle);

      expect(stub.setInterval).toHaveBeenCalledWith(callback, 7);
      expect(stub.clearInterval).toHaveBeenCalledWith(2);
      expect(setSpy).not.toHaveBeenCalled();
      expect(clearSpy).not.toHaveBeenCalled();
    });

    it('clears a host handle with the host clearInterval, not window.clearInterval', () => {
      jest.useFakeTimers();
      const callback = jest.fn();
      const hostHandle = setIntervalSafe(callback, 5);
      const stub = createStub();
      setWindow(stub);

      clearIntervalSafe(hostHandle);

      expect(stub.clearInterval).not.toHaveBeenCalled();
      jest.advanceTimersByTime(20);
      expect(callback).not.toHaveBeenCalled();
    });

    it('detects window at each call, not at import', () => {
      jest.useFakeTimers();
      const callback = jest.fn();
      setTimeoutSafe(callback, 1);
      jest.advanceTimersByTime(1);
      expect(callback).toHaveBeenCalledTimes(1);

      const stub = createStub();
      setWindow(stub);
      setTimeoutSafe(callback, 1);

      expect(stub.setTimeout).toHaveBeenCalledTimes(1);
    });
  });
});
