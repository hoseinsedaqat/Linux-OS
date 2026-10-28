import { create } from 'zustand';
import type { AppId, SnapMode, WindowInstance, WindowPayload, WindowRect } from '@/types';
import { APP_META } from '@/core/apps/appMeta';
import { useLauncher } from '@/core/apps/launcherStore';
import { currentMetrics } from '@/core/window-manager/metrics';
import { uid } from '@/utils';
import { playSound } from '@/core/audio/sfx';
import { layoutRects, type LayoutId, type SavedSession } from '@/core/window-manager/session';

interface OpenOptions {
  title?: string;
  payload?: WindowPayload;
  forceNew?: boolean;
}

export const WORKSPACE_COUNT = 4;

const snapRects: Record<SnapMode, (area: WindowRect) => WindowRect> = {
  left: (area) => ({ x: area.x, y: area.y, width: Math.round(area.width / 2), height: area.height }),
  right: (area) => ({
    x: area.x + Math.round(area.width / 2),
    y: area.y,
    width: Math.round(area.width / 2),
    height: area.height,
  }),
  'top-left': (area) => ({
    x: area.x,
    y: area.y,
    width: Math.round(area.width / 2),
    height: Math.round(area.height / 2),
  }),
  'top-right': (area) => ({
    x: area.x + Math.round(area.width / 2),
    y: area.y,
    width: Math.round(area.width / 2),
    height: Math.round(area.height / 2),
  }),
  'bottom-left': (area) => ({
    x: area.x,
    y: area.y + Math.round(area.height / 2),
    width: Math.round(area.width / 2),
    height: Math.round(area.height / 2),
  }),
  'bottom-right': (area) => ({
    x: area.x + Math.round(area.width / 2),
    y: area.y + Math.round(area.height / 2),
    width: Math.round(area.width / 2),
    height: Math.round(area.height / 2),
  }),
};

/** The workspace a window belongs to (windows created before workspaces = 1). */
export function workspaceOf(win: WindowInstance): number {
  return win.workspace ?? 1;
}

interface WindowsState {
  windows: WindowInstance[];
  workspace: number;
  switchWorkspace: (index: number) => void;
  cycleWorkspace: (delta: number) => void;
  moveToWorkspace: (id: string, workspace: number) => void;
  snapWindow: (id: string, mode: SnapMode) => void;
  unsnap: (id: string) => void;
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
  /** Rearrange the visible windows of the current workspace. */
  applyLayout: (layout: LayoutId) => void;
  /** Rebuild the window layer from a saved session. */
  restoreSession: (session: SavedSession) => void;
}

/**
 * Opening size for a fresh window.
 *
 * Applications used to open at their own small default size, which left most of
 * the screen empty ("why is it half screen?"). A new window is now sized as at
 * least a comfortable share of the work area, so the app you opened is the app
 * you see. The share is a floor, not a ceiling: apps that ask for more keep it.
 */
const PREFERRED_SHARE_X = 0.88;
const PREFERRED_SHARE_Y = 0.82;

function computeInitialRect(appId: AppId, cascadeIndex: number): WindowRect {
  const meta = APP_META[appId];
  const metrics = currentMetrics();
  const { workArea } = metrics;
  const preferred = meta.defaultSize;
  const width = Math.min(
    Math.max(preferred.width, Math.round(workArea.width * PREFERRED_SHARE_X)),
    Math.max(280, Math.round(workArea.width * 0.96)),
  );
  const height = Math.min(
    Math.max(preferred.height, Math.round(workArea.height * PREFERRED_SHARE_Y)),
    Math.max(220, Math.round(workArea.height * 0.96)),
  );
  // Keep the cascade offset modest so a full-size window stays centred.
  const offset = (cascadeIndex % 5) * 22;
  const baseX = workArea.x + (workArea.width - width) / 2;
  const baseY = workArea.y + (workArea.height - height) / 2;
  const x = Math.min(
    Math.max(baseX + offset - 44, workArea.x + 8),
    Math.max(workArea.x + 8, workArea.x + workArea.width - width - 8),
  );
  const y = Math.min(
    Math.max(baseY + offset - 32, workArea.y + 8),
    Math.max(workArea.y + 8, workArea.y + workArea.height - height - 8),
  );
  return {
    x: Math.round(x),
    y: Math.round(y),
    width: Math.round(width),
    height: Math.round(height),
  };
}

/** Phones and narrow browser windows get full-screen applications. */
function shouldStartMaximized(metrics: ReturnType<typeof currentMetrics>): boolean {
  return metrics.isMobile || metrics.workArea.width < 1120 || metrics.workArea.height < 660;
}

