import { beforeEach, describe, expect, it } from 'vitest';
import { fireEvent, render, waitFor } from '@testing-library/react';
import { Desktop } from '@/components/desktop/Desktop';
import { useWindows } from '@/core/window-manager/windowsStore';
import { useFiles } from '@/core/virtual-filesystem/fsStore';
import { useSettings } from '@/core/themes/settingsStore';
import {
  DEFAULT_DESKTOP_APPS,
  DEFAULT_FAVORITES,
  migrateLauncherState,
  useLauncher,
} from '@/core/apps/launcherStore';
import { Panel } from '@/components/taskbar/Panel';
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

describe('Code is reachable from the main screen', () => {
  it('is one of the first desktop icons, not buried at the bottom', async () => {
    desktop();
    await waitFor(() => expect(document.querySelectorAll('.desktop-icon').length).toBeGreaterThan(5));
    const labels = Array.from(document.querySelectorAll('.desktop__icons .desktop-icon__label')).map(
      (node) => node.textContent ?? '',
    );
    expect(labels[0]).toBe('Files');
    expect(labels.slice(0, 3)).toContain('Code');
    expect(labels.indexOf('Code')).toBeLessThan(4);
  });

  it('opens the editor on double-click', async () => {
    desktop();
    await waitFor(() => expect(document.querySelector('.desktop-icon[aria-label="Code"]')).toBeTruthy());
    const icon = document.querySelector('.desktop-icon[aria-label="Code"]') as HTMLElement;
    fireEvent.doubleClick(icon);
    await waitFor(() => expect(useWindows.getState().windows.some((win) => win.appId === 'code')).toBe(true));
  });

  it('sits inside the eight dock slots so the panel shows it', () => {
    expect(DEFAULT_DESKTOP_APPS.indexOf('code')).toBeLessThan(3);
    expect(DEFAULT_FAVORITES.indexOf('code')).toBeLessThan(8);
    expect(new Set(DEFAULT_FAVORITES).size).toBe(DEFAULT_FAVORITES.length);
  });

  it('renders a Code button in the panel dock', async () => {
    render(
      <Panel
        metrics={{
          viewportWidth: 1280,
          viewportHeight: 800,
          panelThickness: 54,
          workArea: { x: 0, y: 0, width: 1280, height: 746 },
          isMobile: false,
        }}
        onLock={() => {}}
        onShutdown={() => {}}
        onRestart={() => {}}
      />,
    );
    await waitFor(() => expect(document.querySelector('.panel')).toBeTruthy());
    const dockTitles = Array.from(document.querySelectorAll('.panel__button')).map((node) =>
      node.getAttribute('title'),
    );
    // The panel renders the first eight favourites; Code is in that set.
    expect(dockTitles).toContain('Code');
  });

  it('moves Code to the front when an older profile is migrated', () => {
    const v3 = {
      installed: ['files', 'browser', 'code', 'terminal'] as AppId[],
      favorites: ['files', 'browser', 'writer', 'calc', 'notes', 'accounting', 'games', 'code'] as AppId[],
      recent: [],
      desktopApps: ['files', 'browser', 'writer', 'code', 'settings'] as AppId[],
    };
    const migrated = migrateLauncherState(v3, 3);
    expect(migrated.desktopApps.indexOf('code')).toBe(1);
    expect(migrated.favorites.indexOf('code')).toBe(2);
    // everything else keeps its relative order
    expect(migrated.desktopApps.filter((id) => id !== 'code')).toEqual(['files', 'browser', 'writer', 'settings']);
    expect(migrated.desktopApps).toHaveLength(v3.desktopApps.length);
    expect(migrated.favorites).toHaveLength(v3.favorites.length);
  });

  it('adds Code when a pre-Code profile never had it', () => {
    const v2 = { installed: ['files'] as AppId[], favorites: ['files'] as AppId[], recent: [], desktopApps: ['files'] as AppId[] };
    const migrated = migrateLauncherState(v2, 2);
    expect(migrated.desktopApps).toEqual(['files', 'code']);
    expect(migrated.favorites).toEqual(['files', 'code']);
  });

  it('never runs on a current profile, so a removed icon stays removed', () => {
    const current = {
      installed: ['files'] as AppId[],
      favorites: ['files'] as AppId[],
      recent: [],
      desktopApps: ['files'] as AppId[],
    };
    const migrated = migrateLauncherState(current, 4);
    expect(migrated.desktopApps).toEqual(['files']);
    expect(migrated.favorites).toEqual(['files']);
  });
});

