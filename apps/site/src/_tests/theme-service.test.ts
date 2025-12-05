import { ThemeService } from '../presentation/services/theme.service';

describe('ThemeService', () => {
  const originalMatch = window.matchMedia;
  const originalSetItem = localStorage.setItem;
  const createMatchMedia = (matches: boolean): MediaQueryList => ({
    matches,
    media: '',
    onchange: null,
    addListener: jest.fn(),
    removeListener: jest.fn(),
    addEventListener: jest.fn(),
    removeEventListener: jest.fn(),
    dispatchEvent: jest.fn(),
  });

  beforeEach(() => {
    document.documentElement.className = '';
    document.documentElement.style.colorScheme = '';
    localStorage.clear();
    const mockMatch = jest
      .fn<(query: string) => MediaQueryList>()
      .mockReturnValue(createMatchMedia(false));
    window.matchMedia = mockMatch;
    localStorage.setItem = jest.fn();
  });

  afterEach(() => {
    window.matchMedia = originalMatch;
    localStorage.setItem = originalSetItem;
  });

  it('initializes theme using saved value', () => {
    localStorage.setItem('theme', 'dark');
    const svc = new ThemeService();
    svc.init();
    expect(document.documentElement.classList.contains('theme-dark')).toBe(true);
    expect(svc.isDark()).toBe(true);
  });

  it('uses prefers-color-scheme when not saved', () => {
    const mockMatch = jest
      .fn<(query: string) => MediaQueryList>()
      .mockReturnValue(createMatchMedia(true));
    window.matchMedia = mockMatch;
    const svc = new ThemeService();
    svc.init();
    expect(svc.isDark()).toBe(true);
  });

  it('toggles theme', () => {
    const svc = new ThemeService();
    svc.init();
    svc.toggle();
    expect(document.documentElement.classList.contains('theme-dark')).toBe(true);
    svc.toggle();
    expect(document.documentElement.classList.contains('theme-light')).toBe(true);
  });
});
