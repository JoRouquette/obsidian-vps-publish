// src/presentation/services/theme.service.ts
import { Injectable, signal } from '@angular/core';

const STORAGE_KEY = 'theme';

@Injectable({ providedIn: 'root' })
export class ThemeService {
  private _isDark = signal(false);
  isDark = () => this._isDark();

  init() {
    const saved = localStorage.getItem(STORAGE_KEY) as 'light' | 'dark' | null;
    const preferDark = window.matchMedia?.('(prefers-color-scheme: dark)').matches ?? false;
    this.setTheme(saved ?? (preferDark ? 'dark' : 'light'));
  }

  toggle() {
    this.setTheme(this._isDark() ? 'light' : 'dark');
  }

  private setTheme(mode: 'light' | 'dark') {
    this._isDark.set(mode === 'dark');
    const root = document.documentElement; // <html>
    root.classList.remove('theme-light', 'theme-dark');
    root.classList.add(mode === 'dark' ? 'theme-dark' : 'theme-light');
    root.style.colorScheme = mode;
    localStorage.setItem(STORAGE_KEY, mode);
  }
}
