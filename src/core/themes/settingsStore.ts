import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import type { SettingsState } from '@/types';

export const DEFAULT_WALLPAPER = 'wallpaper-kali';

export const DEFAULT_SETTINGS: SettingsState = {
  language: 'en',
  theme: 'kali',
  accent: 'blue',
  customAccent: null,
  wallpaper: DEFAULT_WALLPAPER,
  customWallpaper: null,
  brightness: 100,
  volume: 62,
  panelPosition: 'bottom',
  panelOpacity: 0.82,
  panelSize: 'normal',
  panelAutoHide: false,
  reduceMotion: false,
  sounds: true,
  highContrast: false,
  screensaverMinutes: 0,
  uiScale: 100,
  fontSize: 100,
  cornerRadius: 14,
  windowTransparency: 0.96,
  showSeconds: false,
  clock24h: true,
  wifi: true,
  bluetooth: false,
  dnd: false,
  skipBoot: false,
  notificationsEnabled: true,
  keyboardLayout: 'us',
  virtualResolution: 'auto',
  dockShowLabels: false,
  restoreWindows: true,
  crossTabSync: true,
  wallpaperDim: 0,
  wallpaperBlur: 0,
};

interface SettingsStore extends SettingsState {
  set: <K extends keyof SettingsState>(key: K, value: SettingsState[K]) => void;
  patch: (values: Partial<SettingsState>) => void;
  reset: () => void;
}

/**
 * UI preferences are intentionally kept in localStorage (small + synchronous).
 * Documents, notes, accounting data etc. live in IndexedDB instead.
 */
export const useSettings = create<SettingsStore>()(
  persist(
    (set) => ({
      ...DEFAULT_SETTINGS,
      set: (key, value) => set({ [key]: value } as Partial<SettingsStore>),
      patch: (values) => set(values as Partial<SettingsStore>),
      reset: () => set({ ...DEFAULT_SETTINGS }),
    }),
    {
      name: 'nova-linux.settings.v1',
      storage: createJSONStorage(() => localStorage),
      version: 3,
      partialize: (state) => {
        const { set: _set, patch: _patch, reset: _reset, ...rest } = state;
        return rest;
      },
      migrate: (persisted, version) => {
        const saved = (persisted ?? {}) as Partial<SettingsState>;
        if (version < 1) return { ...DEFAULT_SETTINGS, ...saved } as SettingsStore;
        if (version < 3) {
          // v3 is the Kali-inspired skin. Profiles that never customised their
          // look move to the new defaults (Kali theme, blue accent, dragon
          // wallpaper); anyone who deliberately picked one of the older presets
          // keeps it, because only the *previous defaults* are rewritten.
          const wallpaper =
            !saved.wallpaper || saved.wallpaper === 'wallpaper-aurora' ? 'wallpaper-kali' : saved.wallpaper;
          const accent = !saved.accent || saved.accent === 'mint' ? 'blue' : saved.accent;
          const theme = !saved.theme || saved.theme === 'dark' ? 'kali' : saved.theme;
          return { ...DEFAULT_SETTINGS, ...saved, theme, accent, wallpaper } as SettingsStore;
        }
        // v2 added session restore, cross-tab sync and wallpaper dim/blur.
        return { ...DEFAULT_SETTINGS, ...saved } as SettingsStore;
      },
    },
  ),
);

export function accentHex(accent: SettingsState['accent']): string {
  switch (accent) {
    case 'blue':
      return '#2fb4ff';
    case 'sky':
      return '#4aa8ff';
    case 'violet':
      return '#a586ff';
    case 'amber':
      return '#f2b64c';
    case 'rose':
      return '#ff7a90';
    case 'mint':
    default:
      return '#3ddc97';
  }
}
