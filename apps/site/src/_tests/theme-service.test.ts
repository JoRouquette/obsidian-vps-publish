import { ThemeService } from '../presentation/services/theme.service';

describe('ThemeService', () => {
  const originalMatch = window.matchMedia;
  const originalSetItem = localStorage.setItem;

  beforeEach(() => {
    document.documentElement.className = '';
    document.documentElement.style.colorScheme = '';
    localStorage.clear();
    window.matchMedia = jest.fn().mockReturnValue({ matches: false }) as any;
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
    window.matchMedia = jest.fn().mockReturnValue({ matches: true }) as any;
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
