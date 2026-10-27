import { create } from 'zustand';
import type { AppId, WindowInstance, WindowPayload, WindowRect } from '@/types';
import { APP_META } from '@/core/apps/appMeta';
import { useLauncher } from '@/core/apps/launcherStore';
import { currentMetrics } from '@/core/window-manager/metrics';
import { uid } from '@/utils';

interface OpenOptions {
  title?: string;
  payload?: WindowPayload;
  forceNew?: boolean;
}

interface WindowsState {
  windows: WindowInstance[];
  activeId: string | null;
  nextZ: number;
  openApp: (appId: AppId, payload?: WindowPayload, options?: OpenOptions) => string;
  closeWindow: (id: string) => void;
  closeApp: (appId: AppId) => void;
  minimizeWindow: (id: string) => void;
  restoreWindow: (id: string) => void;
  toggleMaximize: (id: string) => void;
  focusWindow: (id: string) => void;
  updateRect: (id: string, rect: Partial<WindowRect>) => void;
  setTitle: (id: string, title: string) => void;
  minimizeAll: () => void;
  restoreAll: () => void;
  closeAll: () => void;
}

function computeInitialRect(appId: AppId, cascadeIndex: number): WindowRect {
  const meta = APP_META[appId];
  const metrics = currentMetrics();
  const { workArea } = metrics;
  const width = Math.min(meta.defaultSize.width, Math.max(280, workArea.width * 0.94));
  const height = Math.min(meta.defaultSize.height, Math.max(220, workArea.height * 0.94));
  const offset = (cascadeIndex % 6) * 26;
  const baseX = workArea.x + (workArea.width - width) / 2;
  const baseY = workArea.y + (workArea.height - height) / 2;
  const x = Math.min(Math.max(baseX + offset - 52, workArea.x + 8), workArea.x + workArea.width - width - 8);
  const y = Math.min(Math.max(baseY + offset - 38, workArea.y + 8), workArea.y + workArea.height - height - 8);
  return {
    x: Math.round(x),
    y: Math.round(y),
    width: Math.round(width),
    height: Math.round(height),
  };
}

export const useWindows = create<WindowsState>((set, get) => ({
  windows: [],
  activeId: null,
  nextZ: 120,

  openApp: (appId, payload, options = {}) => {
    const meta = APP_META[appId];
    const state = get();
    useLauncher.getState().recordUse(appId);

    if (meta.singleton && !options.forceNew) {
      const existing = state.windows.find((win) => win.appId === appId);
      if (existing) {
        const z = state.nextZ + 1;
        set({
          nextZ: z,
          activeId: existing.id,
          windows: state.windows.map((win) =>
            win.id === existing.id
              ? {
                  ...win,
                  minimized: false,
                  zIndex: z,
                  payload: payload ? { ...win.payload, ...payload } : win.payload,
                  title: options.title ?? win.title,
                }
              : win,
          ),
        });
        return existing.id;
      }
    }

    const id = uid('win');
    const z = state.nextZ + 1;
    const metrics = currentMetrics();
    const prevActive = state.windows.find((win) => win.id === state.activeId);
    const rect = computeInitialRect(appId, state.windows.length);
    const win: WindowInstance = {
      id,
      appId,
      title: options.title ?? meta.name,
      zIndex: z,
      minimized: false,
      maximized: metrics.isMobile,
      ...(metrics.isMobile
        ? {
            x: metrics.workArea.x,
            y: metrics.workArea.y,
            width: metrics.workArea.width,
            height: metrics.workArea.height,
          }
        : rect),
      restoreRect: metrics.isMobile ? rect : undefined,
      payload,
      createdAt: Date.now(),
    };

    set({
      windows: prevActive
        ? [...state.windows.filter((item) => item.id !== id), { ...prevActive }, win].slice(0, 40)
        : [...state.windows, win],
      activeId: id,
      nextZ: z,
    });
    return id;
  },

  closeWindow: (id) => {
    const state = get();
    const remaining = state.windows.filter((win) => win.id !== id);
    const active = remaining
      .filter((win) => !win.minimized)
      .sort((a, b) => b.zIndex - a.zIndex)[0];
    set({ windows: remaining, activeId: active ? active.id : null });
  },

  closeApp: (appId) => {
    const state = get();
    const ids = state.windows.filter((win) => win.appId === appId).map((win) => win.id);
    ids.forEach((id) => get().closeWindow(id));
  },

  minimizeWindow: (id) => {
    const state = get();
    const remaining = state.windows.filter((win) => win.id !== id && !win.minimized);
    const next = remaining.sort((a, b) => b.zIndex - a.zIndex)[0];
    set({
      windows: state.windows.map((win) => (win.id === id ? { ...win, minimized: true } : win)),
      activeId: next ? next.id : null,
    });
  },

  restoreWindow: (id) => {
    const z = get().nextZ + 1;
    set((state) => ({
      nextZ: z,
      activeId: id,
      windows: state.windows.map((win) =>
        win.id === id ? { ...win, minimized: false, zIndex: z } : win,
      ),
    }));
  },

  toggleMaximize: (id) => {
    const metrics = currentMetrics();
    set((state) => ({
      windows: state.windows.map((win) => {
        if (win.id !== id) return win;
        if (win.maximized) {
          const restore = win.restoreRect ?? computeInitialRect(win.appId, 0);
          return { ...win, maximized: false, ...restore };
        }
        return {
          ...win,
          maximized: true,
          restoreRect: { x: win.x, y: win.y, width: win.width, height: win.height },
          x: metrics.workArea.x,
          y: metrics.workArea.y,
          width: metrics.workArea.width,
          height: metrics.workArea.height,
        };
      }),
    }));
  },

  focusWindow: (id) => {
    const state = get();
    const win = state.windows.find((item) => item.id === id);
    if (!win) return;
    if (state.activeId === id && !win.minimized && win.zIndex === state.nextZ) return;
    const z = state.nextZ + 1;
    set({
      nextZ: z,
      activeId: id,
      windows: state.windows.map((item) =>
        item.id === id ? { ...item, minimized: false, zIndex: z } : item,
      ),
    });
  },

  updateRect: (id, rect) =>
    set((state) => ({
      windows: state.windows.map((win) => (win.id === id ? { ...win, ...rect } : win)),
    })),

  setTitle: (id, title) =>
    set((state) => ({
      windows: state.windows.map((win) => (win.id === id ? { ...win, title } : win)),
    })),

  minimizeAll: () => {
    set((state) => ({
      windows: state.windows.map((win) => ({ ...win, minimized: true })),
      activeId: null,
    }));
  },

  restoreAll: () => {
    const z = get().nextZ + 1;
    set((state) => ({
      nextZ: z,
      windows: state.windows.map((win) => ({ ...win, minimized: false })),
      activeId: state.windows[state.windows.length - 1]?.id ?? null,
    }));
  },

  closeAll: () => set({ windows: [], activeId: null }),
}));
