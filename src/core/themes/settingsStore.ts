import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import type { SettingsState } from '@/types';

export const DEFAULT_WALLPAPER = 'wallpaper-aurora';

export const DEFAULT_SETTINGS: SettingsState = {
  language: 'en',
  theme: 'dark',
  accent: 'mint',
  wallpaper: DEFAULT_WALLPAPER,
  customWallpaper: null,
  brightness: 100,
  volume: 62,
  panelPosition: 'bottom',
  panelOpacity: 0.82,
  panelSize: 'normal',
  panelAutoHide: false,
  reduceMotion: false,
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
      version: 1,
      partialize: (state) => {
        const { set: _set, patch: _patch, reset: _reset, ...rest } = state;
        return rest;
      },
      migrate: (persisted, version) => {
        if (version < 1) return { ...DEFAULT_SETTINGS, ...(persisted as object) };
        return persisted as SettingsStore;
      },
    },
  ),
);

export function accentHex(accent: SettingsState['accent']): string {
  switch (accent) {
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
