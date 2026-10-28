import { useEffect } from 'react';
import { useSettings } from '@/core/themes/settingsStore';
import { useWindows } from '@/core/window-manager/windowsStore';
import { saveSession, type SavedSession } from '@/core/window-manager/session';
import { useFiles } from '@/core/virtual-filesystem/fsStore';
import { notify } from '@/core/notifications/notificationsStore';
import type { SettingsState } from '@/types';

/**
 * Cross-tab sync over BroadcastChannel.
 *
 * Open NOVA Linux in two tabs and they behave like two monitors of the same
 * machine: theme and preferences follow you, windows are mirrored, and a file
 * saved in one tab is announced to the other. Everything stays inside this
 * origin — BroadcastChannel never leaves the browser.
 *
 * The channel is strictly optional: without BroadcastChannel (or with the
 * setting off) every tab is simply independent.
 */
const CHANNEL_NAME = 'nova-linux.sync.v1';

type SyncMessage =
  | { type: 'settings'; payload: Partial<SettingsState>; origin: string }
  | { type: 'windows'; payload: SavedSession; origin: string }
  | { type: 'files' }
  | { type: 'hello'; origin: string }
  | { type: 'bye'; origin: string };

const originId = `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;

let channel: BroadcastChannel | null = null;
let applyingRemote = false;
let started = false;

/** Number of other tabs currently connected (for the About page). */
export const presence = { count: 0 };

function post(message: SyncMessage): void {
  try {
    channel?.postMessage(message);
  } catch {
    /* the channel was closed while we were writing */
  }
}

function windowSnapshot(): SavedSession {
  const state = useWindows.getState();
  return {
    version: 1,
    windows: state.windows.map((win) => ({
      appId: win.appId,
      title: win.title,
      payload: win.payload,
      rect: { x: win.x, y: win.y, width: win.width, height: win.height },
      maximized: win.maximized,
      snapped: win.snapped,
      workspace: win.workspace ?? 1,
      minimized: win.minimized,
    })),
    activeIndex: state.activeId ? state.windows.findIndex((win) => win.id === state.activeId) : -1,
    workspace: state.workspace,
    savedAt: Date.now(),
  };
}

/** Start mirroring this tab with every other NOVA Linux tab on the origin. */
export function startCrossTabSync(): () => void {
  if (started) return () => undefined;
  started = true;
  if (typeof BroadcastChannel === 'undefined') {
    return () => {
      started = false;
    };
  }
  channel = new BroadcastChannel(CHANNEL_NAME);

  channel.onmessage = (event: MessageEvent<SyncMessage>) => {
    const message = event.data;
    if (!message || 'origin' in message && message.origin === originId) return;
    applyingRemote = true;
    try {
      if (message.type === 'settings') {
        useSettings.setState(message.payload);
      } else if (message.type === 'windows') {
        // Rebuild the layer only when the other tab actually differs, so a
        // mirrored window does not fight with local drags.
        const local = windowSnapshot();
        if (JSON.stringify(local.windows) !== JSON.stringify(message.payload.windows)) {
          useWindows.getState().restoreSession(message.payload);
        }
      } else if (message.type === 'files') {
        void useFiles.getState().init();
      } else if (message.type === 'hello') {
        presence.count += 1;
        post({ type: 'windows', payload: windowSnapshot(), origin: originId });
      } else if (message.type === 'bye') {
        presence.count = Math.max(0, presence.count - 1);
      }
    } finally {
      applyingRemote = false;
    }
  };

  const unsubscribeSettings = useSettings.subscribe((state, previous) => {
    if (applyingRemote || state.crossTabSync === false) return;
    const patch: Partial<SettingsState> = {};
    (Object.keys(state) as Array<keyof SettingsState>).forEach((key) => {
      if (typeof state[key] === 'function') return;
      if (state[key] !== previous[key]) (patch as Record<string, unknown>)[key as string] = state[key];
    });
    if (Object.keys(patch).length > 0) post({ type: 'settings', payload: patch, origin: originId });
  });

  let windowTimer = 0;
  const unsubscribeWindows = useWindows.subscribe(() => {
    if (applyingRemote) return;
    window.clearTimeout(windowTimer);
    windowTimer = window.setTimeout(() => {
      if (!useSettings.getState().crossTabSync) return;
      post({ type: 'windows', payload: windowSnapshot(), origin: originId });
    }, 250);
  });

  let fileTimer = 0;
  const unsubscribeFiles = useFiles.subscribe(() => {
    if (applyingRemote) return;
    window.clearTimeout(fileTimer);
    fileTimer = window.setTimeout(() => post({ type: 'files' }), 600);
  });

  post({ type: 'hello', origin: originId });

  return () => {
    unsubscribeSettings();
    unsubscribeWindows();
    unsubscribeFiles();
    window.clearTimeout(windowTimer);
    window.clearTimeout(fileTimer);
    post({ type: 'bye', origin: originId });
    channel?.close();
    channel = null;
    started = false;
    presence.count = 0;
  };
}

/** Keep the window sessions in one place: save on unload as a safety net. */
export function saveSessionNow(): void {
  const state = useWindows.getState();
  saveSession(state.windows, state.activeId, state.workspace);
}

/** Announce a notification to the other tabs. */
export function broadcastNotification(title: string, body?: string): void {
  if (!useSettings.getState().crossTabSync) return;
  notify(title, { body, kind: 'info' });
}

/** React wrapper: keeps the channel alive for the lifetime of the desktop. */
export function useCrossTabSync(enabled: boolean): void {
  useEffect(() => {
    if (!enabled) return;
    return startCrossTabSync();
  }, [enabled]);
}
