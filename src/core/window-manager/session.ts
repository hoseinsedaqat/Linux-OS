import type { AppId, SnapMode, WindowPayload, WindowRect } from '@/types';

/**
 * Session restore.
 *
 * The simulator keeps its documents in IndexedDB, but a desktop that forgets
 * where every window was the moment you reload feels wrong. This module stores
 * a compact snapshot of the window layer in localStorage (it is small and
 * synchronous) and hands it back on the next load.
 */
const KEY = 'nova-linux.session.v1';
const MAX_WINDOWS = 12;

export interface SavedWindow {
  appId: AppId;
  title: string;
  payload?: WindowPayload;
  rect: WindowRect;
  maximized: boolean;
  snapped?: SnapMode;
  workspace: number;
  minimized: boolean;
}

export interface SavedSession {
  version: 1;
  windows: SavedWindow[];
  activeIndex: number;
  workspace: number;
  savedAt: number;
}

/** Only serialisable, small payloads are worth restoring. */
function cleanPayload(payload?: WindowPayload): WindowPayload | undefined {
  if (!payload) return undefined;
  const entries = Object.entries(payload).filter(([, value]) => typeof value === 'string' || typeof value === 'boolean');
  return entries.length > 0 ? (Object.fromEntries(entries) as WindowPayload) : undefined;
}

export function saveSession(
  windows: Array<{
    appId: AppId;
    title: string;
    payload?: WindowPayload;
    x: number;
    y: number;
    width: number;
    height: number;
    maximized: boolean;
    snapped?: SnapMode;
    workspace?: number;
    minimized: boolean;
    id: string;
  }>,
  activeId: string | null,
  workspace: number,
): void {
  try {
    const snapshot: SavedSession = {
      version: 1,
      windows: windows.slice(-MAX_WINDOWS).map((win) => ({
        appId: win.appId,
        title: win.title,
        payload: cleanPayload(win.payload),
        rect: {
          x: Math.round(win.x),
          y: Math.round(win.y),
          width: Math.round(win.width),
          height: Math.round(win.height),
        },
        maximized: win.maximized,
        snapped: win.snapped,
        workspace: win.workspace ?? 1,
        minimized: win.minimized,
      })),
      activeIndex: activeId ? windows.findIndex((win) => win.id === activeId) : -1,
      workspace,
      savedAt: Date.now(),
    };
    localStorage.setItem(KEY, JSON.stringify(snapshot));
  } catch {
    /* storage blocked — the session simply is not restored */
  }
}

export function loadSession(): SavedSession | null {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as SavedSession;
    if (parsed.version !== 1 || !Array.isArray(parsed.windows) || parsed.windows.length === 0) return null;
    // Ignore anything absurdly old; a week-old layout is rarely what you want.
    if (Date.now() - parsed.savedAt > 7 * 24 * 60 * 60 * 1000) return null;
    return parsed;
  } catch {
    return null;
  }
}

export function clearSession(): void {
  try {
    localStorage.removeItem(KEY);
  } catch {
    /* ignore */
  }
}

/* ------------------------------------------------------------------ */
/* Snap layouts                                                        */
/* ------------------------------------------------------------------ */

export type LayoutId = 'columns' | 'rows' | 'grid' | 'focus' | 'cascade';

export interface LayoutDefinition {
  id: LayoutId;
  label: string;
  hint: string;
}

export const LAYOUTS: LayoutDefinition[] = [
  { id: 'columns', label: 'Side by side', hint: 'Every window side by side' },
  { id: 'rows', label: 'Stacked', hint: 'Every window stacked vertically' },
  { id: 'grid', label: 'Grid', hint: 'Even grid over the whole work area' },
  { id: 'focus', label: 'Focus + sidebar', hint: 'Large window on the left, the rest on the right' },
  { id: 'cascade', label: 'Cascade', hint: 'Overlapping windows, offset like a stack' },
];

export const SNAP_PRESETS: Array<{ mode: SnapMode; label: string }> = [
  { mode: 'left', label: 'Left half' },
  { mode: 'right', label: 'Right half' },
  { mode: 'top-left', label: 'Top left' },
  { mode: 'top-right', label: 'Top right' },
  { mode: 'bottom-left', label: 'Bottom left' },
  { mode: 'bottom-right', label: 'Bottom right' },
];

/**
 * Rectangles for a layout over a work area. Pure, so the window manager and the
 * tests agree on the maths.
 */
export function layoutRects(id: LayoutId, area: WindowRect, count: number): WindowRect[] {
  const n = Math.max(1, count);
  const gap = 8;
  const usableWidth = area.width - gap;
  const usableHeight = area.height - gap;

  switch (id) {
    case 'columns': {
      const width = Math.round((usableWidth - gap * (n - 1)) / n);
      return Array.from({ length: n }, (_, index) => ({
        x: area.x + index * (width + gap),
        y: area.y,
        width,
        height: area.height,
      }));
    }
    case 'rows': {
      const height = Math.round((usableHeight - gap * (n - 1)) / n);
      return Array.from({ length: n }, (_, index) => ({
        x: area.x,
        y: area.y + index * (height + gap),
        width: area.width,
        height,
      }));
    }
    case 'grid': {
      const columns = Math.ceil(Math.sqrt(n));
      const rows = Math.ceil(n / columns);
      const width = Math.round((usableWidth - gap * (columns - 1)) / columns);
      const height = Math.round((usableHeight - gap * (rows - 1)) / rows);
      return Array.from({ length: n }, (_, index) => ({
        x: area.x + (index % columns) * (width + gap),
        y: area.y + Math.floor(index / columns) * (height + gap),
        width,
        height,
      }));
    }
    case 'focus': {
      if (n === 1) return [{ x: area.x, y: area.y, width: area.width, height: area.height }];
      const focusWidth = Math.round(area.width * 0.62);
      const sideWidth = area.width - focusWidth - gap;
      const sideHeight = Math.round((usableHeight - gap * (n - 2)) / (n - 1));
      return Array.from({ length: n }, (_, index) =>
        index === 0
          ? { x: area.x, y: area.y, width: focusWidth, height: area.height }
          : {
              x: area.x + focusWidth + gap,
              y: area.y + (index - 1) * (sideHeight + gap),
              width: sideWidth,
              height: sideHeight,
            },
      );
    }
    case 'cascade':
    default:
      return Array.from({ length: n }, (_, index) => {
        const width = Math.round(area.width * 0.72);
        const height = Math.round(area.height * 0.72);
        const step = 34;
        return {
          x: Math.min(area.x + 24 + index * step, area.x + area.width - width),
          y: Math.min(area.y + 24 + index * step, area.y + area.height - height),
          width,
          height,
        };
      });
  }
}
