import type { SettingsState } from '@/types';
import { accentHex } from './settingsStore';
import kaliWallpaper from '@/assets/wallpapers/kali.jpg';
import kaliWallpaperThumb from '@/assets/wallpapers/kali-thumb.jpg';

/** Reflect the settings store into <html> attributes and CSS custom properties. */
export function applyTheme(settings: SettingsState): void {
  const root = document.documentElement;
  root.dataset.theme = settings.theme;
  root.dataset.accent = settings.accent;
  root.dataset.reduceMotion = String(settings.reduceMotion);
  root.dir = settings.language === 'fa' ? 'rtl' : 'ltr';
  root.lang = settings.language === 'fa' ? 'fa' : 'en';

  root.style.setProperty('--font-scale', String(settings.fontSize / 100));
  root.style.setProperty('--ui-scale', String(settings.uiScale / 100));
  root.style.setProperty('--window-alpha', String(settings.windowTransparency));
  root.style.setProperty('--panel-alpha', String(settings.panelOpacity));
  root.style.setProperty('--radius-window', `${settings.cornerRadius}px`);
  root.style.setProperty('--radius-lg', `${Math.round(settings.cornerRadius + 4)}px`);
  root.style.setProperty('--radius-md', `${Math.max(6, Math.round(settings.cornerRadius - 2))}px`);
  root.style.setProperty('--brightness', String(settings.brightness / 100));
  document.body.classList.toggle('reduce-motion', settings.reduceMotion);
  document.body.classList.toggle('high-contrast', settings.highContrast);

  // Custom accent (theme studio) wins over the preset palette but keeps the
  // derived rgb triplet in sync so translucent surfaces follow along.
  const custom = settings.customAccent?.trim();
  if (custom && /^#[0-9a-f]{6}$/i.test(custom)) {
    root.style.setProperty('--accent', custom);
    const customRgb = hexToRgb(custom);
    if (customRgb) root.style.setProperty('--accent-rgb', `${customRgb.r}, ${customRgb.g}, ${customRgb.b}`);
    root.dataset.customAccent = 'true';
  } else {
    root.removeAttribute('data-custom-accent');
    root.style.setProperty('--accent', accentHex(settings.accent));
    const rgb = hexToRgb(accentHex(settings.accent));
    if (rgb) root.style.setProperty('--accent-rgb', `${rgb.r}, ${rgb.g}, ${rgb.b}`);
  }

  const meta = document.querySelector('meta[name="theme-color"]');
  const themeColor = settings.theme === 'light' ? '#e8edf3' : settings.theme === 'kali' ? '#04060b' : '#05080b';
  if (meta) meta.setAttribute('content', themeColor);
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
  { id: 'wallpaper-kali', name: 'Kali Dragon', description: 'Neon dragon over a deep navy mesh', tone: 'dark' },
  { id: 'wallpaper-aurora', name: 'Aurora Mint', description: 'Emerald light over deep midnight', tone: 'dark' },
  { id: 'wallpaper-nebula', name: 'Nebula', description: 'Violet clouds and starlight', tone: 'dark' },
  { id: 'wallpaper-ocean', name: 'Deep Ocean', description: 'Teal currents and blue depth', tone: 'dark' },
  { id: 'wallpaper-sunset', name: 'Sunset Ridge', description: 'Warm dusk with rose glow', tone: 'dark' },
  { id: 'wallpaper-graphite', name: 'Graphite', description: 'Neutral, quiet, focused', tone: 'dark' },
  { id: 'wallpaper-forest', name: 'Forest Night', description: 'Cool green undergrowth', tone: 'dark' },
  { id: 'wallpaper-dawn', name: 'Soft Dawn', description: 'Light, airy, made for day mode', tone: 'light' },
  { id: 'wallpaper-ember', name: 'Ember', description: 'Warm coals under a dark sky', tone: 'dark' },
  { id: 'wallpaper-glass', name: 'Midnight Glass', description: 'Cool graphite with a light sweep', tone: 'dark' },
];

export function wallpaperClass(id: string): string {
  if (id === 'custom') return 'wallpaper--custom';
  const known = WALLPAPERS.some((item) => item.id === id);
  return known ? `wallpaper--${id.replace('wallpaper-', '')}` : 'wallpaper--aurora';
}

/**
 * Wallpapers that ship as real images rather than pure CSS gradients.
 *
 * The file is imported through Vite, so its URL is hashed and already carries
 * the deployment base — the same code works at a GitHub Pages sub-path.
 */
export const WALLPAPER_IMAGES: Record<string, string> = {
  'wallpaper-kali': kaliWallpaper,
};

export const WALLPAPER_THUMBS: Record<string, string> = {
  'wallpaper-kali': kaliWallpaperThumb,
};

export function wallpaperImage(id: string): string | undefined {
  return WALLPAPER_IMAGES[id];
}
