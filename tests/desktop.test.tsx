import { readFileSync } from 'node:fs';
import { beforeEach, describe, expect, it } from 'vitest';
import { fireEvent, render, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Desktop } from '@/components/desktop/Desktop';
import { QuickSettings } from '@/components/quick-settings/QuickSettings';
import { useFiles } from '@/core/virtual-filesystem/fsStore';
import { useLauncher, DEFAULT_DESKTOP_APPS } from '@/core/apps/launcherStore';
import { useSettings } from '@/core/themes/settingsStore';
import { useOsd } from '@/core/apps/osdStore';
import { FOLDER_IDS, childrenOf } from '@/core/virtual-filesystem/fsUtils';
import { APP_META } from '@/core/apps/appMeta';
import type { AppId } from '@/types';

function desktop() {
  return render(<Desktop onLock={() => {}} onShutdown={() => {}} onRestart={() => {}} />);
}

function iconLabels(): string[] {
  return Array.from(document.querySelectorAll('.desktop__icons .desktop-icon__label')).map(
    (node) => node.textContent ?? '',
  );
}

beforeEach(async () => {
  await useFiles.getState().init();
  useLauncher.setState({
    desktopApps: DEFAULT_DESKTOP_APPS,
    installed: (Object.keys(APP_META) as AppId[]).filter((id) => APP_META[id].installed),
    favorites: (Object.keys(APP_META) as AppId[]).filter((id) => APP_META[id].pinned),
  });
  sessionStorage.setItem('nova.introShown', '1');
  sessionStorage.setItem('nova.welcomed', '1');
});

describe('desktop icons', () => {
  it('shows an icon for every launcher app instead of an empty desktop', async () => {
    desktop();
    await waitFor(() => expect(document.querySelectorAll('.desktop__icons .desktop-icon').length).toBeGreaterThan(10));
    const labels = iconLabels();
    for (const name of ['Files', 'Browser', 'Writer', 'Calc', 'Terminal', 'Calculator', 'Calendar', 'Trash', 'Settings']) {
      expect(labels).toContain(name);
    }
  });

  it('stacks icons in columns that grow to the right', () => {
    // jsdom does not evaluate stylesheets, so guard the layout contract directly.
    const css = readFileSync('src/styles/shell.css', 'utf8');
    expect(css).toMatch(/\.desktop__icons\s*\{[^}]*flex-direction:\s*column[^}]*flex-wrap:\s*wrap/);
    const iconRule = /\.desktop-icon\s*\{([^}]*)\}/.exec(css)?.[1] ?? '';
    expect(iconRule).toContain('width: 94px');
    expect(iconRule).toContain('height: 100px');
    // The icon surface needs a real height: a flex canvas gives it one.
    expect(css).toMatch(/\.desktop__canvas\s*\{[^}]*display:\s*flex[^}]*flex-direction:\s*column/);
    expect(css).toMatch(/\.desktop__surface\s*\{[^}]*flex:\s*1/);
  });

  it('never covers the desktop with a full-screen loading scrim', () => {
    const css = readFileSync('src/styles/apps.css', 'utf8');
    const block = /\.desktop__loading\s*\{([^}]*)\}/.exec(css)?.[1] ?? '';
    expect(block).not.toMatch(/inset:\s*0/);
    expect(block).toContain('border-radius: 999px');
  });

  it('adds an app shortcut from the desktop context menu', async () => {
    const user = userEvent.setup();
    useLauncher.setState({ desktopApps: ['files'] });
    desktop();
    await waitFor(() => expect(iconLabels()).toContain('Files'));

    fireEvent.contextMenu(document.querySelector('.desktop') as Element);
    const addEntry = await waitFor(() => {
      const node = Array.from(document.querySelectorAll('.context-menu__item')).find((item) =>
        (item.textContent ?? '').includes('Add app shortcut'),
      );
      if (!node) throw new Error('Add app shortcut entry missing');
      return node as HTMLElement;
    });
    await user.click(addEntry);

    await waitFor(() => expect(document.querySelector('.shortcut-dialog')).toBeTruthy());
    const row = Array.from(document.querySelectorAll('.shortcut-row')).find((item) =>
      (item.textContent ?? '').includes('Calculator'),
    ) as HTMLElement;
    expect(row).toBeTruthy();
    await user.click(row);

    await waitFor(() => expect(useLauncher.getState().desktopApps).toContain('calculator'));
    expect(iconLabels()).toContain('Calculator');
  });

  it('removes a desktop icon from its own context menu', async () => {
    const user = userEvent.setup();
    desktop();
    await waitFor(() => expect(iconLabels()).toContain('Writer'));

    const writerIcon = Array.from(document.querySelectorAll('.desktop-icon')).find(
      (icon) => icon.getAttribute('aria-label') === 'Writer',
    ) as HTMLElement;
    expect(writerIcon).toBeTruthy();
    fireEvent.contextMenu(writerIcon);
    const remove = await waitFor(() => {
      const node = Array.from(document.querySelectorAll('.context-menu__item')).find((item) =>
        (item.textContent ?? '').includes('Remove from Desktop'),
      );
      if (!node) throw new Error('Remove from Desktop entry missing');
      return node as HTMLElement;
    });
    await user.click(remove);
    await waitFor(() => expect(iconLabels()).not.toContain('Writer'));
  });
});

