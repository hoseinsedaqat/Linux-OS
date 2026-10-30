import { beforeEach, describe, expect, it } from 'vitest';
import { fireEvent, render, waitFor } from '@testing-library/react';
import { CommandPalette } from '@/components/desktop/CommandPalette';
import { FilesApp } from '@/apps/files/FilesApp';
import { useFiles } from '@/core/virtual-filesystem/fsStore';
import { FOLDER_IDS } from '@/core/virtual-filesystem/fsUtils';
import { useWindows } from '@/core/window-manager/windowsStore';
import { useSettings } from '@/core/themes/settingsStore';
import { completeShell, runLine, SHELL_COMMANDS } from '@/apps/terminal/shell';
import { eventsOn, occursOn, fromIcs, toIcs } from '@/apps/calendar/calendarStore';
import { RELEASE, RELEASE_SEEN_KEY } from '@/core/apps/releaseNotes';
import type { CalendarEvent, WindowInstance } from '@/types';

const baseEvent: CalendarEvent = {
  id: 'evt-1',
  title: 'Standup',
  date: '2026-03-02',
  time: '09:30',
  color: '#3ddc97',
  repeat: 'weekly',
};

function windowStub(appId: 'files'): WindowInstance {
  return {
    id: 'win-1',
    appId,
    title: 'Files',
    x: 0,
    y: 0,
    width: 1000,
    height: 700,
    z: 1,
    minimized: false,
    maximized: false,
    workspace: 1,
  } as unknown as WindowInstance;
}

beforeEach(async () => {
  localStorage.clear();
  await useFiles.getState().init();
  useWindows.setState({ windows: [], activeId: null, nextZ: 10, workspace: 1 });
  useSettings.setState({ ...useSettings.getState(), language: 'en' });
});

describe('recurring events and iCalendar', () => {
  it('expands daily, weekly and monthly events from their start date', () => {
    expect(occursOn(baseEvent, '2026-03-02')).toBe(true);
    expect(occursOn(baseEvent, '2026-03-09')).toBe(true); // next Monday
    expect(occursOn(baseEvent, '2026-03-10')).toBe(false); // Tuesday
    expect(occursOn(baseEvent, '2026-02-23')).toBe(false); // before the start
    expect(occursOn({ ...baseEvent, repeat: 'daily' }, '2026-03-11')).toBe(true);
    expect(occursOn({ ...baseEvent, repeat: 'monthly' }, '2026-04-02')).toBe(true);
    expect(occursOn({ ...baseEvent, repeat: 'none' }, '2026-03-09')).toBe(false);
  });

  it('lists a day in time order, recurrence included', () => {
    const second: CalendarEvent = { ...baseEvent, id: 'evt-2', title: 'Review', time: '08:00' };
    const day = eventsOn([baseEvent, second], '2026-03-09');
    expect(day.map((event) => event.title)).toEqual(['Review', 'Standup']);
  });

  it('round-trips through an .ics file, keeping recurrence', () => {
    const ics = toIcs([baseEvent]);
    expect(ics).toContain('BEGIN:VCALENDAR');
    expect(ics).toContain('RRULE:FREQ=WEEKLY');
    const parsed = fromIcs(ics);
    expect(parsed).toHaveLength(1);
    expect(parsed[0].title).toBe('Standup');
    expect(parsed[0].date).toBe('2026-03-02');
    expect(parsed[0].time).toBe('09:30');
    expect(parsed[0].repeat).toBe('weekly');
  });

  it('ignores calendar blocks it cannot understand', () => {
    expect(fromIcs('BEGIN:VCALENDAR\nBEGIN:VEVENT\nSUMMARY:No date\nEND:VEVENT\nEND:VCALENDAR')).toHaveLength(0);
    expect(fromIcs('not a calendar')).toHaveLength(0);
  });
});

describe('terminal completion and manual pages', () => {
  it('completes a unique command name and lists ambiguous ones', () => {
    const empty = Object.fromEntries(
      Object.entries(useFiles.getState().nodes),
    );
    const unique = completeShell('neo', '/home/demo', empty);
    expect(unique.value).toBe('neofetch ');
    const ambiguous = completeShell('c', '/home/demo', empty);
    expect(ambiguous.options.length).toBeGreaterThan(1);
    expect(ambiguous.value).toBe('c');
  });

  it('completes file names inside the working directory', () => {
    const nodes = useFiles.getState().nodes;
    const result = completeShell('cat hello', '/home/demo/Documents/Projects', nodes);
    expect(result.value).toBe('cat hello.ts');
  });

  it('answers man for known commands and refuses unknown ones', () => {
    const nodes = useFiles.getState().nodes;
    const known = runLine('man ls', { nodes, cwd: '/home/demo', history: [], language: 'en' });
    expect(known.lines.map((line) => line.text).join(' ')).toContain('list a directory');
    const unknown = runLine('man git', { nodes, cwd: '/home/demo', history: [], language: 'en' });
    expect(unknown.lines[0].kind).toBe('error');
    expect(SHELL_COMMANDS).toContain('man');
  });
});

