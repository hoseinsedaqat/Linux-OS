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

## The 30-point behaviour checklist

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

### Robustness
26. Persistence: create a document/note/accounting record, reload the page and confirm it is still there.
27. Storage failure: with site data blocked, the shell shows a warning banner and still works for the session.
28. Corrupt data: invalid JSON in LocalStorage/IndexedDB settings is ignored and defaults are restored.
29. No critical console errors during the checklist; no `NaN`, no missing-key warnings.
30. GitHub Pages: build with `VITE_BASE=/<repo>/`, every asset resolves under the sub-path, deep reloads work.

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
