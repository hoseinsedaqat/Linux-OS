# Testing & release checklist

## Automated tests

```bash
npm run test          # one-shot
npm run test:watch    # watch mode
```

The suite runs in `jsdom` (Vitest + Testing Library). IndexedDB is intentionally *not* polyfilled:
the persistence layer is exercised through its in-memory fallback, which is exactly the degraded
path a user hits when a browser blocks storage.

| File | Covers |
| --- | --- |
| `tests/core.test.ts` | formatting/escape/extension helpers, the formula engine (arithmetic, functions, ranges, syntax errors), the spreadsheet engine (`=A1+A2*2`, `SUM`, circular refs, unknown functions), virtual file system seeding + create/rename/trash/restore/delete/unique names/system-folder protection/write-at-path, accounting line & invoice totals, derived payment status, dashboard totals, empty workspace. |
| `tests/ui.test.tsx` | boot → skip → login → desktop, welcome window restoration, Applications menu search + launch, Quick Settings popover, and a smoke render of **every** app in the registry. |
| `tests/apps.test.tsx` | Terminal command execution and `sudo` refusal, Notes creation + autosave into the VFS, Files folder creation through the prompt dialog, Accounting customer creation + required-field validation, Settings language switch and reduced-motion toggle. |
| `tests/desktop.test.tsx` | Desktop surface: an icon for every installed app, column layout contract, adding/removing app shortcuts from the desktop and app-menu context menus, files created from the desktop appearing immediately, slider track fill/aria-value sync, shared volume/brightness OSD. |
| `tests/interactions.test.tsx` | Calculator keypad evaluation, Browser navigation incl. the iframe fallback and the explicit blocked-host screen, Software Center install/uninstall, Calendar event creation, Trash restore from the UI, every Accounting tab and every Settings section rendering, accent/theme persistence. |
| `tests/shell.test.ts` | Virtual desktops and window placement, tiling presets, palette command list, high-contrast + theme studio helpers. |
| `tests/games.test.ts` | Minesweeper safe first click, mine counts, flags/chording, win & loss; 2048 merge and lock rules; snake movement, self-collision and speed curve; minimax never losing; best-score storage. |
| `tests/search.test.ts` | Provider URLs (keyless, CORS), result de-duplication and grouping, per-provider `ok`/`empty`/`error` mapping, total-failure state, five-minute cache. |
| `tests/code.test.ts` | Language detection, the tokenizer (keywords, property names, strings, comments), find-in-file, indent/outdent, caret maths, `fileAppFor` routing for code extensions. |
| `tests/responsive.test.ts` | Breakpoint contract per stylesheet, no over-wide fixed widths, fluid card grids, PWA/viewport meta, reduced-motion coverage, Code's mobile overlay. |
| `tests/a11y.test.tsx` | Unnamed controls, unlabelled dialogs, images without `alt`, and the keyboard-only palette path. |

## The 61-point behaviour checklist

Executed manually against a **production build** (`npm run build && npm run preview`) before each
release. "✔" marks points that are also covered by automated tests.

### Boot & session
1. Boot splash renders, animates, can be skipped, and auto-advances. ✔ (flow test)
2. Login screen shows live clock + date, reveal/hide password, Caps Lock hint, language and keyboard selectors. ✔
3. Signing in shows the session intro animation and the desktop with the Welcome window. ✔
4. Locking the session (`Ctrl+Alt+L`, panel, Quick Settings) returns to the lock screen; unlocking keeps windows.
5. Restart returns to the boot splash; shut down shows the power-off screen with a working "Power on".

### Shell & layout
6. Panel can be moved to bottom/top/left/right, resized and made translucent; the choice survives a refresh.
7. Applications menu: categories, live search, Enter opens the first match, empty state, pin/unpin. ✔
8. Window drag, resize from all eight handles, minimise, maximise (button and double-click), close, focus/z-order, snap preview.
9. Window and desktop context menus only offer actions that work.
10. Responsive: at ≤820 px windows open maximised, the panel stays usable, menus fit the screen.
11. Brightness/volume/network/battery controls change *something visible* and are labelled as simulated. The slider fill tracks the thumb, the panel/Quick Settings/Settings app agree, and both sliders raise the shared on-screen display. `✔` (store + track fill)
11a. Every installed app has a desktop icon; right-click → *Add app shortcut…* adds one and it appears
    immediately; right-click an icon → *Remove from Desktop* removes it. `✔`
