import type { FSNode, FSNodeKind } from '@/types';
import type { DeckModel, Workbook, WriterDoc } from '@/types/documents';
import { FOLDER_IDS } from './fsUtils';
import { starterProjectNodes } from './starterFiles';

const NOW = Date.now();
const DAY = 86_400_000;

function folder(
  id: string,
  parentId: string | null,
  name: string,
  extra: Partial<FSNode> = {},
): FSNode {
  return {
    id,
    parentId,
    name,
    kind: 'folder',
    content: '',
    createdAt: NOW - 30 * DAY,
    modifiedAt: NOW - 2 * DAY,
    ...extra,
  };
}

function file(
  id: string,
  parentId: string,
  name: string,
  kind: FSNodeKind,
  content: string,
  extra: Partial<FSNode> = {},
): FSNode {
  return {
    id,
    parentId,
    name,
    kind,
    content,
    createdAt: NOW - 12 * DAY,
    modifiedAt: NOW - DAY,
    ...extra,
  };
}

const writerDoc: WriterDoc = {
  title: 'Welcome Letter',
  html: `<h1>Welcome to NOVA Linux</h1>
<p>This document lives in the simulated file system and is stored in your browser's IndexedDB. Close the window, refresh the page, and open it again — it will still be here.</p>
<p><strong>Things to try</strong></p>
<ul>
<li>Use the toolbar to change fonts, size and alignment.</li>
<li>Insert a table or a link.</li>
<li>Use <em>Save As</em> to create another copy in Documents.</li>
<li>Export to TXT or HTML — the download is generated locally.</li>
</ul>
<p style="text-align:center">— The NOVA Desktop Team</p>`,
};

const workbook: Workbook = {
  title: 'Household Budget',
  activeSheet: 'sheet-1',
  sheets: [
    {
      id: 'sheet-1',
      name: 'Budget',
      colWidths: {},
      rowHeights: {},
      cells: {
        A1: { v: 'Category', bold: true, bg: '#1f2c3a', color: '#e6edf6' },
        B1: { v: 'Planned', bold: true, bg: '#1f2c3a', color: '#e6edf6' },
        C1: { v: 'Actual', bold: true, bg: '#1f2c3a', color: '#e6edf6' },
        D1: { v: 'Difference', bold: true, bg: '#1f2c3a', color: '#e6edf6' },
        A2: { v: 'Rent' },
        B2: { v: '1200', format: 'currency' },
        C2: { v: '1200', format: 'currency' },
        D2: { v: '=B2-C2', format: 'currency' },
        A3: { v: 'Groceries' },
        B3: { v: '450', format: 'currency' },
        C3: { v: '512', format: 'currency' },
        D3: { v: '=B3-C3', format: 'currency' },
        A4: { v: 'Transport' },
        B4: { v: '120', format: 'currency' },
        C4: { v: '98', format: 'currency' },
        D4: { v: '=B4-C4', format: 'currency' },
        A5: { v: 'Utilities' },
        B5: { v: '180', format: 'currency' },
        C5: { v: '203', format: 'currency' },
        D5: { v: '=B5-C5', format: 'currency' },
        A7: { v: 'Total', bold: true },
        B7: { v: '=SUM(B2:B5)', bold: true, format: 'currency' },
        C7: { v: '=SUM(C2:C5)', bold: true, format: 'currency' },
        D7: { v: '=SUM(D2:D5)', bold: true, format: 'currency' },
        A9: { v: 'Average spend' },
        C9: { v: '=AVERAGE(C2:C5)', format: 'currency' },
      },
    },
    {
      id: 'sheet-2',
      name: 'Savings',
      colWidths: {},
      rowHeights: {},
      cells: {
        A1: { v: 'Month', bold: true },
        B1: { v: 'Saved', bold: true },
        A2: { v: 'January' },
        B2: { v: '300', format: 'currency' },
        A3: { v: 'February' },
        B3: { v: '420', format: 'currency' },
        A4: { v: 'March' },
        B4: { v: '380', format: 'currency' },
        A6: { v: 'Total', bold: true },
        B6: { v: '=SUM(B2:B4)', bold: true, format: 'currency' },
      },
    },
  ],
};

