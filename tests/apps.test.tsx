import { beforeEach, describe, expect, it } from 'vitest';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { APP_META } from '@/core/apps/appMeta';
import type { AppId } from '@/types';
import { useFiles } from '@/core/virtual-filesystem/fsStore';
import { findByPath, HOME_PATH } from '@/core/virtual-filesystem/fsUtils';
import { useSettings } from '@/core/themes/settingsStore';
import { useNotifications } from '@/core/notifications/notificationsStore';
import { resetToSample, accountingStore } from '@/apps/accounting/accountingStore';
import { TerminalApp } from '@/apps/terminal/TerminalApp';
import { NotesApp } from '@/apps/notes/NotesApp';
import { FilesApp } from '@/apps/files/FilesApp';
import { AccountingApp } from '@/apps/accounting/AccountingApp';
import { SettingsApp } from '@/apps/settings/SettingsApp';

function win(appId: AppId, payload?: Record<string, unknown>) {
  return {
    id: `win-${appId}`,
    appId,
    title: APP_META[appId].name,
    x: 40,
    y: 40,
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
  resetToSample();
});

describe('terminal', () => {
  it('runs simulated commands over the virtual file system only', async () => {
    const user = userEvent.setup();
    render(<TerminalApp win={win('terminal')} />);

    const input = screen.getByLabelText('Terminal command') as HTMLInputElement;

    await user.type(input, 'pwd{Enter}');
    await waitFor(() => expect(document.querySelector('.terminal__screen')?.textContent).toContain('/home/demo'));

    await user.type(input, 'ls{Enter}');
    await waitFor(() => expect(document.querySelector('.terminal__screen')?.textContent).toContain('Documents'));

    await user.type(input, 'sudo rm -rf /{Enter}');
    await waitFor(() =>
      expect(document.querySelector('.terminal__screen')?.textContent?.toLowerCase()).toContain('sudo'),
    );

    await user.type(input, 'help{Enter}');
    await waitFor(() => expect(document.querySelector('.terminal__screen')?.textContent).toContain('neofetch'));
  }, 20000);
});

describe('notes', () => {
  it('creates a note, autosaves and exposes it in the list', async () => {
    const user = userEvent.setup();
    render(<NotesApp win={win('notes')} />);

    const createButton = Array.from(document.querySelectorAll('button')).find((button) =>
      /new note|create note/i.test(button.textContent ?? ''),
    );
    expect(createButton).toBeTruthy();
    await user.click(createButton!);

    const title = screen.getByLabelText('Note title') as HTMLInputElement;
    await user.type(title, 'Test note title');
    const body = document.querySelector('.notes__body') as HTMLTextAreaElement;
    expect(body).toBeTruthy();
    fireEvent.change(body, { target: { value: 'Body line one' } });

    await waitFor(() => {
      const nodes = useFiles.getState().nodes;
      const saved = Object.values(nodes).find((node) => node.kind === 'note' && node.name.includes('Test note title'));
      expect(saved).toBeTruthy();
    });
  }, 20000);
});

describe('files', () => {
  it('creates a folder through the prompt dialog', async () => {
    const user = userEvent.setup();
    render(<FilesApp win={win('files', { folderPath: `${HOME_PATH}/Documents` })} />);

    await waitFor(() => expect(document.querySelector('.files__main')).toBeTruthy());

    await user.click(screen.getByRole('button', { name: /^new$/i }));
    const newFolder = await waitFor(() => {
      const item = Array.from(document.querySelectorAll('.context-menu__item')).find((button) =>
        /new folder/i.test(button.textContent ?? ''),
      ) as HTMLElement;
      if (!item) throw new Error('New Folder entry is missing');
      return item;
    });
    await user.click(newFolder);

    const dialogInput = await waitFor(() => {
      const input = document.querySelector('.modal input') as HTMLInputElement;
      expect(input).toBeTruthy();
      return input;
    });

    await user.clear(dialogInput);
    await user.type(dialogInput, 'QA Folder');

    const submit = Array.from(document.querySelectorAll('.modal button')).find((button) =>
      /^(ok|create)$/i.test(button.textContent?.trim() ?? ''),
    ) as HTMLButtonElement;
    expect(submit).toBeTruthy();
    await user.click(submit);

    await waitFor(() => {
      const docs = findByPath(useFiles.getState().nodes, `${HOME_PATH}/Documents`)!;
      const created = Object.values(useFiles.getState().nodes).find(
        (node) => node.name === 'QA Folder' && node.parentId === docs.id,
      );
      if (!created) throw new Error('folder was not created');
      return created;
    });
  }, 20000);
});

