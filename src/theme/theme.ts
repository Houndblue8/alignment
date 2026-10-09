export const THEME_KEY = 'alignment.theme';
export const DEFAULT_THEME = 'gold-cream';

/** Applies a theme to <html> and remembers it so index.html can apply it before first paint. */
export function applyTheme(theme: string): void {
  document.documentElement.setAttribute('data-theme', theme);
  try {
    localStorage.setItem(THEME_KEY, theme);
  } catch {
    // Private mode: the saved setting still applies after load.
  }
  const color = getComputedStyle(document.documentElement).getPropertyValue('--bg').trim();
  if (color) document.querySelector('meta[name="theme-color"]')?.setAttribute('content', color);
}
