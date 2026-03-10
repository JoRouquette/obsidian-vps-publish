import { ViewportScroller } from '@angular/common';
import { NgZone } from '@angular/core';
import { fakeAsync, flush, tick } from '@angular/core/testing';
import { NavigationEnd, Router } from '@angular/router';
import { Subject } from 'rxjs';

import { AnchorScrollService } from '../presentation/services/anchor-scroll.service';

// Mock PLATFORM_ID values - must be objects, not strings
const BROWSER_PLATFORM_ID = { id: 'browser' };
const SERVER_PLATFORM_ID = { id: 'server' };

// Helper to check platform in mock context
jest.mock('@angular/common', () => ({
  ...jest.requireActual('@angular/common'),
  isPlatformBrowser: (platformId: { id: string }) => platformId.id === 'browser',
}));

describe('AnchorScrollService', () => {
  let routerEvents$: Subject<NavigationEnd>;
  let mockRouter: Partial<Router>;
  let mockViewportScroller: Partial<ViewportScroller>;
  let mockNgZone: Partial<NgZone>;
  let mockDestroyRef: { onDestroy: jest.Mock };

  beforeEach(() => {
    routerEvents$ = new Subject<NavigationEnd>();
    mockRouter = {
      events: routerEvents$.asObservable(),
    } as Partial<Router>;

    mockViewportScroller = {
      scrollToAnchor: jest.fn(),
    };

    mockNgZone = {
      runOutsideAngular: jest.fn((fn: () => unknown) => fn()) as NgZone['runOutsideAngular'],
    };

    mockDestroyRef = {
      onDestroy: jest.fn((callback: () => void) => callback),
    };

    // Reset document state
    document.body.innerHTML = '';

    // Mock globalThis.location
    Object.defineProperty(globalThis, 'location', {
      value: {
        pathname: '/current-page',
        search: '',
        hash: '',
      },
      writable: true,
      configurable: true,
    });

    // Mock globalThis.history
    Object.defineProperty(globalThis, 'history', {
      value: {
        pushState: jest.fn(),
      },
      writable: true,
      configurable: true,
    });
  });

  afterEach(() => {
    routerEvents$.complete();
    jest.clearAllMocks();
  });

  function createService(platformId: object = BROWSER_PLATFORM_ID): AnchorScrollService {
    return new AnchorScrollService(
      platformId,
      mockRouter as Router,
      mockViewportScroller as ViewportScroller,
      mockNgZone as NgZone,
      mockDestroyRef as never
    );
  }

  describe('scrollToAnchor', () => {
    it('should scroll to element when element exists immediately', async () => {
      // Create target element
      const targetEl = document.createElement('div');
      targetEl.id = 'test-section';
      targetEl.scrollIntoView = jest.fn();
      document.body.appendChild(targetEl);

      const service = createService();

      const result = await service.scrollToAnchor('test-section');

      expect(result).toBe(true);
      expect(targetEl.scrollIntoView).toHaveBeenCalledWith({
        behavior: 'smooth',
        block: 'start',
      });
    });

    it('should return false immediately on SSR (server platform)', async () => {
      const service = createService(SERVER_PLATFORM_ID);

      const result = await service.scrollToAnchor('test-section');

      expect(result).toBe(false);
    });

    it('should return false for empty fragmentId', async () => {
      const service = createService();

      const result = await service.scrollToAnchor('');

      expect(result).toBe(false);
    });

    it('should wait for element using MutationObserver when element not immediately available', async () => {
      const service = createService();

      // Start scroll attempt (element doesn't exist yet)
      const scrollPromise = service.scrollToAnchor('delayed-section', { timeout: 500 });

      // Add element after small delay
      await new Promise((resolve) => setTimeout(resolve, 50));
      const targetEl = document.createElement('div');
      targetEl.id = 'delayed-section';
      targetEl.scrollIntoView = jest.fn();
      document.body.appendChild(targetEl);

      const result = await scrollPromise;

      expect(result).toBe(true);
      expect(targetEl.scrollIntoView).toHaveBeenCalled();
    });

    it('should respect custom scroll options', async () => {
      const targetEl = document.createElement('div');
      targetEl.id = 'test-section';
      targetEl.scrollIntoView = jest.fn();
      document.body.appendChild(targetEl);

      const service = createService();

      await service.scrollToAnchor('test-section', {
        behavior: 'auto',
        block: 'center',
      });

      expect(targetEl.scrollIntoView).toHaveBeenCalledWith({
        behavior: 'auto',
        block: 'center',
      });
    });

    it('should timeout and return false when element never appears', async () => {
      const service = createService();

      const result = await service.scrollToAnchor('non-existent', { timeout: 100 });

      expect(result).toBe(false);
    });
  });

  describe('navigateToAnchor', () => {
    it('should update URL and scroll to element', async () => {
      const targetEl = document.createElement('div');
      targetEl.id = 'nav-section';
      targetEl.scrollIntoView = jest.fn();
      document.body.appendChild(targetEl);

      const service = createService();

      const result = await service.navigateToAnchor('nav-section');

      expect(result).toBe(true);
      expect(globalThis.history.pushState).toHaveBeenCalledWith(
        null,
        '',
        '/current-page#nav-section'
      );
      expect(targetEl.scrollIntoView).toHaveBeenCalled();
    });

    it('should return false on SSR', async () => {
      const service = createService(SERVER_PLATFORM_ID);

      const result = await service.navigateToAnchor('nav-section');

      expect(result).toBe(false);
      expect(globalThis.history.pushState).not.toHaveBeenCalled();
    });
  });

  describe('isCurrentPageLink', () => {
    beforeEach(() => {
      Object.defineProperty(globalThis, 'location', {
        value: {
          pathname: '/my-page',
          search: '',
          hash: '',
        },
        writable: true,
        configurable: true,
      });
    });

    it('should return true for fragment-only links', () => {
      const service = createService();

      expect(service.isCurrentPageLink('#section')).toBe(true);
      expect(service.isCurrentPageLink('#another-section')).toBe(true);
    });

    it('should return true for same page with fragment', () => {
      const service = createService();

      expect(service.isCurrentPageLink('/my-page#section')).toBe(true);
      expect(service.isCurrentPageLink('/my-page/#section')).toBe(true);
    });

    it('should return false for different page links', () => {
      const service = createService();

      expect(service.isCurrentPageLink('/other-page')).toBe(false);
      expect(service.isCurrentPageLink('/other-page#section')).toBe(false);
    });

    it('should return false on SSR', () => {
      const service = createService(SERVER_PLATFORM_ID);

      expect(service.isCurrentPageLink('#section')).toBe(false);
    });

    it('should return false for empty href', () => {
      const service = createService();

      expect(service.isCurrentPageLink('')).toBe(false);
    });

    it('should handle root path correctly', () => {
      Object.defineProperty(globalThis, 'location', {
        value: { pathname: '/', search: '', hash: '' },
        writable: true,
        configurable: true,
      });

      const service = createService();

      expect(service.isCurrentPageLink('/#section')).toBe(true);
      expect(service.isCurrentPageLink('#section')).toBe(true);
      expect(service.isCurrentPageLink('/other#section')).toBe(false);
    });
  });

  describe('router integration', () => {
    it('should scroll to fragment on NavigationEnd event', fakeAsync(() => {
      const targetEl = document.createElement('div');
      targetEl.id = 'router-section';
      targetEl.scrollIntoView = jest.fn();
      document.body.appendChild(targetEl);

      createService(); // Constructor sets up subscription

      // Simulate router navigation with fragment
      routerEvents$.next(new NavigationEnd(1, '/page#router-section', '/page#router-section'));

      tick(100);
      flush();

      expect(targetEl.scrollIntoView).toHaveBeenCalled();
    }));

    it('should not scroll when NavigationEnd has no fragment', fakeAsync(() => {
      const targetEl = document.createElement('div');
      targetEl.id = 'router-section';
      targetEl.scrollIntoView = jest.fn();
      document.body.appendChild(targetEl);

      createService();

      routerEvents$.next(new NavigationEnd(1, '/page', '/page'));

      tick(100);
      flush();

      expect(targetEl.scrollIntoView).not.toHaveBeenCalled();
    }));

    it('should not set up router subscription on SSR', () => {
      createService(SERVER_PLATFORM_ID);

      // Emit event - should not cause any errors or calls
      routerEvents$.next(new NavigationEnd(1, '/page#section', '/page#section'));

      // No assertions needed - test passes if no errors thrown
    });
  });
});