describe('accounting', () => {
  it('shows seeded customers and adds a new one', async () => {
    const user = userEvent.setup();
    render(<AccountingApp win={win('accounting', { tab: 'customers' })} />);

    await waitFor(() => expect(document.body.textContent).toContain('شرکت آفتاب نوین'));

    const addButton = screen.getAllByRole('button', { name: 'مشتری جدید' })[0];
    await user.click(addButton);

    const nameInput = document.querySelector('.modal .input') as HTMLInputElement;
    await waitFor(() => expect(nameInput).toBeTruthy());
    await user.type(nameInput, 'مشتری تست');
    const phone = document.querySelectorAll('.modal .input')[1] as HTMLInputElement;
    await user.type(phone, '09120000000');

    const save = Array.from(document.querySelectorAll('.modal button')).find((button) =>
      button.textContent?.includes('ذخیره'),
    ) as HTMLButtonElement;
    await user.click(save);

    await waitFor(() => {
      const data = accountingStore.get();
      expect(data.parties.customers.some((party) => party.name === 'مشتری تست')).toBe(true);
    });
  }, 20000);

  it('rejects a customer without a name', async () => {
    const user = userEvent.setup();
    render(<AccountingApp win={win('accounting', { tab: 'customers' })} />);
    await waitFor(() => expect(document.body.textContent).toContain('شرکت آفتاب نوین'));

    await user.click(screen.getAllByRole('button', { name: 'مشتری جدید' })[0]);
    const save = Array.from(document.querySelectorAll('.modal button')).find((button) =>
      button.textContent?.includes('ذخیره'),
    ) as HTMLButtonElement;
    await user.click(save);

    await waitFor(() => expect(useNotifications.getState().items.some((item) => item.body === 'نام را وارد کنید.')).toBe(true));
    expect(document.querySelector('.modal')).toBeTruthy();
    expect(accountingStore.get().parties.customers.some((party) => party.name === '')).toBe(false);
  }, 20000);
});

describe('settings', () => {
  it('switches the language to Persian', async () => {
    const user = userEvent.setup();
    render(<SettingsApp win={win('settings')} />);

    await waitFor(() => expect(document.body.textContent).toMatch(/appearance/i));

    const languageNav = screen.getAllByRole('button').find((button) => button.textContent?.trim() === 'Language');
    expect(languageNav).toBeTruthy();
    await user.click(languageNav!);

    const persian = await waitFor(() => {
      const button = Array.from(document.querySelectorAll('.segmented__item')).find((item) =>
        item.textContent?.includes('فارسی'),
      ) as HTMLElement;
      if (!button) throw new Error('Persian option missing');
      return button;
    });
    await user.click(persian);
    await waitFor(() => expect(useSettings.getState().language).toBe('fa'));
  }, 20000);

  it('toggles reduced motion from accessibility', async () => {
    const user = userEvent.setup();
    render(<SettingsApp win={win('settings', { section: 'accessibility' })} />);

    const toggle = await waitFor(() => {
      const element = document.querySelector('.switch[aria-label="Reduce motion"]') as HTMLElement | null;
      if (!element) throw new Error('Reduce motion switch missing');
      return element;
    });
    await user.click(toggle);
    await waitFor(() => expect(useSettings.getState().reduceMotion).toBe(true));
  }, 20000);
});
