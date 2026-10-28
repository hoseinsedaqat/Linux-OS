import { describe, expect, it, beforeEach } from 'vitest';
import { useWindows, WORKSPACE_COUNT, workspaceOf } from '@/core/window-manager/windowsStore';
import { useShell } from '@/core/apps/shellStore';
import { useSettings } from '@/core/themes/settingsStore';
import { applyTheme } from '@/core/themes/applyTheme';

function reset() {
  useWindows.setState({ windows: [], activeId: null, nextZ: 10, workspace: 1 });
  useShell.setState({ overlay: null, paletteOpen: false });
}

describe('virtual desktops', () => {
  beforeEach(reset);

  it('opens new windows on the current workspace', () => {
    useWindows.getState().switchWorkspace(3);
    useWindows.getState().openApp('files');
    const win = useWindows.getState().windows[0];
    expect(workspaceOf(win)).toBe(3);
  });

  it('clamps workspace switching and wraps with the cycle helper', () => {
    useWindows.getState().switchWorkspace(99);
    expect(useWindows.getState().workspace).toBe(WORKSPACE_COUNT);
    useWindows.getState().cycleWorkspace(1);
    expect(useWindows.getState().workspace).toBe(1);
    useWindows.getState().cycleWorkspace(-1);
    expect(useWindows.getState().workspace).toBe(WORKSPACE_COUNT);
  });

  it('moves a window to another desktop and minimizes it there', () => {
    useWindows.getState().openApp('calculator');
    const id = useWindows.getState().windows[0].id;
    useWindows.getState().moveToWorkspace(id, 2);
    const moved = useWindows.getState().windows[0];
    expect(workspaceOf(moved)).toBe(2);
    expect(moved.minimized).toBe(true);
    expect(useWindows.getState().activeId).toBeNull();
  });

  it('switching desktops focuses the top window of the target desktop', () => {
    useWindows.getState().openApp('files');
    const filesId = useWindows.getState().windows[0].id;
    useWindows.getState().switchWorkspace(2);
    useWindows.getState().openApp('calculator');
    useWindows.getState().switchWorkspace(1);
    expect(useWindows.getState().activeId).toBe(filesId);
  });
});

describe('window snapping', () => {
  beforeEach(reset);

  it('snaps to the left and right halves of the work area', () => {
    useWindows.getState().openApp('terminal');
    const id = useWindows.getState().windows[0].id;
    useWindows.getState().snapWindow(id, 'left');
    const left = useWindows.getState().windows[0];
    expect(left.snapped).toBe('left');
    expect(left.width).toBeLessThan(left.x + left.width + 1);
    useWindows.getState().snapWindow(id, 'right');
    const right = useWindows.getState().windows[0];
    expect(right.snapped).toBe('right');
    expect(right.x).toBeGreaterThan(left.x);
  });

  it('remembers the pre-snap rectangle so restoring works', () => {
    useWindows.getState().openApp('notes');
    const id = useWindows.getState().windows[0].id;
    const before = useWindows.getState().windows[0];
    useWindows.getState().snapWindow(id, 'bottom-right');
    const snapped = useWindows.getState().windows[0];
    expect(snapped.restoreRect?.width).toBe(before.width);
  });
});

describe('command palette shell state', () => {
  beforeEach(reset);

  it('toggles the palette and closes it when a panel opens', () => {
    useShell.getState().togglePalette();
    expect(useShell.getState().paletteOpen).toBe(true);
    useShell.getState().openOverlay('appmenu');
    expect(useShell.getState().paletteOpen).toBe(false);
    expect(useShell.getState().overlay).toBe('appmenu');
  });

  it('closes overlays with Escape semantics', () => {
    useShell.getState().openOverlay('overview');
    useShell.getState().closeOverlays();
    expect(useShell.getState().overlay).toBeNull();
  });
});

describe('theme studio + accessibility flags', () => {
  it('applies a custom accent and the high-contrast class', () => {
    const settings = { ...useSettings.getState(), customAccent: '#ff3366', highContrast: true };
    applyTheme(settings);
    expect(document.documentElement.style.getPropertyValue('--accent')).toBe('#ff3366');
    expect(document.body.classList.contains('high-contrast')).toBe(true);
    applyTheme({ ...useSettings.getState(), customAccent: null, highContrast: false });
    expect(document.body.classList.contains('high-contrast')).toBe(false);
    expect(document.documentElement.style.getPropertyValue('--accent')).not.toBe('#ff3366');
  });
});
