import { ScrollToTopComponent } from '../presentation/components/scroll-to-top/scroll-to-top.component';

// Mock PLATFORM_ID values - must be objects, not strings
const BROWSER_PLATFORM_ID = { id: 'browser' };
const SERVER_PLATFORM_ID = { id: 'server' };

// Mock isPlatformBrowser
jest.mock('@angular/common', () => ({
  ...jest.requireActual('@angular/common'),
  isPlatformBrowser: (platformId: { id: string }) => platformId.id === 'browser',
}));

// Mock destroy ref
const mockDestroyRef = {
  onDestroy: jest.fn((callback: () => void) => callback),
};

// Factory function outside describe block
function createComponent(platformId: object = BROWSER_PLATFORM_ID): ScrollToTopComponent {
  return new ScrollToTopComponent(platformId, mockDestroyRef as never);
}

// Helper to set up scroll environment
function setupScrollEnvironment(options: {
  scrollY?: number;
  viewportHeight?: number;
  documentHeight?: number;
}): void {
  const { scrollY = 0, viewportHeight = 800, documentHeight = 1000 } = options;

  Object.defineProperty(globalThis, 'scrollY', {
    value: scrollY,
    writable: true,
    configurable: true,
  });

  Object.defineProperty(globalThis, 'innerHeight', {
    value: viewportHeight,
    writable: true,
    configurable: true,
  });

  Object.defineProperty(document.documentElement, 'scrollHeight', {
    value: documentHeight,
    writable: true,
    configurable: true,
  });
}

describe('ScrollToTopComponent', () => {
  let originalScrollY: number;
  let originalScrollTo: typeof globalThis.scrollTo;
  let originalInnerHeight: number;
  let originalQuerySelector: typeof document.querySelector;

  beforeEach(() => {
    originalScrollY = globalThis.scrollY;
    originalScrollTo = globalThis.scrollTo;
    originalInnerHeight = globalThis.innerHeight;
    originalQuerySelector = document.querySelector.bind(document);

    // Mock scrollTo
    globalThis.scrollTo = jest.fn();

    // Mock document.querySelector to return null for .main (tests use window fallback)
    document.querySelector = jest.fn().mockReturnValue(null);

    // Default: small page, no scroll
    setupScrollEnvironment({ scrollY: 0, viewportHeight: 800, documentHeight: 1000 });
  });

  afterEach(() => {
    globalThis.scrollTo = originalScrollTo;
    document.querySelector = originalQuerySelector;
    Object.defineProperty(globalThis, 'scrollY', {
      value: originalScrollY,
      writable: true,
      configurable: true,
    });
    Object.defineProperty(globalThis, 'innerHeight', {
      value: originalInnerHeight,
      writable: true,
      configurable: true,
    });
    jest.clearAllMocks();
  });

  describe('isVisible', () => {
    it('should be hidden when page is not tall enough (content < 2x viewport)', () => {
      // Viewport: 800px, Document: 1000px (< 1600px required)
      setupScrollEnvironment({ scrollY: 400, viewportHeight: 800, documentHeight: 1000 });

      const component = createComponent();
      component.ngAfterViewInit();

      expect(component.isVisible()).toBe(false);
    });

    it('should be hidden when at top of tall page', () => {
      // Tall page but no scroll
      setupScrollEnvironment({ scrollY: 0, viewportHeight: 800, documentHeight: 2000 });

      const component = createComponent();
      component.ngAfterViewInit();

      expect(component.isVisible()).toBe(false);
    });

    it('should be hidden when scroll is below threshold on tall page', () => {
      // Tall page, small scroll (< 300px threshold)
      setupScrollEnvironment({ scrollY: 200, viewportHeight: 800, documentHeight: 2000 });

      const component = createComponent();
      component.ngAfterViewInit();

      expect(component.isVisible()).toBe(false);
    });

    it('should be visible when scrolled on tall page (content >= 2x viewport)', () => {
      // Viewport: 800px, Document: 1600px (exactly 2x), scrolled 400px
      setupScrollEnvironment({ scrollY: 400, viewportHeight: 800, documentHeight: 1600 });

      const component = createComponent();
      component.ngAfterViewInit();

      expect(component.isVisible()).toBe(true);
    });

    it('should be visible on very tall page when scrolled', () => {
      // Viewport: 800px, Document: 3000px (> 2x), scrolled 500px
      setupScrollEnvironment({ scrollY: 500, viewportHeight: 800, documentHeight: 3000 });

      const component = createComponent();
      component.ngAfterViewInit();

      expect(component.isVisible()).toBe(true);
    });
  });

  describe('scrollToTop', () => {
    it('should scroll to top with smooth behavior', () => {
      const component = createComponent();

      component.scrollToTop();

      expect(globalThis.scrollTo).toHaveBeenCalledWith({
        top: 0,
        behavior: 'smooth',
      });
    });

    it('should not scroll on server platform', () => {
      const component = createComponent(SERVER_PLATFORM_ID);

      component.scrollToTop();

      expect(globalThis.scrollTo).not.toHaveBeenCalled();
    });
  });

  describe('SSR safety', () => {
    it('should not call any DOM APIs on server', () => {
      const component = createComponent(SERVER_PLATFORM_ID);

      // Should not throw
      component.ngAfterViewInit();

      expect(component.isVisible()).toBe(false);
    });
  });
});
