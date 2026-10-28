import { beforeEach, describe, expect, it } from 'vitest';
import { fireEvent, render, waitFor } from '@testing-library/react';
import { Desktop } from '@/components/desktop/Desktop';
import { useWindows } from '@/core/window-manager/windowsStore';
import { useFiles } from '@/core/virtual-filesystem/fsStore';
import { useSettings } from '@/core/themes/settingsStore';
import { DEFAULT_DESKTOP_APPS, useLauncher } from '@/core/apps/launcherStore';
import { APP_META } from '@/core/apps/appMeta';
import { saveSession, loadSession } from '@/core/window-manager/session';
import type { AppId } from '@/types';

function desktop() {
  return render(<Desktop onLock={() => {}} onShutdown={() => {}} onRestart={() => {}} />);
}

function windowTitles(): string[] {
  return Array.from(document.querySelectorAll('.window__title')).map((node) => node.textContent ?? '');
}

beforeEach(async () => {
  localStorage.clear();
  await useFiles.getState().init();
  useLauncher.setState({
    desktopApps: DEFAULT_DESKTOP_APPS,
    installed: (Object.keys(APP_META) as AppId[]).filter((id) => APP_META[id].installed),
    favorites: (Object.keys(APP_META) as AppId[]).filter((id) => APP_META[id].pinned),
  });
  useWindows.setState({ windows: [], activeId: null, nextZ: 10, workspace: 1 });
  useSettings.setState({ ...useSettings.getState(), restoreWindows: true });
  sessionStorage.setItem('nova.introShown', '1');
  sessionStorage.setItem('nova.welcomed', '1');
});

describe('session restore', () => {
  it('reopens the saved windows in their saved places', async () => {
    saveSession(
      [
        {
          id: 'a',
          appId: 'files',
          title: 'Files',
          x: 40,
          y: 60,
          width: 640,
          height: 420,
          maximized: false,
          workspace: 1,
          minimized: false,
        },
        {
          id: 'b',
          appId: 'terminal',
          title: 'Terminal',
          x: 300,
          y: 220,
          width: 560,
          height: 360,
          maximized: false,
          workspace: 1,
          minimized: false,
        },
      ],
      'b',
      1,
    );

    desktop();

    await waitFor(() => expect(useWindows.getState().windows).toHaveLength(2));
    const [first, second] = useWindows.getState().windows;
    expect(first.appId).toBe('files');
    expect(first.width).toBeGreaterThanOrEqual(240);
    expect(second.appId).toBe('terminal');
    expect(useWindows.getState().activeId).toBe(second.id);
    expect(windowTitles().length).toBeGreaterThanOrEqual(1);
  });

  it('starts empty when restore is switched off', async () => {
    saveSession(
      [
        {
          id: 'a',
          appId: 'files',
          title: 'Files',
          x: 40,
          y: 60,
          width: 640,
          height: 420,
          maximized: false,
          workspace: 1,
          minimized: false,
        },
      ],
      null,
      1,
    );
    useSettings.setState({ ...useSettings.getState(), restoreWindows: false });

    desktop();
    await waitFor(() => expect(document.querySelectorAll('.window').length).toBe(0));
    expect(useWindows.getState().windows).toHaveLength(0);
  });

  it('writes the live window layer back into the snapshot', async () => {
    desktop();
    useWindows.getState().openApp('calculator');
    await waitFor(() => {
      const saved = loadSession();
      expect(saved?.windows.some((win) => win.appId === 'calculator')).toBe(true);
    }, { timeout: 3000 });
  });
});

describe('snap layouts', () => {
  it('arranges every open window into columns without overlapping', async () => {
    desktop();
    useWindows.getState().openApp('files');
    useWindows.getState().openApp('terminal');
    useWindows.getState().applyLayout('columns');

    const [left, right] = useWindows.getState().windows;
    expect(left.snapped).toBeUndefined();
    expect(left.x).toBeLessThan(right.x);
    expect(left.x + left.width).toBeLessThanOrEqual(right.x);
    expect(left.width).toBeGreaterThan(200);
  });

  it('leaves minimised windows alone', async () => {
    desktop();
    useWindows.getState().openApp('files');
    useWindows.getState().openApp('terminal');
    const hidden = useWindows.getState().windows[1];
    useWindows.getState().minimizeWindow(hidden.id);
    const before = useWindows.getState().windows[1];
    useWindows.getState().applyLayout('columns');
    const after = useWindows.getState().windows.find((win) => win.id === before.id)!;
    expect(after.x).toBe(before.x);
    expect(after.width).toBe(before.width);
  });

  it('opens the layout menu from the title bar and snaps one window', async () => {
    desktop();
    useWindows.getState().openApp('files');
    await waitFor(() => expect(document.querySelector('.window__control--layouts')).toBeTruthy());

    fireEvent.click(document.querySelector('.window__control--layouts')!);
    const menu = await waitFor(() => {
      const node = document.querySelector('.window__layouts');
      expect(node).toBeTruthy();
      return node as HTMLElement;
    });
    expect(menu.textContent).toContain('Side by side');

    fireEvent.click(menu.querySelector('.window__layout-cell.is-left')!);
    await waitFor(() => expect(useWindows.getState().windows[0].snapped).toBe('left'));
    expect(document.querySelector('.window__layouts')).toBeNull();
  });
});

describe('code palette', () => {
  it('opens with Ctrl+Shift+P and lists files and commands', async () => {
    desktop();
    useWindows.getState().openApp('code');

    await waitFor(() => expect(document.querySelector('.code')).toBeTruthy(), { timeout: 5000 });

    const root = document.querySelector('.code') as HTMLElement;
    fireEvent.keyDown(root, { key: 'P', ctrlKey: true, shiftKey: true });

    const palette = await waitFor(() => {
      const node = document.querySelector('.code__palette');
      expect(node).toBeTruthy();
      return node as HTMLElement;
    }, { timeout: 3000 });

    expect(palette.getAttribute('aria-label')).toBe('Editor commands');
    const items = Array.from(palette.querySelectorAll('.code__palette-item')).map((node) => node.textContent ?? '');
    expect(items.length).toBeGreaterThan(0);
    expect(items.join(' ')).toMatch(/Format document/);
    expect(items.join(' ')).toMatch(/Save/);
  });
});