11b. Right-click the desktop → *New document / New folder*: the new item is visible on the desktop at
    once (the icon surface has a real height — regression guarded by `tests/desktop.test.tsx`). `✔`
12. Quick Settings tiles and notification centre (dismiss, clear all, click-to-open) behave.

### Files
13. Every home folder, Trash, Favorites, Recent and Applications view lists the right nodes.
14. Create folder/file through the toolbar *New* menu and through the background context menu. ✔
15. Rename, copy, cut, paste, duplicate, move by drag & drop, multi-select, search, sort, grid/list, icon size.
16. Move to Trash, restore, delete permanently, empty trash with confirmation. ✔ (store level)
17. Opening a file launches the correct app (document → Writer, sheet → Calc, deck → Impress, note → Notes, image → preview).
18. Image preview opens with a working "Save a copy".

### Applications
19. Writer: formatting, find & replace, word count, save into VFS, TXT/HTML export, print preview. ✔ (save/shortcut paths)
20. Calc: typing, formulas (`=SUM(A1:A4)`), errors for broken formulas, formatting, row/column ops, sheets, CSV import/export, keyboard navigation. ✔ (engine level)
21. Impress: add/reorder/delete slides, edit text and shapes, change theme/background, start/stop a slide show (`F5`), JSON export.
22. Notes: create, autosave, colour, pin, search, TXT export, unsaved-change guard when switching notes. ✔
23. Accounting: create/edit/delete customers, suppliers, products; invoice with line items, tax, payments, status; filters; CSV export; JSON backup + import; clear sample data with confirmation. ✔ (create + validation)
24. Settings: theme, accent, wallpaper, panel, display/scale, fonts, keyboard, language (RTL flip), date/time, notifications, accessibility, About; storage export/import/restore/clear. ✔ (language + reduced motion)
25. System apps: Calculator arithmetic, Calendar events, Terminal commands and `sudo` refusal, System Monitor "simulated" labelling, Software Center install/remove affecting the menu, Trash. ✔ (terminal)

### New in this round — games, media, shell layers
26. Games hub: every card launches its game, best scores come from the store and update after a round. ✔ (logic + render)
27. Minesweeper: first click never hits a mine, right-click flags inside the mine budget, chord opens neighbours, win/lose overlays, best time per difficulty. ✔ (logic)
28. 2048: merge rules (no double merge), lock detection, undo, best score, keyboard + swipe. ✔ (logic)
29. Snake: steering, wall/self collision, food placement, speed curve, pause, restart, touch D-pad. ✔ (logic)
30. Tic-Tac-Toe: wins on rows/columns/diagonals, draw detection, hard level never loses, two-player mode, tally. ✔ (logic)
31. `~/Games` launchers: double-clicking an `.app` file in Files (or on the desktop) opens the matching game. ✔ (registry render)
32. Music: play/pause a synthesised track, visualiser responds, volume slider, error state for unsupported files.
33. Photos: thumbnails, keyboard navigation, zoom/rotate, details panel, “set as wallpaper” changes the desktop.
34. Weather: current conditions, 24-hour strip and 7-day list load from Open-Meteo; blocking the request shows the retry state. ✔ (mapping)
35. Command palette: `Ctrl+K`, arrow keys, `Enter`, `Escape`; every listed action runs. ✔ (state + a11y)
36. Virtual desktops: windows stay on their desktop, switching focuses the right window, move-to-workspace works. ✔ (store)
37. Tiling: drag to each edge/corner and `Super + arrows`; restore keeps the pre-snap rectangle. ✔ (store)
38. Overview: lists every window with size and workspace; focus/minimise/close/move all work. ✔ (state)
39. PWA: manifest installs, service worker registers in a production build, offline reload shows the shell.
40. A11y: high contrast, reduced motion, text/UI scale, focus ring, skip link, named controls. ✔ (audit test)
41. Theme studio: custom accent colour applies everywhere and can be reset to a preset. ✔ (applyTheme test)
42. Screensaver: configured delay shows the clock, any input dismisses it.
43. Onboarding tour: appears once on first login, can be skipped, and the first-run tour can be reopened from the shell overlay (`openOverlay('tour')`, used by Settings).

