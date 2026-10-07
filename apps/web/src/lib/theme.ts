export type Theme = 'light' | 'dark';

export const THEME_KEY = 'traininglah-theme';

export function readStoredTheme(): Theme | null {
  if (typeof window === 'undefined') return null;
  const value = window.localStorage.getItem(THEME_KEY);
  return value === 'light' || value === 'dark' ? value : null;
}

export function systemTheme(): Theme {
  if (typeof window === 'undefined') return 'light';
  return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
}

export function applyTheme(theme: Theme, persist = true) {
  if (typeof document === 'undefined') return;
  document.documentElement.dataset.theme = theme;
  if (persist) window.localStorage.setItem(THEME_KEY, theme);
}

export function resolveTheme(): Theme {
  return readStoredTheme() ?? systemTheme();
}
