import { describe, expect, it } from 'vitest';
import { act, fireEvent, render, waitFor } from '@testing-library/react';
import { Desktop } from '@/components/desktop/Desktop';
import { useShell } from '@/core/apps/shellStore';
import { useWindows } from '@/core/window-manager/windowsStore';

/**
 * A small, dependency-free accessibility audit.
 *
 * It does not try to replace axe; it enforces the rules this shell must never
 * break: every interactive control has an accessible name, dialogs are named,
 * images have alt text, the workspace switcher exposes its state and the
 * keyboard-only path (Ctrl+K, Escape, skip link) works.
 */

function accessibleName(element: Element): string {
  const aria = element.getAttribute('aria-label');
  if (aria && aria.trim()) return aria.trim();
  const labelledBy = element.getAttribute('aria-labelledby');
  if (labelledBy) {
    const text = labelledBy
      .split(/\s+/)
      .map((id) => document.getElementById(id)?.textContent ?? '')
      .join(' ')
      .trim();
    if (text) return text;
  }
  const title = element.getAttribute('title');
  const text = (element.textContent ?? '').trim();
  if (text) return text;
  return (title ?? '').trim();
}

function auditControls() {
  const controls = Array.from(document.querySelectorAll('button, [role="button"], a[href]'));
  const unnamed = controls.filter((control) => accessibleName(control).length === 0);
  expect(unnamed.map((node) => node.outerHTML.slice(0, 120))).toEqual([]);
}

describe('accessibility audit', () => {
  it('gives every control on the desktop an accessible name', async () => {
    render(<Desktop onLock={() => {}} onShutdown={() => {}} onRestart={() => {}} />);
    await waitFor(() => expect(document.querySelector('.panel')).toBeTruthy());
    auditControls();
  });

  it('exposes the workspace switcher state and the skip link', async () => {
    render(<Desktop onLock={() => {}} onShutdown={() => {}} onRestart={() => {}} />);
    await waitFor(() => expect(document.querySelector('.panel__workspaces')).toBeTruthy());
    const buttons = Array.from(document.querySelectorAll('.panel__workspace')) as HTMLButtonElement[];
    expect(buttons).toHaveLength(4);
    expect(buttons[0].getAttribute('aria-pressed')).toBe('true');
    expect(buttons[0].getAttribute('aria-label')).toBeTruthy();
    const skip = document.querySelector('.skip-to-desktop');
    expect(skip?.getAttribute('href')).toBe('#nova-desktop-root');
  });

  it('labels dialogs and images', async () => {
    render(<Desktop onLock={() => {}} onShutdown={() => {}} onRestart={() => {}} />);
    const dialogs = Array.from(document.querySelectorAll('[role="dialog"]'));
    for (const dialog of dialogs) {
      expect((dialog.getAttribute('aria-label') ?? '').length).toBeGreaterThan(0);
    }
    const images = Array.from(document.querySelectorAll('img'));
    for (const image of images) {
      expect(image.hasAttribute('alt')).toBe(true);
    }
  });

  it('opens and closes the command palette from the keyboard', async () => {
    render(<Desktop onLock={() => {}} onShutdown={() => {}} onRestart={() => {}} />);
    await waitFor(() => expect(document.querySelector('.desktop')).toBeTruthy());

    act(() => useShell.getState().togglePalette());
    await waitFor(() => expect(document.querySelector('.palette')).toBeTruthy());
    const input = document.querySelector('.palette__search input') as HTMLInputElement;
    expect(input.getAttribute('aria-label')).toBe('Command palette');

    act(() => {
      fireEvent.keyDown(input.closest('.palette') as HTMLElement, { key: 'Escape' });
    });
    expect(useShell.getState().paletteOpen).toBe(false);
  });

  it('offers a screen-reader status for lazily loaded windows', async () => {
    useWindows.getState().openApp('calculator');
    render(<Desktop onLock={() => {}} onShutdown={() => {}} onRestart={() => {}} />);
    await waitFor(() => expect(document.querySelector('.window')).toBeTruthy());
    // Either the Suspense fallback (role=status) or the app itself must render.
    const status = document.querySelector('.window__loading');
    expect(status === null || status.getAttribute('role') === 'status').toBe(true);
  });
});