### Robustness
44. Persistence: create a document/note/accounting record, reload the page and confirm it is still there.
45. Storage failure: with site data blocked, the shell shows a warning banner and still works for the session.
46. Corrupt data: invalid JSON in LocalStorage/IndexedDB settings is ignored and defaults are restored.
47. No critical console errors during the checklist; no `NaN`, no missing-key warnings.
48. GitHub Pages: build with `VITE_BASE=/<repo>/`, every asset resolves under the sub-path, deep reloads work.

### Code (editor)
49. Open **Code** from the launcher: `~/Projects` lists `hello.ts`, `theme.css`, `notes.md` and `data.json`; clicking a file opens a tab with line numbers, a gutter and highlighted syntax.
50. Type in the editor: the tab shows the dirty dot, the status bar switches from `Saved` to `Unsaved changes`, and `Ctrl+S` clears it.
51. `Ctrl+S`, then open the same file in **Files**: the new text is there (both read the same virtual FS).
52. `Ctrl+F` reports the match count, `Enter`/`Shift+Enter` wrap through the matches, `Escape` closes the panel.
53. Select three lines and press `Tab` (indents all three), then `Shift+Tab` (restores them).
54. Unsupported property names are not highlighted: `obj.return` keeps `return` in the identifier colour.
55. Close a tab with unsaved changes: a confirmation appears; cancel keeps the tab and the text.
56. Narrow the window below 760 px: the explorer becomes an overlay and the editor keeps a usable width.

### Responsive contract
57. At 1440 px, 1024 px, 834 px, 768 px, 640 px, 430 px and 390 px wide, no surface shows a horizontal scrollbar and nothing is clipped: desktop icons, panel, Applications menu, palette, Files, Games, Media apps, Settings.
58. ≤ 900 px the panel compacts and tray labels disappear; ≤ 860 px the Files sidebar collapses and the Games grid becomes one column; ≤ 640 px game boards rescale and card grids reflow; ≤ 420 px the palette and sheets go edge to edge.
59. Every tap target stays ≥ 32 px, and the whole UI stays usable in landscape phone orientation.
60. With *reduce motion* on, no sheet, window, dialog or the session intro animates (only opacity changes remain).

## Automated gates

```bash
npm run typecheck   # strict TS
npm run test        # Vitest: 194 tests — logic, apps, shell, games, search, code, responsive, a11y
npm run test:e2e    # Playwright: real Chromium smoke suite (CI: .github/workflows/e2e.yml)
```

## Manual spot-check commands

```bash
# production build served the same way GitHub Pages will serve it
VITE_BASE=/nova-linux-web/ npm run build
npx vite preview --base /nova-linux-web/

# verify no absolute asset references leaked into the bundle
grep -o 'src="/[^"]*"' dist/index.html
grep -rho '"/assets/[^"]*"' dist/assets/*.js | head
```

The second command should print nothing; the first should only show paths prefixed with the base.

## Round-3 additions to the automated suites

- `tests/code.test.ts` (17) — language detection, tokenizer (keywords, strings, comments, property
  names), find-in-file, indentation, caret maths, `fileAppFor` routing for code extensions.
- `tests/responsive.test.ts` (10) — asserts every documented breakpoint still exists, no new sheet
  uses a fixed width wider than a phone, card grids are fluid, the PWA/viewport meta tags are in
  place, reduced-motion coverage exists in every animated sheet, and Code's mobile overlay rules
  are present.
