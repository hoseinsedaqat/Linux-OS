import { create } from 'zustand';
import type { AppId, NotificationItem } from '@/types';
import { useSettings } from '@/core/themes/settingsStore';
import { uid } from '@/utils';

interface NotifyInput {
  title: string;
  body?: string;
  appId?: AppId;
  kind?: NotificationItem['kind'];
  silent?: boolean;
}

interface NotificationsState {
  items: NotificationItem[];
  toasts: NotificationItem[];
  push: (input: NotifyInput) => string;
  dismiss: (id: string) => void;
  dismissToast: (id: string) => void;
  clearAll: () => void;
  markAllRead: () => void;
  unreadCount: () => number;
}

export const useNotifications = create<NotificationsState>((set, get) => ({
  items: [],
  toasts: [],
  push: (input) => {
    const settings = useSettings.getState();
    const item: NotificationItem = {
      id: uid('ntf'),
      title: input.title,
      body: input.body,
      appId: input.appId,
      kind: input.kind ?? 'info',
      createdAt: Date.now(),
      read: false,
    };
    if (!settings.notificationsEnabled) return item.id;
    set((state) => ({
      items: [item, ...state.items].slice(0, 60),
      toasts: settings.dnd || input.silent ? state.toasts : [item, ...state.toasts].slice(0, 4),
    }));
    return item.id;
  },
  dismiss: (id) => set((state) => ({ items: state.items.filter((item) => item.id !== id) })),
  dismissToast: (id) => set((state) => ({ toasts: state.toasts.filter((item) => item.id !== id) })),
  clearAll: () => set({ items: [], toasts: [] }),
  markAllRead: () =>
    set((state) => ({ items: state.items.map((item) => ({ ...item, read: true })) })),
  unreadCount: () => get().items.filter((item) => !item.read).length,
}));

/** Convenience helper usable outside React components. */
export function notify(title: string, options: Omit<NotifyInput, 'title'> = {}): string {
  return useNotifications.getState().push({ title, ...options });
}

export function notifySuccess(title: string, body?: string, appId?: AppId): void {
  notify(title, { body, appId, kind: 'success' });
}

export function notifyError(title: string, body?: string, appId?: AppId): void {
  notify(title, { body, appId, kind: 'error' });
}
