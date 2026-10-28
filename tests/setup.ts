import { afterEach, beforeEach } from 'vitest';
import { cleanup } from '@testing-library/react';
import { useWindows } from '@/core/window-manager/windowsStore';
import { useShell } from '@/core/apps/shellStore';
import { useNotifications } from '@/core/notifications/notificationsStore';
import { useSettings } from '@/core/themes/settingsStore';

/* ------------------------------------------------------------------ */
/* jsdom gaps: matchMedia, ResizeObserver, layout metrics              */
/* ------------------------------------------------------------------ */

if (!window.matchMedia) {
  window.matchMedia = ((query: string) => ({
    matches: false,
    media: query,
    onchange: null,
    addListener: () => {},
    removeListener: () => {},
    addEventListener: () => {},
    removeEventListener: () => {},
    dispatchEvent: () => false,
  })) as unknown as typeof window.matchMedia;
}

class ResizeObserverStub {
  observe() {}
  unobserve() {}
  disconnect() {}
}

if (!('ResizeObserver' in window)) {
  (window as unknown as { ResizeObserver: unknown }).ResizeObserver = ResizeObserverStub;
  (globalThis as unknown as { ResizeObserver: unknown }).ResizeObserver = ResizeObserverStub;
}

if (!HTMLElement.prototype.scrollIntoView) {
  HTMLElement.prototype.scrollIntoView = () => {};
}

/* Predictable viewport so window rects are stable inside tests. */
Object.defineProperty(window, 'innerWidth', { configurable: true, value: 1440 });
Object.defineProperty(window, 'innerHeight', { configurable: true, value: 900 });

beforeEach(() => {
  localStorage.clear();
  sessionStorage.clear();
  useResetStores();
});

afterEach(() => {
  cleanup();
  document.documentElement.removeAttribute('dir');
  document.body.className = '';
});

function useResetStores() {
  useWindows.setState({ windows: [], activeId: null, nextZ: 10 });
  useShell.setState({ overlay: null });
  useNotifications.setState({ items: [] });
  useSettings.getState().reset();
}