describe('creating files from the desktop', () => {
  it('shows a new document on the desktop immediately', async () => {
    const user = userEvent.setup();
    desktop();
    await waitFor(() => expect(document.querySelector('.desktop__icons')).toBeTruthy());

    fireEvent.contextMenu(document.querySelector('.desktop') as Element);
    const entry = await waitFor(() => {
      const node = Array.from(document.querySelectorAll('.context-menu__item')).find((item) =>
        (item.textContent ?? '').includes('New Document'),
      );
      if (!node) throw new Error('New Document entry missing');
      return node as HTMLElement;
    });
    await user.click(entry);

    await waitFor(() => {
      const files = childrenOf(useFiles.getState().nodes, FOLDER_IDS.desktop);
      expect(files.length).toBeGreaterThan(0);
    });

    const name = childrenOf(useFiles.getState().nodes, FOLDER_IDS.desktop)[0].name;
    await waitFor(() => expect(iconLabels()).toContain(name));
  });
});

describe('volume and brightness controls', () => {
  it('keeps the slider thumb, label and store value in sync', async () => {
    const { container } = render(
      <QuickSettings open style={{}} onClose={() => {}} onLock={() => {}} onShutdown={() => {}} onRestart={() => {}} />,
    );
    const sliders = Array.from(container.ownerDocument.querySelectorAll('.popover .slider')) as HTMLInputElement[];
    expect(sliders.length).toBeGreaterThanOrEqual(2);

    const volume = sliders[1];
    fireEvent.change(volume, { target: { value: '25' } });

    await waitFor(() => expect(useSettings.getState().volume).toBe(25));
    expect(volume.value).toBe('25');
    expect(volume.getAttribute('aria-valuetext')).toBe('25%');
    // the filled part of the track must follow the value, not stay at 50%
    expect((volume.getAttribute('style') ?? '').replace(/\s/g, '')).toContain('--slider-progress:25%');
  });

  it('mirrors a brightness change in the OSD', async () => {
    render(<Desktop onLock={() => {}} onShutdown={() => {}} onRestart={() => {}} />);
    await waitFor(() => expect(document.querySelector('.desktop__icons')).toBeTruthy());

    useSettings.getState().set('brightness', 40);
    await waitFor(() => expect(document.querySelector('.osd')).toBeTruthy());
    expect(document.querySelector('.osd')?.textContent).toContain('40%');
    expect((document.querySelector('.osd') as HTMLElement).dataset.kind).toBe('brightness');

    useOsd.getState().hide();
  });
});

describe('shell layout contracts (regression guards)', () => {
  const shell = readFileSync('src/styles/shell.css', 'utf8');
  const apps = readFileSync('src/styles/apps.css', 'utf8');

  it('keeps the application menu above its click-catcher backdrop', () => {
    // The full-screen backdrop once sat above the menu and swallowed every
    // hover and click, which made the power buttons unreachable.
    const source = readFileSync('src/components/start-menu/AppMenu.tsx', 'utf8');
    const backdropZ = Number(/zIndex:\s*(\d+)/.exec(source)?.[1] ?? 0);
    const menuZ = Number(/z-index:\s*(\d+)/.exec(/\.appmenu\s*\{([^}]*)\}/.exec(shell)?.[1] ?? '')?.[1] ?? 0);
    expect(backdropZ).toBeLessThan(menuZ);
  });

  it('clips quick-settings tile labels inside the tile', () => {
    const block = /\.qs__tile-text\s*\{([^}]*)\}/.exec(shell)?.[1] ?? '';
    expect(block).toContain('display: flex');
    expect(block).toContain('min-width: 0');
    expect(block).toContain('overflow: hidden');
    const sub = /\.qs__tile-sub\s*\{([^}]*)\}/.exec(shell)?.[1] ?? '';
    expect(sub).toContain('text-overflow: ellipsis');
  });

  it('makes the app root fill the window body', () => {
    const block = /\.window__body > \*\s*\{([^}]*)\}/.exec(shell)?.[1] ?? '';
    expect(block).toContain('flex: 1 1 auto');
    expect(block).toContain('min-width: 0');
  });

  it('keeps panel window titles on a single ellipsised line', () => {
    const block = /\.panel__window-btn > span\s*\{([^}]*)\}/.exec(shell)?.[1] ?? '';
    expect(block).toContain('text-overflow: ellipsis');
    expect(block).toContain('white-space: nowrap');
  });

  it('ships a poster-style boot screen', () => {
    expect(shell).toContain('.boot__spec');
    expect(shell).toContain('.boot__checks');
    expect(shell).toContain('.boot__scanlines');
    expect(shell).toContain('.boot__percent');
  });

  it('styles the intro overlay with a mark, ring and progress bar', () => {
    expect(shell).toContain('.session-intro__ring');
    expect(shell).toContain('.session-intro__wordmark');
    expect(shell).toContain('.session-intro__bar');
  });

  it('keeps the calculator usable at full window width', () => {
    const keys = /\.calculator__keys\s*\{([^}]*)\}/.exec(apps)?.[1] ?? '';
    expect(keys).toContain('grid-template-columns: repeat(4, 1fr)');
  });
});