describe('typing in an app never triggers desktop shortcuts', () => {
  it('pressing Enter in the terminal runs the command instead of opening another terminal', async () => {
    desktop();
    await waitFor(() => expect(document.querySelector('.desktop-icon[aria-label="Terminal"]')).toBeTruthy());

    // Double-clicking the icon also selects it — the state that used to make the
    // desktop canvas treat every later Enter as "open the selected icon".
    fireEvent.click(document.querySelector('.desktop-icon[aria-label="Terminal"]') as HTMLElement);
    fireEvent.doubleClick(document.querySelector('.desktop-icon[aria-label="Terminal"]') as HTMLElement);

    const input = await waitFor(() => {
      const node = document.querySelector('.terminal__input') as HTMLInputElement | null;
      expect(node).toBeTruthy();
      return node!;
    });

    expect(useWindows.getState().windows.filter((win) => win.appId === 'terminal')).toHaveLength(1);

    fireEvent.change(input, { target: { value: 'ls' } });
    fireEvent.keyDown(input, { key: 'Enter' });

    // Still exactly one terminal window, and the command actually ran.
    expect(useWindows.getState().windows.filter((win) => win.appId === 'terminal')).toHaveLength(1);
    expect(useWindows.getState().windows).toHaveLength(1);
    const screen = document.querySelector('.terminal__screen')?.textContent ?? '';
    expect(screen).toContain('demo@nova:~$ ls');
    expect(screen).toContain('Desktop');
    expect(input.value).toBe('');
  });

  it('Delete and F2 inside a window do not act on the selected desktop icon', async () => {
    desktop();
    await waitFor(() => expect(document.querySelector('.desktop-icon[aria-label="Code"]')).toBeTruthy());
    fireEvent.click(document.querySelector('.desktop-icon[aria-label="Code"]') as HTMLElement);
    useWindows.getState().openApp('notes');

    const notesArea = await waitFor(() => {
      const node = document.querySelector('.notes, .notes-app, [data-app="notes"]') as HTMLElement | null;
      expect(node).toBeTruthy();
      return node!;
    });

    fireEvent.keyDown(notesArea, { key: 'Delete' });
    fireEvent.keyDown(notesArea, { key: 'F2' });

    // No rename dialog appeared and the Code icon is still on the desktop.
    expect(document.querySelector('.modal-scrim')).toBeNull();
    const labels = Array.from(document.querySelectorAll('.desktop__icon-label, .desktop-icon__label')).map(
      (node) => node.textContent,
    );
    expect(labels).toContain('Code');
  });
});

describe('terminal window identity', () => {
  it('opening the terminal twice keeps one window and focuses it', () => {
    desktop();
    const first = useWindows.getState().openApp('terminal');
    const second = useWindows.getState().openApp('terminal');

    expect(second).toBe(first);
    expect(useWindows.getState().windows.filter((win) => win.appId === 'terminal')).toHaveLength(1);
    expect(useWindows.getState().activeId).toBe(first);
  });

  it('still allows a deliberate second shell through forceNew or the footer button', async () => {
    desktop();
    useWindows.getState().openApp('terminal');
    const explicit = useWindows.getState().openApp('terminal', undefined, { forceNew: true });
    expect(useWindows.getState().windows.filter((win) => win.appId === 'terminal')).toHaveLength(2);
    expect(explicit).not.toBe(useWindows.getState().windows[0].id);

    // The footer offers the same thing without hidden menus.
    useWindows.setState({ windows: [], activeId: null, nextZ: 10, workspace: 1 });
    useWindows.getState().openApp('terminal');
    const button = await waitFor(() => {
      const node = document.querySelector('.terminal__new') as HTMLElement | null;
      expect(node).toBeTruthy();
      return node!;
    });
    fireEvent.click(button);
    await waitFor(() =>
      expect(useWindows.getState().windows.filter((win) => win.appId === 'terminal')).toHaveLength(2),
    );
  });

  it('the prompt swallows Enter so nothing outside the shell reacts to it', async () => {
    desktop();
    useWindows.getState().openApp('terminal');
    const input = await waitFor(() => {
      const node = document.querySelector('.terminal__input') as HTMLInputElement | null;
      expect(node).toBeTruthy();
      return node!;
    });

    const before = useWindows.getState().windows.length;
    const notCancelled = fireEvent.keyDown(input, { key: 'Enter' });
    expect(notCancelled).toBe(false); // preventDefault was called
    expect(useWindows.getState().windows).toHaveLength(before);
  });
});

describe('launch buttons hand the keyboard to the window', () => {
  it('a dock launch is not left focused, so Enter cannot relaunch it', async () => {
    desktop();
    const button = await waitFor(() => {
      const node = Array.from(document.querySelectorAll('.panel__button')).find(
        (item) => item.getAttribute('title') === 'Files',
      ) as HTMLElement | undefined;
      expect(node).toBeTruthy();
      return node!;
    });

    button.focus();
    expect(document.activeElement).toBe(button);
    fireEvent.click(button);

    expect(useWindows.getState().windows.filter((win) => win.appId === 'files')).toHaveLength(1);
    expect(document.activeElement).not.toBe(button);
  });

  it('double-clicking a desktop icon releases the icon', async () => {
    desktop();
    const icon = await waitFor(() => {
      const node = document.querySelector('.desktop-icon[aria-label="Code"]') as HTMLElement | null;
      expect(node).toBeTruthy();
      return node!;
    });

    icon.focus();
    fireEvent.doubleClick(icon);
    expect(document.activeElement).not.toBe(icon);
    expect(useWindows.getState().windows.some((win) => win.appId === 'code')).toBe(true);
  });
});