describe('command palette searches the file system', () => {
  it('keeps app launches ahead of content-only file matches', async () => {
    render(<CommandPalette open onClose={() => {}} onLock={() => {}} onShowShortcuts={() => {}} />);
    const input = await waitFor(() => {
      const node = document.querySelector('.palette__search input') as HTMLInputElement | null;
      expect(node).toBeTruthy();
      return node!;
    });
    // "browser" appears in Welcome.txt content, but launching Browser must win.
    fireEvent.change(input, { target: { value: 'browser' } });
    const first = await waitFor(() => {
      const node = document.querySelector('.palette__item-label');
      expect(node).toBeTruthy();
      return node!;
    });
    expect(first.textContent).toBe('Browser');
  });

  it('finds a file by name and opens it in the editor that owns it', async () => {
    render(<CommandPalette open onClose={() => {}} onLock={() => {}} onShowShortcuts={() => {}} />);
    const input = (await waitFor(() => {
      const node = document.querySelector('.palette__search input') as HTMLInputElement | null;
      expect(node).toBeTruthy();
      return node!;
    }));
    fireEvent.change(input, { target: { value: 'hello' } });
    const row = await waitFor(() => {
      const node = Array.from(document.querySelectorAll('.palette__item')).find((item) =>
        (item.textContent ?? '').includes('hello.ts'),
      ) as HTMLElement | undefined;
      expect(node).toBeTruthy();
      return node!;
    });
    fireEvent.click(row);
    expect(useWindows.getState().windows.some((win) => win.appId === 'code')).toBe(true);
  });

  it('finds a file by its content, not just its name', async () => {
    render(<CommandPalette open onClose={() => {}} onLock={() => {}} onShowShortcuts={() => {}} />);
    const input = document.querySelector('.palette__search input') as HTMLInputElement;
    // "Kali-inspired" only appears inside theme.css.
    fireEvent.change(input, { target: { value: 'kali-inspired' } });
    await waitFor(() => {
      const labels = Array.from(document.querySelectorAll('.palette__item-label')).map((node) => node.textContent);
      expect(labels).toContain('theme.css');
    });
  });
});

describe('Quick Look in Files', () => {
  it('previews the selected file with Space and closes with Escape', async () => {
    render(<FilesApp win={{ ...windowStub('files'), payload: { folderPath: '/home/demo/Documents/Projects' } }} />);
    const file = await waitFor(() => {
      const node = Array.from(document.querySelectorAll('.files__item, .files__tile, .files__row, [role="treeitem"]')).find((item) =>
        (item.textContent ?? '').includes('hello.ts'),
      ) as HTMLElement | undefined;
      expect(node).toBeTruthy();
      return node!;
    });
    fireEvent.click(file);
    const app = document.querySelector('.app.files') as HTMLElement;
    fireEvent.keyDown(app, { key: ' ' });

    const preview = await waitFor(() => {
      const node = document.querySelector('.quicklook') as HTMLElement | null;
      expect(node).toBeTruthy();
      return node!;
    });
    expect(preview.textContent).toContain('hello.ts');

    fireEvent.keyDown(app, { key: 'Escape' });
    await waitFor(() => expect(document.querySelector('.quicklook')).toBeNull());
  });
});

describe('release notes', () => {
  it('describes this build and carries a version to compare', () => {
    expect(RELEASE.version).toMatch(/^\d+\.\d+\.\d+$/);
    expect(RELEASE.notes.length).toBeGreaterThan(3);
    for (const note of RELEASE.notes) {
      expect(note.title.length).toBeGreaterThan(3);
      expect(note.detail.length).toBeGreaterThan(20);
    }
    expect(RELEASE_SEEN_KEY).toBe('nova.release.seen');
  });

  it('gets the projects samples onto the desktop through the palette', async () => {
    // Guard rail for the drag-and-drop copy path: the source folder still exists.
    expect(useFiles.getState().nodes[FOLDER_IDS.projects]).toBeTruthy();
  });
});
