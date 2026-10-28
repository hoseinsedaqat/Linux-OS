import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import type { AppId } from '@/types';
import { APP_IDS, APP_META } from '@/core/apps/appMeta';
import { useUsage } from '@/core/analytics/usage';

const DEFAULT_INSTALLED = APP_IDS.filter((id) => APP_META[id].installed);

/**
 * Apps that get a desktop icon out of the box. Everything the user can launch
 * is represented, so the desktop never looks empty — Trash is included even
 * though it is hidden from the application grid.
 *
 * Order matters: icons flow down the first column before wrapping, so the two
 * apps people reach for first (Files and Code) sit at the top and are visible
 * without scrolling.
 */
export const DEFAULT_DESKTOP_APPS: AppId[] = [
  'files',
  'code',
  'browser',
  'terminal',
  'writer',
  'calc',
  'impress',
  'notes',
  'accounting',
  'calculator',
  'calendar',
  'software',
  'monitor',
  'settings',
  'games',
  'trash',
];

/**
 * The dock shows the first eight favourites, so Code is placed third instead of
 * being appended at the end where it fell off the visible strip.
 */
const FAVORITE_ORDER: AppId[] = ['files', 'browser', 'code', 'writer', 'calc', 'notes', 'accounting', 'games'];

export const DEFAULT_FAVORITES: AppId[] = [
  ...FAVORITE_ORDER.filter((id) => APP_META[id]?.pinned),
  ...APP_IDS.filter((id) => APP_META[id].pinned && !FAVORITE_ORDER.includes(id)),
];

/** Move `id` to `index`, keeping every other entry in place and removing duplicates. */
function pinAt(list: AppId[], id: AppId, index: number): AppId[] {
  const rest = list.filter((item) => item !== id);
  const at = Math.max(0, Math.min(index, rest.length));
  return [...rest.slice(0, at), id, ...rest.slice(at)];
}

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

/**
 * Persisted-state migration, kept pure so it can be unit-tested without touching
 * LocalStorage. Returns the state the store should start with.
 */
export function migrateLauncherState(persisted: unknown, version: number): LauncherState {
  const state = (persisted ?? {}) as Partial<LauncherState>;
  if (version < 2) {
    return {
      ...(state as LauncherState),
      installed: state.installed ?? DEFAULT_INSTALLED,
      favorites: DEFAULT_FAVORITES,
      recent: [],
      desktopApps: DEFAULT_DESKTOP_APPS,
    };
  }
  if (version < 4) {
    // v4 promotes Code to the second desktop icon and the third dock slot.
    // v3 only appended it to the end, where it sat below the fold on the desktop
    // and off the visible strip in the dock — users could not find the app they
    // had been told was added. Existing icons keep their order and nothing the
    // user added or removed is reverted.
    const desktopApps = state.desktopApps ?? DEFAULT_DESKTOP_APPS;
    const favorites = state.favorites ?? DEFAULT_FAVORITES;
    return {
      ...(state as LauncherState),
      installed: state.installed ?? DEFAULT_INSTALLED,
      recent: state.recent ?? [],
      favorites: pinAt(favorites, 'code', 2),
      desktopApps: pinAt(desktopApps, 'code', 1),
    };
  }
  return state as LauncherState;
}

export const useLauncher = create<LauncherState>()(
  persist(
    (set) => ({
      installed: DEFAULT_INSTALLED,
      favorites: DEFAULT_FAVORITES,
      recent: [],
      desktopApps: DEFAULT_DESKTOP_APPS,
      recordUse: (appId) => {
        // Local counter only: no network, no identifier (Settings → About).
        useUsage.getState().record(appId);
        set((state) => ({
          recent: [appId, ...state.recent.filter((id) => id !== appId)].slice(0, 8),
        }));
      },
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
      version: 4,
      partialize: (state) => ({
        installed: state.installed,
        favorites: state.favorites,
        recent: state.recent,
        desktopApps: state.desktopApps,
        // never persist actions
      }),
      migrate: (persisted, version) => migrateLauncherState(persisted, version),
    },
  ),
);