const deck: DeckModel = {
  title: 'NOVA Product Launch',
  theme: 'midnight',
  slides: [
    {
      id: 'slide-1',
      layout: 'title',
      title: 'NOVA Linux',
      body: 'A desktop experience that lives in the browser',
    },
    {
      id: 'slide-2',
      layout: 'title-body',
      title: 'What you can do',
      body: 'Browse files, write documents, build spreadsheets and presentations, take notes, and manage a small business ledger — all offline, all local.',
    },
    {
      id: 'slide-3',
      layout: 'bullets',
      title: 'Built for the web',
      body: 'React + TypeScript\nIndexedDB persistence\nWindow manager\nPersian & English UI',
    },
    {
      id: 'slide-4',
      layout: 'two-column',
      title: 'Simulated, not virtualized',
      body: 'Every process, file and network indicator is a friendly simulation.\nNothing touches your real operating system.',
      second: 'That means you can explore freely — and your data stays in this browser.',
    },
    {
      id: 'slide-5',
      layout: 'title',
      title: 'Thank you',
      body: 'Open the app menu and start exploring',
    },
  ],
};

const novaLogoSvg = `<svg xmlns="http://www.w3.org/2000/svg" width="320" height="180" viewBox="0 0 320 180">
<defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1">
<stop offset="0%" stop-color="#0d1620"/><stop offset="100%" stop-color="#14352c"/></linearGradient>
<linearGradient id="a" x1="0" y1="1" x2="1" y2="0">
<stop offset="0%" stop-color="#3ddc97"/><stop offset="100%" stop-color="#6ee7ff"/></linearGradient></defs>
<rect width="320" height="180" rx="18" fill="url(#g)"/>
<circle cx="160" cy="90" r="44" fill="none" stroke="url(#a)" stroke-width="6" opacity="0.9"/>
<path d="M160 60 L190 108 L130 108 Z" fill="url(#a)" opacity="0.85"/>
<text x="160" y="150" font-family="Inter, sans-serif" font-size="15" fill="#9fb3c8" text-anchor="middle" letter-spacing="4">NOVA LINUX</text>
</svg>`;

/**
 * Launcher files: `*.app` nodes carry the target app id in `meta.appId`.
 * Double-clicking one in Files opens that application (see services/fileActions).
 */
function gameShortcuts(): FSNode[] {
  const shortcuts: Array<[string, string, string, string]> = [
    ['file-game-minesweeper', 'Minesweeper.app', 'minesweeper', 'Clear a minefield with logic and flags.'],
    ['file-game-2048', '2048.app', 'game2048', 'Slide tiles and reach 2048.'],
    ['file-game-snake', 'Snake.app', 'snake', 'Grow the snake without biting yourself.'],
    ['file-game-tictactoe', 'Tic-Tac-Toe.app', 'tictactoe', 'Beat the minimax computer or play a friend.'],
  ];
  return shortcuts.map(([id, name, appId, description]) =>
    file(id, FOLDER_IDS.games, name, 'binary', `${description}\n\nLaunch: NOVA app "${appId}"`, {
      meta: { appId, description, mime: 'application/x-nova-app' },
    }),
  );
}

