import { describe, expect, it } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import App from '@/app/App';
import { Desktop } from '@/components/desktop/Desktop';
import { useWindows } from '@/core/window-manager/windowsStore';
import { APP_COMPONENTS } from '@/core/apps/registry';
import { APP_META } from '@/core/apps/appMeta';
import type { AppId } from '@/types';

function fakeWindow(appId: AppId) {
  return {
    id: `win-${appId}`,
    appId,
    title: APP_META[appId].name,
    x: 40,
    y: 40,
    width: 900,
    height: 600,
    zIndex: 10,
    minimized: false,
    maximized: false,
    createdAt: Date.now(),
  };
}

describe('boot → login → desktop', () => {
  it('skips the boot splash, signs in and reveals the desktop', async () => {
    const user = userEvent.setup();
    render(<App />);

    expect(screen.getByText(/Web Desktop Simulator/i, { selector: '.boot__tagline' })).toBeTruthy();

    await user.click(screen.getByRole('button', { name: /skip/i }));

    await waitFor(() => expect(document.querySelector('.login')).toBeTruthy(), { timeout: 4000 });

    const submit = document.querySelector('.login__submit') as HTMLButtonElement;
    expect(submit).toBeTruthy();
    await user.click(submit);

    await waitFor(() => expect(document.querySelector('.desktop')).toBeTruthy(), { timeout: 4000 });
    await waitFor(() => expect(document.querySelector('.panel')).toBeTruthy());

    /* Welcome window is restored on first login. */
    await waitFor(() => expect(useWindows.getState().windows.some((win) => win.appId === 'welcome')).toBe(true));
  }, 20000);
});

describe('desktop shell', () => {
  it('opens the applications menu and launches an app', async () => {
    const user = userEvent.setup();
    render(<Desktop onLock={() => {}} onShutdown={() => {}} onRestart={() => {}} />);

    const menuButton = document.querySelector('.panel__button') as HTMLElement;
    expect(menuButton).toBeTruthy();
    await user.click(menuButton);

    await waitFor(() => expect(document.querySelector('.appmenu')).toBeTruthy());
    const search = document.querySelector('.appmenu input') as HTMLInputElement;
    expect(search).toBeTruthy();
    await user.type(search, 'calc');

    await waitFor(() => expect(document.querySelectorAll('.app-tile-btn').length).toBeGreaterThan(0));
    const tile = document.querySelector('.app-tile-btn') as HTMLElement;
    await user.click(tile);

    await waitFor(() => expect(useWindows.getState().windows.length).toBeGreaterThan(0));
  }, 20000);

  it('can open quick settings and the notification centre', async () => {
    const user = userEvent.setup();
    render(<Desktop onLock={() => {}} onShutdown={() => {}} onRestart={() => {}} />);

    const trayButtons = Array.from(document.querySelectorAll('.panel__tray-btn')) as HTMLElement[];
    expect(trayButtons.length).toBeGreaterThan(0);
    await user.click(trayButtons[0]);
    await waitFor(() => expect(document.querySelector('.popover')).toBeTruthy());
  }, 20000);
});

describe('every registered app renders', () => {
  const cases = Object.keys(APP_COMPONENTS) as AppId[];

  for (const appId of cases) {
    it(`renders ${appId}`, async () => {
      const Component = APP_COMPONENTS[appId];
      const win = fakeWindow(appId);
      const { unmount } = render(<Component win={win} />);
      await waitFor(() => expect(document.body.textContent?.length ?? 0).toBeGreaterThan(0));
      unmount();
    });
  }
});