export const useWindows = create<WindowsState>((set, get) => ({
  windows: [],
  workspace: 1,
  activeId: null,
  nextZ: 120,

  switchWorkspace: (index) => {
    const next = Math.min(Math.max(1, Math.round(index)), WORKSPACE_COUNT);
    const state = get();
    const top = state.windows
      .filter((win) => workspaceOf(win) === next && !win.minimized)
      .sort((a, b) => b.zIndex - a.zIndex)[0];
    set({ workspace: next, activeId: top ? top.id : null });
  },

  cycleWorkspace: (delta) => {
    const state = get();
    const next = ((state.workspace - 1 + delta + WORKSPACE_COUNT) % WORKSPACE_COUNT) + 1;
    get().switchWorkspace(next);
  },

  moveToWorkspace: (id, workspace) => {
    const target = Math.min(Math.max(1, Math.round(workspace)), WORKSPACE_COUNT);
    set((state) => ({
      windows: state.windows.map((win) =>
        win.id === id ? { ...win, workspace: target, minimized: target === state.workspace ? win.minimized : true } : win,
      ),
      activeId: state.activeId === id && target !== state.workspace ? null : state.activeId,
    }));
  },

  snapWindow: (id, mode) => {
    const { workArea } = currentMetrics();
    const gap = 6;
    const rect = snapRects[mode]({
      x: workArea.x + gap,
      y: workArea.y + gap,
      width: workArea.width - gap * 2,
      height: workArea.height - gap * 2,
    });
    set((state) => ({
      windows: state.windows.map((win) =>
        win.id === id
          ? { ...win, ...rect, maximized: false, snapped: mode, restoreRect: win.snapped ? win.restoreRect : { x: win.x, y: win.y, width: win.width, height: win.height } }
          : win,
      ),
    }));
  },

  unsnap: (id) => {
    set((state) => ({
      windows: state.windows.map((win) => (win.id === id ? { ...win, snapped: undefined } : win)),
    }));
  },

  openApp: (appId, payload, options = {}) => {
    const meta = APP_META[appId];
    const state = get();
    useLauncher.getState().recordUse(appId);
    playSound('open');

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
    const maximize = shouldStartMaximized(metrics);
    const win: WindowInstance = {
      id,
      appId,
      title: options.title ?? meta.name,
      zIndex: z,
      minimized: false,
      maximized: maximize,
      ...(maximize
        ? {
            x: metrics.workArea.x,
            y: metrics.workArea.y,
            width: metrics.workArea.width,
            height: metrics.workArea.height,
          }
        : rect),
      restoreRect: maximize ? rect : undefined,
      payload,
      createdAt: Date.now(),
      workspace: state.workspace,
    };

    // New windows go on top of the stack. The previously active window is
    // re-appended so it renders above the others, so it must be removed from
    // the rest first — otherwise every launch leaves a duplicate in the dock.
    const rest = state.windows.filter((item) => item.id !== id && item.id !== prevActive?.id);
    set({
      windows: prevActive ? [...rest, prevActive, win].slice(-40) : [...rest, win].slice(-40),
      activeId: id,
      nextZ: z,
    });
    return id;
  },

  closeWindow: (id) => {
    playSound('close');
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
      windows: state.windows.map((win) =>
        win.id === id ? { ...win, ...rect, snapped: rect.width !== undefined || rect.x !== undefined ? undefined : win.snapped } : win,
      ),
    })),

  setTitle: (id, title) =>
    set((state) => ({
      windows: state.windows.map((win) => (win.id === id ? { ...win, title } : win)),
    })),

  minimizeAll: () => {
    set((state) => ({
      windows: state.windows.map((win) => (workspaceOf(win) === state.workspace ? { ...win, minimized: true } : win)),
      activeId: null,
    }));
  },

  restoreAll: () => {
    const z = get().nextZ + 1;
    set((state) => {
      const mine = state.windows.filter((win) => workspaceOf(win) === state.workspace);
      return {
        nextZ: z,
        windows: state.windows.map((win) => (workspaceOf(win) === state.workspace ? { ...win, minimized: false } : win)),
        activeId: mine.length > 0 ? mine[mine.length - 1].id : null,
      };
    });
  },

  closeAll: () => set({ windows: [], activeId: null }),

  applyLayout: (layout) => {
    const state = get();
    const area = currentMetrics().workArea;
    const targets = state.windows
      .filter((win) => workspaceOf(win) === state.workspace && !win.minimized)
      .sort((a, b) => a.createdAt - b.createdAt);
    if (targets.length === 0) return;
    const rects = layoutRects(layout, area, targets.length);
    const order = new Map(targets.map((win, index) => [win.id, rects[index]]));
    set({
      windows: state.windows.map((win) => {
        const rect = order.get(win.id);
        if (!rect) return win;
        return {
          ...win,
          ...rect,
          maximized: false,
          snapped: undefined,
          restoreRect: undefined,
        };
      }),
    });
  },

  restoreSession: (session) => {
    const area = currentMetrics().workArea;
    let z = 120;
    const windows: WindowInstance[] = session.windows
      .filter((saved) => Boolean(APP_META[saved.appId]))
      .slice(0, 12)
      .map((saved) => {
        z += 1;
        const width = Math.min(Math.max(240, saved.rect.width), area.width);
        const height = Math.min(Math.max(180, saved.rect.height), area.height);
        return {
          id: uid('win'),
          appId: saved.appId,
          title: saved.title,
          x: Math.min(Math.max(area.x, saved.rect.x), area.x + area.width - width),
          y: Math.min(Math.max(area.y, saved.rect.y), area.y + area.height - height),
          width,
          height,
          zIndex: z,
          minimized: saved.minimized,
          maximized: saved.maximized,
          snapped: saved.snapped,
          payload: saved.payload,
          createdAt: Date.now(),
          workspace: Math.min(Math.max(1, saved.workspace), WORKSPACE_COUNT),
        } satisfies WindowInstance;
      });
    if (windows.length === 0) return;
    const activeIndex = session.activeIndex >= 0 && session.activeIndex < windows.length ? session.activeIndex : windows.length - 1;
    set({
      windows,
      activeId: windows[activeIndex].id,
      nextZ: z,
      workspace: Math.min(Math.max(1, session.workspace), WORKSPACE_COUNT),
    });
  },
}));
