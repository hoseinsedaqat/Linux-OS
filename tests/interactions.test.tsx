import { beforeEach, describe, expect, it } from 'vitest';
import { render, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { AppId } from '@/types';
import { APP_META } from '@/core/apps/appMeta';
import { useFiles } from '@/core/virtual-filesystem/fsStore';
import { useLauncher } from '@/core/apps/launcherStore';
import { useNotifications } from '@/core/notifications/notificationsStore';
import { useSettings } from '@/core/themes/settingsStore';
import { AccountingApp } from '@/apps/accounting/AccountingApp';
import { ACCOUNTING_TAB_KEYS } from '@/apps/accounting/AccountingPages';
import { resetToSample } from '@/apps/accounting/accountingStore';
import { SettingsApp } from '@/apps/settings/SettingsApp';
import { CalculatorApp } from '@/apps/calculator/CalculatorApp';
import { BrowserApp } from '@/apps/browser/BrowserApp';
import { SoftwareCenterApp } from '@/apps/software-center/SoftwareCenterApp';
import { CalendarApp } from '@/apps/calendar/CalendarApp';
import { FilesApp } from '@/apps/files/FilesApp';
import { HOME_PATH, childrenOf, findByPath } from '@/core/virtual-filesystem/fsUtils';

function win(appId: AppId, payload?: Record<string, unknown>) {
  return {
    id: `win-${appId}`,
    appId,
    title: APP_META[appId].name,
    x: 30,
    y: 30,
    width: 900,
    height: 620,
    zIndex: 12,
    minimized: false,
    maximized: false,
    createdAt: Date.now(),
    payload,
  } as never;
}

beforeEach(async () => {
  await useFiles.getState().init();
});

describe('accounting pages', () => {
  for (const tab of ACCOUNTING_TAB_KEYS) {
    it(`renders the ${tab} tab`, async () => {
      resetToSample();
      const { unmount } = render(<AccountingApp win={win('accounting', { tab })} />);
      await waitFor(() => expect(document.querySelector('.acc-main')).toBeTruthy());
      expect((document.querySelector('.acc-main')?.textContent ?? '').length).toBeGreaterThan(0);
      unmount();
    }, 20000);
  }
});

describe('settings sections', () => {
  const sections = ['appearance', 'desktop', 'display', 'brightness', 'wallpapers', 'fonts', 'keyboard', 'language', 'datetime', 'notifications', 'storage', 'privacy', 'accessibility', 'about'];
  for (const section of sections) {
    it(`renders the ${section} section`, async () => {
      const { unmount } = render(<SettingsApp win={win('settings', { section })} />);
      await waitFor(() => expect(document.querySelector('.settings-app__content')).toBeTruthy());
      expect((document.querySelector('.settings-app__content')?.textContent ?? '').length).toBeGreaterThan(20);
      unmount();
    }, 20000);
  }
});

describe('calculator', () => {
  it('evaluates a chain of button presses', async () => {
    const user = userEvent.setup();
    render(<CalculatorApp win={win('calculator')} />);
    for (const label of ['7', 'Multiply', '8', 'Equals']) {
      const button = Array.from(document.querySelectorAll('.calc-key')).find(
        (element) => (element.getAttribute('aria-label') ?? '') === label,
      ) as HTMLElement;
      expect(button).toBeTruthy();
      await user.click(button);
    }
    await waitFor(() => expect(document.querySelector('.calculator__result')?.textContent).toContain('56'));
  }, 20000);
});

describe('browser', () => {
  it('opens a new tab and blocks unsupported navigation honestly', async () => {
    const user = userEvent.setup();
    render(<BrowserApp win={win('browser')} />);

    const address = document.querySelector('.browser__address input') as HTMLInputElement;
    expect(address).toBeTruthy();
    await user.type(address, 'example.com{Enter}');

    await waitFor(() => {
      const text = document.body.textContent ?? '';
      expect(text).toMatch(/blocks embedding|blank/i);
    });

    expect(document.querySelector('.browser__frame')).toBeTruthy();

    /* A known iframe-hostile host shows the explicit blocked screen. */
    await user.clear(address);
    await user.type(address, 'youtube.com{Enter}');
    await waitFor(() => expect(document.body.textContent).toContain('This site cannot be embedded'));
    expect(document.querySelector('.browser__blocked')).toBeTruthy();
  }, 20000);
});

describe('software center', () => {
  it('installs and removes a simulator app', async () => {
    const user = userEvent.setup();
    // Start from a known state: remove Impress.
    useLauncher.getState().uninstall('impress');
    expect(useLauncher.getState().installed.includes('impress')).toBe(false);

    render(<SoftwareCenterApp win={win('software')} />);

    const item = await waitFor(() => {
      const element = Array.from(document.querySelectorAll('.software__item')).find((node) =>
        /impress/i.test(node.textContent ?? ''),
      ) as HTMLElement;
      if (!element) throw new Error('Impress missing from the catalogue');
      return element;
    });
    await user.click(item);

    const action = await waitFor(() => {
      const button = Array.from(document.querySelectorAll('.software__detail button')).find((element) =>
        /install/i.test(element.textContent ?? ''),
      ) as HTMLButtonElement;
      if (!button) throw new Error('install button missing');
      return button;
    });
    await user.click(action);

    await waitFor(() => expect(useLauncher.getState().installed.includes('impress')).toBe(true));
    expect(useNotifications.getState().items.length).toBeGreaterThan(0);
  }, 20000);
});

describe('calendar', () => {
  it('adds an event for the selected day', async () => {
    const user = userEvent.setup();
    render(<CalendarApp win={win('calendar')} />);

    const title = await waitFor(() => {
      const input = document.querySelector('.calendar-app__form input') as HTMLInputElement;
      if (!input) throw new Error('event form missing');
      return input;
    });
    await user.type(title, 'Design review');

    const add = Array.from(document.querySelectorAll('.calendar-app__form button')).find((button) =>
      /add|save|ذخیره|افزودن/i.test(button.textContent ?? ''),
    ) as HTMLButtonElement;
    expect(add).toBeTruthy();
    await user.click(add);

    await waitFor(() => expect(document.body.textContent).toContain('Design review'));
  }, 20000);
});

describe('trash', () => {
  it('restores a trashed file from the trash view', async () => {
    const user = userEvent.setup();
    const docs = findByPath(useFiles.getState().nodes, `${HOME_PATH}/Documents`)!;
    const created = useFiles.getState().createFile(docs.id, 'Trash me.txt', { content: 'bye' })!;
    useFiles.getState().trashNode(created.id);
    expect(useFiles.getState().nodes[created.id].trashed).toBe(true);

    render(<FilesApp win={win('trash')} />);
    await waitFor(() => expect(document.body.textContent).toContain('Trash me.txt'));

    const row = await waitFor(() => {
      const element = Array.from(document.querySelectorAll('.files__item')).find((node) =>
        /Trash me\.txt/.test(node.textContent ?? ''),
      ) as HTMLElement;
      if (!element) throw new Error('trashed item missing');
      return element;
    });
    await user.click(row);

    const info = await waitFor(() => {
      const button = Array.from(document.querySelectorAll('button')).find((element) =>
        /restore/i.test(element.textContent ?? ''),
      ) as HTMLButtonElement;
      if (!button) throw new Error('restore button missing');
      return button;
    });
    await user.click(info);

    await waitFor(() => expect(useFiles.getState().nodes[created.id].trashed).toBe(false));
    expect(childrenOf(useFiles.getState().nodes, docs.id).some((node) => node.id === created.id)).toBe(true);
  }, 20000);
});

describe('appearance', () => {
  it('stores the accent and theme preference', async () => {
    useSettings.getState().set('accent', 'violet');
    useSettings.getState().set('theme', 'light');
    await waitFor(() => expect(useSettings.getState().accent).toBe('violet'));
    expect(useSettings.getState().theme).toBe('light');
    const stored = localStorage.getItem('nova-linux.settings.v1');
    expect(stored).toContain('violet');
  });
});
