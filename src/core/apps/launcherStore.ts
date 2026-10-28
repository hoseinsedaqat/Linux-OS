import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import type { AppId } from '@/types';
import { APP_IDS, APP_META } from '@/core/apps/appMeta';

const DEFAULT_INSTALLED = APP_IDS.filter((id) => APP_META[id].installed);

/**
 * Apps that get a desktop icon out of the box. Everything the user can launch
 * is represented, so the desktop never looks empty — Trash is included even
 * though it is hidden from the application grid.
 */
export const DEFAULT_DESKTOP_APPS: AppId[] = [
  'files',
  'browser',
  'writer',
  'calc',
  'impress',
  'notes',
  'accounting',
  'terminal',
  'calculator',
  'calendar',
  'software',
  'monitor',
  'settings',
  'games',
  'trash',
];

const DEFAULT_FAVORITES = APP_IDS.filter((id) => APP_META[id].pinned);

interface LauncherState {
  installed: AppId[];
  favorites: AppId[];
  recent: AppId[];
  /** Apps with an icon on the desktop, in display order. */
  desktopApps: AppId[];
  recordUse: (appId: AppId) => void;
  toggleFavorite: (appId: AppId) => void;
  install: (appId: AppId) => void;
  uninstall: (appId: AppId) => void;
  addToDesktop: (appId: AppId) => void;
  removeFromDesktop: (appId: AppId) => void;
  toggleDesktop: (appId: AppId) => void;
  moveDesktopApp: (appId: AppId, delta: number) => void;
  resetDesktop: () => void;
  resetLauncher: () => void;
}

export const useLauncher = create<LauncherState>()(
  persist(
    (set) => ({
      installed: DEFAULT_INSTALLED,
      favorites: DEFAULT_FAVORITES,
      recent: [],
      desktopApps: DEFAULT_DESKTOP_APPS,
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
          desktopApps: state.desktopApps.filter((id) => id !== appId),
        })),
      addToDesktop: (appId) =>
        set((state) =>
          state.desktopApps.includes(appId)
            ? state
            : { desktopApps: [...state.desktopApps, appId] },
        ),
      removeFromDesktop: (appId) =>
        set((state) => ({ desktopApps: state.desktopApps.filter((id) => id !== appId) })),
      toggleDesktop: (appId) =>
        set((state) => ({
          desktopApps: state.desktopApps.includes(appId)
            ? state.desktopApps.filter((id) => id !== appId)
            : [...state.desktopApps, appId],
        })),
      moveDesktopApp: (appId, delta) =>
        set((state) => {
          const index = state.desktopApps.indexOf(appId);
          const next = index + delta;
          if (index < 0 || next < 0 || next >= state.desktopApps.length) return state;
          const desktopApps = [...state.desktopApps];
          desktopApps.splice(index, 1);
          desktopApps.splice(next, 0, appId);
          return { desktopApps };
        }),
      resetDesktop: () => set({ desktopApps: DEFAULT_DESKTOP_APPS }),
      resetLauncher: () =>
        set({
          installed: DEFAULT_INSTALLED,
          favorites: DEFAULT_FAVORITES,
          recent: [],
          desktopApps: DEFAULT_DESKTOP_APPS,
        }),
    }),
    {
      name: 'nova-linux.launcher.v1',
      storage: createJSONStorage(() => localStorage),
      version: 2,
      partialize: (state) => ({
        installed: state.installed,
        favorites: state.favorites,
        recent: state.recent,
        desktopApps: state.desktopApps,
        // never persist actions
      }),
      migrate: (persisted, version) => {
        const state = (persisted ?? {}) as Partial<LauncherState>;
        if (version < 2) {
          return {
            ...state,
            installed: state.installed ?? DEFAULT_INSTALLED,
            favorites: state.favorites ?? DEFAULT_FAVORITES,
            recent: state.recent ?? [],
            desktopApps: DEFAULT_DESKTOP_APPS,
          } as LauncherState;
        }
        return state as LauncherState;
      },
    },
  ),
);
