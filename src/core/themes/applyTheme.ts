import type { SettingsState } from '@/types';
import { accentHex } from './settingsStore';

/** Reflect the settings store into <html> attributes and CSS custom properties. */
export function applyTheme(settings: SettingsState): void {
  const root = document.documentElement;
  root.dataset.theme = settings.theme;
  root.dataset.accent = settings.accent;
  root.dataset.reduceMotion = String(settings.reduceMotion);
  root.dir = settings.language === 'fa' ? 'rtl' : 'ltr';
  root.lang = settings.language === 'fa' ? 'fa' : 'en';

  root.style.setProperty('--accent', accentHex(settings.accent));
  const rgb = hexToRgb(accentHex(settings.accent));
  if (rgb) root.style.setProperty('--accent-rgb', `${rgb.r}, ${rgb.g}, ${rgb.b}`);
  root.style.setProperty('--font-scale', String(settings.fontSize / 100));
  root.style.setProperty('--ui-scale', String(settings.uiScale / 100));
  root.style.setProperty('--window-alpha', String(settings.windowTransparency));
  root.style.setProperty('--panel-alpha', String(settings.panelOpacity));
  root.style.setProperty('--radius-window', `${settings.cornerRadius}px`);
  root.style.setProperty('--radius-lg', `${Math.round(settings.cornerRadius + 4)}px`);
  root.style.setProperty('--radius-md', `${Math.max(6, Math.round(settings.cornerRadius - 2))}px`);
  root.style.setProperty('--brightness', String(settings.brightness / 100));
  document.body.classList.toggle('reduce-motion', settings.reduceMotion);

  const meta = document.querySelector('meta[name="theme-color"]');
  if (meta) meta.setAttribute('content', settings.theme === 'dark' ? '#05080b' : '#e8edf3');
}

function hexToRgb(hex: string): { r: number; g: number; b: number } | null {
  const match = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
  if (!match) return null;
  return {
    r: Number.parseInt(match[1], 16),
    g: Number.parseInt(match[2], 16),
    b: Number.parseInt(match[3], 16),
  };
}

/** Wallpaper catalogue — CSS-only backgrounds keep the bundle tiny. */
export const WALLPAPERS: Array<{ id: string; name: string; description: string; tone: 'dark' | 'light' }> = [
  { id: 'wallpaper-aurora', name: 'Aurora Mint', description: 'Emerald light over deep midnight', tone: 'dark' },
  { id: 'wallpaper-nebula', name: 'Nebula', description: 'Violet clouds and starlight', tone: 'dark' },
  { id: 'wallpaper-ocean', name: 'Deep Ocean', description: 'Teal currents and blue depth', tone: 'dark' },
  { id: 'wallpaper-sunset', name: 'Sunset Ridge', description: 'Warm dusk with rose glow', tone: 'dark' },
  { id: 'wallpaper-graphite', name: 'Graphite', description: 'Neutral, quiet, focused', tone: 'dark' },
  { id: 'wallpaper-forest', name: 'Forest Night', description: 'Cool green undergrowth', tone: 'dark' },
  { id: 'wallpaper-dawn', name: 'Soft Dawn', description: 'Light, airy, made for day mode', tone: 'light' },
];

export function wallpaperClass(id: string): string {
  if (id === 'custom') return 'wallpaper--custom';
  const known = WALLPAPERS.some((item) => item.id === id);
  return known ? `wallpaper--${id.replace('wallpaper-', '')}` : 'wallpaper--aurora';
}