/** The simulated system image. System nodes cannot be trashed. */
export function createSeedTree(): FSNode[] {
  const nodes: FSNode[] = [
    folder(FOLDER_IDS.root, null, 'File System', { system: true }),
    folder(FOLDER_IDS.home, FOLDER_IDS.root, 'home', { system: true }),
    folder('dir-demo', FOLDER_IDS.home, 'demo', { system: true }),
    folder(FOLDER_IDS.desktop, 'dir-demo', 'Desktop'),
    folder(FOLDER_IDS.documents, 'dir-demo', 'Documents'),
    folder(FOLDER_IDS.downloads, 'dir-demo', 'Downloads'),
    folder(FOLDER_IDS.pictures, 'dir-demo', 'Pictures'),
    folder(FOLDER_IDS.music, 'dir-demo', 'Music'),
    folder(FOLDER_IDS.games, 'dir-demo', 'Games'),
    folder(FOLDER_IDS.videos, 'dir-demo', 'Videos'),
    folder(FOLDER_IDS.notes, 'dir-demo', 'Notes'),
    folder(FOLDER_IDS.projects, FOLDER_IDS.documents, 'Projects'),
    // Four readable samples so the editor is never empty on first open.
    ...starterProjectNodes(FOLDER_IDS.projects),
    folder(FOLDER_IDS.usr, FOLDER_IDS.root, 'usr', { system: true }),
    folder(FOLDER_IDS.usrShare, FOLDER_IDS.usr, 'share', { system: true }),
    folder(FOLDER_IDS.usrShareNova, FOLDER_IDS.usrShare, 'nova', { system: true }),
    folder(FOLDER_IDS.etc, FOLDER_IDS.root, 'etc', { system: true }),
    folder(FOLDER_IDS.var, FOLDER_IDS.root, 'var', { system: true }),
    folder(FOLDER_IDS.varLog, FOLDER_IDS.var, 'log', { system: true }),

    file(
      'file-welcome',
      FOLDER_IDS.desktop,
      'Welcome.txt',
      'text',
      `Welcome to NOVA Linux — Web Desktop Experience

This is a browser-based Linux desktop simulator. Nothing you do here touches your real computer.

Quick tour:
  • Double-click desktop icons or use the application menu (bottom panel).
  • Files, Writer, Calc, Impress, Notes and Accounting all save to IndexedDB.
  • Settings → Appearance changes the theme, accent colour and corner radius.
  • Settings → Backup exports everything into a single JSON file.

Have fun exploring!
`,
      { starred: true },
    ),
    file('file-guide', FOLDER_IDS.documents, 'NOVA-User-Guide.md', 'text', `# NOVA Linux user guide

## Windows
- Drag the title bar to move a window.
- Drag edges or corners to resize.
- Double-click the title bar to maximize / restore.

## Files
- Right-click anywhere in Files for the context menu.
- Deleted files go to Trash and can be restored.

## Keyboard shortcuts
- Ctrl/Cmd + K — open the application menu
- Ctrl + Alt + T — open the terminal
- Esc — close menus and dialogs
`, { modifiedAt: NOW - 3 * DAY }),
    file('file-letter', FOLDER_IDS.documents, 'Welcome Letter.novadoc', 'document', JSON.stringify(writerDoc)),
    file('file-budget', FOLDER_IDS.documents, 'Household Budget.novasheet', 'spreadsheet', JSON.stringify(workbook)),
    file('file-deck', FOLDER_IDS.documents, 'Product Launch.novadeck', 'presentation', JSON.stringify(deck)),
    file(
      'note-1',
      FOLDER_IDS.notes,
      'Ideas.novanote',
      'note',
      'Buy a mechanical keyboard\nTry the new tea place on the corner\nRead two chapters tonight',
      { meta: { color: 'mint', pinned: true } },
    ),
    file(
      'note-2',
      FOLDER_IDS.notes,
      'فهرست کارها.novanote',
      'note',
      'بررسی گزارش فروش ماه گذشته\nتماس با تأمین‌کننده کاغذ\nبه‌روزرسانی نسخه پشتیبان',
      { meta: { color: 'amber' } },
    ),
    file(
      'file-download',
      FOLDER_IDS.downloads,
      'sample-data.json',
      'text',
      JSON.stringify(
        {
          note: 'Sample data created by the NOVA simulator.',
          customers: [{ name: 'Sample Customer', phone: '021-00000000' }],
        },
        null,
        2,
      ),
    ),
    file(
      'file-release',
      FOLDER_IDS.downloads,
      'release-notes.txt',
      'text',
      `NOVA Linux Web Desktop
Version 1.0.0

- New window manager with drag, resize and snap.
- Files, Browser, Writer, Calc, Impress and Notes.
- Persian-first accounting module.
- IndexedDB persistence with JSON backup & restore.
`,
    ),
    ...gameShortcuts(),

    file('file-logo', FOLDER_IDS.pictures, 'nova-logo.svg', 'image', novaLogoSvg, {
      meta: { mime: 'image/svg+xml' },
    }),
    file(
      'file-about',
      FOLDER_IDS.usrShareNova,
      'about.txt',
      'text',
      'NOVA Linux 1.0 (web simulator)\nKernel: none — everything is simulated in JavaScript.\nDesktop: nova-shell\n',
      { system: true },
    ),
    file(
      'file-release-sys',
      FOLDER_IDS.etc,
      'nova-release',
      'text',
      'NAME="NOVA Linux"\nVERSION="1.0 (Web Desktop)"\nID=nova\nHOME_URL="https://github.com/"\n',
      { system: true },
    ),
    file(
      'file-session-log',
      FOLDER_IDS.varLog,
      'session.log',
      'text',
      `${new Date().toISOString()} nova-session[1]: simulated session started\n${new Date().toISOString()} nova-shell: desktop services ready\n`,
      { system: true },
    ),
  ];
  return nodes;
}
