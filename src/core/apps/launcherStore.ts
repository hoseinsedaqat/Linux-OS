import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import type { AppId } from '@/types';
import { APP_IDS, APP_META } from '@/core/apps/appMeta';

const DEFAULT_INSTALLED = APP_IDS.filter((id) => APP_META[id].installed);
const DEFAULT_FAVORITES = APP_IDS.filter((id) => APP_META[id].pinned);

interface LauncherState {
  installed: AppId[];
  favorites: AppId[];
  recent: AppId[];
  recordUse: (appId: AppId) => void;
  toggleFavorite: (appId: AppId) => void;
  install: (appId: AppId) => void;
  uninstall: (appId: AppId) => void;
  resetLauncher: () => void;
}

export const useLauncher = create<LauncherState>()(
  persist(
    (set) => ({
      installed: DEFAULT_INSTALLED,
      favorites: DEFAULT_FAVORITES,
      recent: [],
      recordUse: (appId) =>
        set((state) => ({
          recent: [appId, ...state.recent.filter((id) => id !== appId)].slice(0, 8),
        })),
      toggleFavorite: (appId) =>
        set((state) => ({
          favorites: state.favorites.includes(appId)
            ? state.favorites.filter((id) => id !== appId)
            : [...state.favorites, appId],
        })),
      install: (appId) =>
        set((state) => ({
          installed: state.installed.includes(appId) ? state.installed : [...state.installed, appId],
        })),
      uninstall: (appId) =>
        set((state) => ({
          installed: state.installed.filter((id) => id !== appId),
          favorites: state.favorites.filter((id) => id !== appId),
          recent: state.recent.filter((id) => id !== appId),
        })),
      resetLauncher: () =>
        set({ installed: DEFAULT_INSTALLED, favorites: DEFAULT_FAVORITES, recent: [] }),
    }),
    {
      name: 'nova-linux.launcher.v1',
      storage: createJSONStorage(() => localStorage),
      version: 1,
      partialize: (state) => ({
        installed: state.installed,
        favorites: state.favorites,
        recent: state.recent,
      }),
    },
  ),
);
