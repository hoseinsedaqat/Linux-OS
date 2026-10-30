/**
 * Release notes shown by the "What's new" sheet.
 *
 * Bump `RELEASE.version` with the service-worker version in `public/sw.js`: the
 * desktop compares it with the last version this profile saw and offers the
 * sheet once. Only shipped, verifiable changes belong here — no roadmap items.
 */
export interface ReleaseNote {
  title: string;
  detail: string;
}

export const RELEASE = {
  version: '1.1.0',
  codename: 'Round 5 — operator',
  date: '2026-10-30',
  notes: [
    {
      title: 'A Kali-inspired skin, and the dragon',
      detail: 'Navy surfaces, one electric accent, flat plates and neon icon outlines. Kali is the default; Dark and Light stay one click away.',
    },
    {
      title: 'Search your files from Ctrl+K',
      detail: 'The command palette now finds files by name and by content, and opens each one in the app that owns it.',
    },
    {
      title: 'Quick Look in Files',
      detail: 'Select a file and press Space for a preview of text, Markdown and images without opening anything.',
    },
    {
      title: 'A real editor',
      detail: 'Undo and redo with Ctrl+Z / Ctrl+Shift+Z, autosave about a second after you stop typing, and a local version history per file.',
    },
    {
      title: 'Cross-window drag and drop',
      detail: 'Drag a file out of Files and drop it on Code, Writer or Photos (or the desktop) to open or copy it.',
    },
    {
      title: 'A sharper terminal',
      detail: 'Tab completion for commands and paths, Ctrl+R to walk back through history, and manual pages with man <command>.',
    },
    {
      title: 'Calendar that leaves the browser',
      detail: 'Import and export .ics files, repeat events daily, weekly or monthly, and get reminders in-app or through system notifications.',
    },
    {
      title: 'Honest system data',
      detail: 'System Monitor gained a card that reads the JS heap, core count and connection state straight from the browser — labelled real.',
    },
  ],
} as const;

/** LocalStorage key holding the last release this profile has acknowledged. */
export const RELEASE_SEEN_KEY = 'nova.release.seen';
