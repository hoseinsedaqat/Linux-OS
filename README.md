# NOVA Linux — Web Desktop Experience

A complete, interactive **Linux-style desktop environment that runs entirely in the browser**.
It boots, asks you to sign in, restores your workspace and lets you actually *work* inside it:
write documents, build spreadsheets, keep a Persian bookkeeping ledger, browse, take notes and
manage a virtual file system that survives a page reload.

> **This is a simulator.** NOVA Linux is a web application that imitates a desktop OS. It does not
> run a Linux kernel, cannot access your real files, your hardware or the network on your behalf,
> and it never asks for or stores a real password.

- **Stack:** React 18 + TypeScript (strict) + Vite 5, Zustand, Framer Motion (used sparingly),
  Lucide icons, hand-written CSS with design tokens, IndexedDB + LocalStorage persistence.
- **No backend, no API keys, no external services, no tracking.** Everything is client-side.
- **GitHub Pages ready** — builds with the correct sub-path base and deploys from Actions.

---

## Table of contents

1. [Screens](#screens)
2. [Feature tour](#feature-tour)
3. [Quick start](#quick-start)
4. [Deploying to GitHub Pages](#deploying-to-github-pages)
5. [Project structure](#project-structure)
6. [Persistence model](#persistence-model)
7. [Keyboard shortcuts](#keyboard-shortcuts)
8. [Testing](#testing)
9. [Honest limitations](#honest-limitations)
10. [Design notes](#design-notes)

---

## Preview

![Schematic of the NOVA Linux desktop](docs/preview.svg)

*Schematic of the desktop built from the project's own design tokens (wallpaper gradients, panel,
window chrome, icons) — not a screenshot. Open the live demo for the real thing.*

## Screens

| Screen | What it is |
| --- | --- |
| Boot splash | Firmware-style POST table (CPU/memory/display/storage), drifting aurora, CRT scanlines, a live service checklist, percentage meter, log lines and a **Skip** control. |
| Login | Large clock + date, wallpaper, avatar, password field with reveal toggle and a Caps-Lock indicator, language & keyboard layout selectors and a power menu. Demo mode: **any password works and nothing is stored**. |
| Desktop | Wallpaper, column-flowing desktop icons, panel, Applications menu, clock/calendar, notification tray, Quick Settings, window manager, and a cinematic session intro (rings, wordmark, sweep). Apps open at ~100% of the work area. |
| Lock screen | Same visual language as login, returns you to the running session without losing windows. |
| Power states | Shutting down / restarting / powered off, with a "Power on" action. |

The desktop layout is fluid: the panel can sit on the **bottom, top, left or right**, with adjustable
size, opacity and auto-hide, and the whole UI scales for small screens (windows become maximised
sheets on mobile widths).

### Desktop

The desktop is a real workspace, not a wallpaper:

- **An icon for every installed application** (19 out of the box, including the Games folder), laid out in columns that grow to
  the right and scroll when the screen is small — add or remove any of them and the choice is saved.
- **Right-click the desktop** for *New folder / text file / document / spreadsheet / presentation /
  note*, *Add app shortcut…*, wallpaper and display settings, "show desktop" and "restore default
  icons". Anything created appears on the desktop immediately and opens in the right application.
- **Right-click an icon** for open, add/remove from desktop, pin to the panel, reorder, rename,
  properties or move to Trash. Right-click any app in the Applications menu to add it to the desktop.
- Keyboard: arrows/tab move focus, `Enter` opens, `F2` renames, `Delete` moves a file to the Trash.
- Double-click on a mouse, single tap on touch screens.

### Panel, sound and brightness

- A floating glass dock with launcher, pinned apps, running windows, network, **volume**, **brightness**,
  battery, notifications, calendar and a show-desktop button.
- The tray volume and brightness icons support the **mouse wheel**; both also live in Quick Settings.
- One on-screen display is shared by every surface, so the panel, Quick Settings and the Settings app
  can never disagree about the current level.
- Brightness dims the desktop layer only (a real display-brightness API does not exist in a browser);
  volume is simulated and clearly labelled as such.

---

## Feature tour

### Window manager
- Title bar with app icon + name, minimise / maximise / close, drag to move, eight-way resize.
- Click-to-focus with correct z-ordering and an active/inactive visual state.
- **Edge and corner tiling**: drag a window to the top edge to maximise, to the left/right edge for a
  half, or into a corner for a quarter. `Super + ←/→/↑/↓` does the same from the keyboard.
- **Virtual desktops**: four workspaces, switched from the dots in the panel, `Ctrl+Alt+←/→`, the
  window overview, or `Ctrl+K → “Go to workspace 3”`. Windows keep their state while you switch.
- **Window overview (Exposé)**: `Ctrl+Alt+↑` lists every window with its real geometry and workspace,
  and can focus, minimise, close or move each one.
- Title-bar context menu (restore, snap left/right/quarter, move to another workspace, close) and a
  desktop context menu.
- Windows are clamped inside the work area, cascade when opened, and re-clamp on resize.
- Multi-instance where it makes sense (Writer, Calc, Impress, Files, Terminal…), singletons for
  Settings, Welcome and the session shell.

### Command palette (`Ctrl+K`)
A real launcher: search every installed app, every open window, shell actions (theme, settings,
terminal, overview, shortcuts, lock) and workspaces. Arrow keys move, `Enter` runs, `Escape`
closes, and each row performs its action — there are no placeholder entries.

### Applications menu
Favorites, All Applications, Recent, Internet, Office, Graphics, Multimedia, System, Utilities and
Development categories with live counts; fuzzy search across names, descriptions and categories;
pin/unpin; keyboard navigation (↑/↓/Enter/Esc); empty state; right-click a tile for *Open*,
*Pin* and *Open in new window*.

### Games
The **Games** app is a hub for four complete, fully playable games that run with real rules and
persist their best scores in the browser (`nova-linux.games.v1`):

| Game | What is implemented |
| --- | --- |
| **Minesweeper** | 9×9 / 12×16 / 14×20 boards, first click always safe, flood reveal, flags (right-click or long-press), chord-click, per-difficulty best **time**. |
| **2048** | Complete merge/lock rules, keyboard + swipe, score, best score, top tile, one-step undo. |
| **Snake** | Seeded food placement, wall and self collision, three speeds, score-driven acceleration, pause (`Space`), `R` restarts, on-screen D-pad for touch. |
| **Tic-Tac-Toe** | Two players on one screen, or a computer with easy (random), medium (optimal 65 %) and hard (full minimax) levels; running win/draw/loss tally. |

`~/Games` in the virtual file system contains four `.app` launcher files — double-clicking one in
Files or on the desktop opens that game, so the folder is a real launcher folder and not decoration.

### Files ("Computer")
All home folders plus Desktop, Documents, Downloads, Pictures, Music, Videos, Notes, Favorites,
Recent, Applications and Trash. Grid and list views, icon size control, sorting, breadcrumbs,
back/forward/up, search, multi-select, drag & drop move, copy/cut/paste, duplicate, rename,
Move to Trash, restore, delete permanently, empty trash (with confirmation), details pane,
inline image preview, and a *New* menu that creates real files of every supported kind.

### Browser + Nova Search
Chrome-inspired but clearly its own thing: tabs (new/close/switch), back/forward/reload/home,
bookmarks, history, downloads panel, and a custom new-tab page with a clock and shortcuts.

**Search is real.** Typing a phrase in the address bar (or the new-tab search box) opens
**Nova Search**, which queries public APIs straight from your browser and renders the results
natively:

| Source | Endpoint | Used for |
| --- | --- | --- |
| Wikipedia (per language) | `action=query&generator=search` + `extracts`/`pageimages`, with two REST fallbacks | encyclopaedic results with real snippets and thumbnails |
| Stack Exchange | `api.stackexchange.com/2.3/search/advanced?site=stackoverflow` | technical / programming questions |
| Hacker News (Algolia) | `hn.algolia.com/api/v1/search?tags=story` | community discussions for technical queries |
| DuckDuckGo Instant Answer | `api.duckduckgo.com/?format=json` | the instant-answer card and related topics |
| Free Dictionary | `api.dictionaryapi.dev/api/v2/entries/en/{word}` | definitions for single-word queries |

The five providers run **in parallel**, results are de-duplicated by URL and grouped by source.
A chip row above the results shows the honest status of every provider (*ok / empty / error* with
the HTTP status), so one failing API never hides the others — the page only reports a total failure
when *every* provider errored. Each provider's hits render natively (Wikipedia articles get a clean
reader view); the page never fabricates a result to fill space. Responses are cached for five
minutes in memory, with *Retry* to bypass the cache. No API keys, no proxy, no tracking.

Typed text that *is* a URL still navigates; whole websites render in an embedded frame, and sites
that refuse to be embedded (`X-Frame-Options` / CSP) show an explanatory screen with an "Open in
your real browser" action instead of a broken frame.

### Music, Photos, Weather
- **Music** — a working player. Bundled tracks are *synthesised with Web Audio* (no audio files, no
  licensing questions) and drawn with a live analyser; dropping real audio files into `~/Music`
  adds them to the playlist, with play/pause, previous/next, seek-free progress, volume and a
  visualiser. It states plainly that it is a demo player, not a media library.
- **Photos** — a gallery over `~/Pictures`: thumbnails, keyboard navigation, zoom, rotate, details
  panel and **set as wallpaper** (writes the real custom wallpaper used by the desktop).
- **Weather** — live forecasts from **Open-Meteo** (keyless, CORS-enabled): current conditions,
  hourly strip for the next 24 hours, a 7-day list, city search via the Open-Meteo geocoder and
  saved cities. Network failures show an explicit retry state instead of stale or invented data.

### Office suite
- **Writer** — rich text editing (headings, bold/italic/underline, lists, alignment, colours,
  links, tables), find & replace, live word/character count, print preview + print, save into the
  virtual file system, export to TXT and HTML. DOCX/PDF export is deliberately **not** offered.
- **Calc** — 40 × 16 grid, formula bar, `SUM/AVERAGE/MIN/MAX/COUNT/ABS/ROUND/SQRT/PI`, arithmetic
  and ranges, dependent recalculation, circular-reference and unknown-function errors, cell styles
  (bold/italic/align/colour), row/column insert & delete, multiple sheets, CSV import/export.
- **Impress** — slide CRUD and reordering, layouts, text/shape inserts, themes, backgrounds,
  thumbnails, full-screen slide show with keyboard control, autosave and JSON export.

### Notes
Create, edit, search, pin, colour-code and delete notes; autosave with last-modified timestamps;
export to TXT; opens `.novanote` files from Files; Persian and English text.

### NOVA Accounting (Persian, RTL)
A working small-business ledger: dashboard with KPIs and a monthly chart, customers, suppliers,
products/services, sales and purchase invoices with line items (quantity, price, discount, tax),
derived payment status, partial payments, printing, income/expense transactions with filters,
payments, bank accounts, reports with CSV export, and settings with JSON backup/import.
Sample data ships pre-loaded **and is clearly labelled as sample data**, with one-click clearing.

### Settings
Appearance (theme, accent, **theme studio** custom accent colour, corner radius, transparency,
**system sounds** with a test button), Desktop & Panel (position, size, opacity, auto-hide, dock
labels), Display (virtual resolution, UI scale, text size, fullscreen), Brightness (desktop-layer
dimming only), Wallpapers, Fonts, Keyboard layout, Language (English ⇄ فارسی with a full RTL flip),
Date & Time (24-hour, seconds), Notifications, Storage (export/import/backup/restore/clear demo data
with confirmations), Privacy, Accessibility (**reduce motion**, **high contrast**, text/UI scale,
**screensaver delay**, shortcut list) and About.

### Installable PWA, offline shell and code splitting
- `public/manifest.webmanifest` with 192/512/maskable PNG icons, standalone display, app shortcuts
  (`?app=files`, `?app=games`) and theme colours. Install it from the browser's install button.
- `public/sw.js` precaches the shell, serves navigations network-first with an offline fallback and
  keeps hashed assets stale-while-revalidate. Third-party API responses are **never** cached, so
  search and weather can never show stale data as if it were live.
- Every application is a `React.lazy` chunk; the shell bundle is ~160 kB and the vendor libraries
  are split into long-lived `vendor-*` chunks. Opening an app shows a calm loading placeholder.

### Accessibility
- A visible global focus ring (`:focus-visible`), a **Skip to the desktop** link, named controls and
  dialogs everywhere, `aria-pressed` workspace buttons, `aria-live` loading state for lazy apps.
- **High contrast** mode, reduced motion, text-size and UI-scale sliders, and full RTL support.
- `tests/a11y.test.tsx` audits the desktop for unnamed controls, unlabelled dialogs and images
  without `alt` text, and covers the keyboard-only palette path.

### System apps
Calculator (keyboard-friendly, history), Calendar (month view, events, colours), Terminal
(simulated shell over the virtual FS only: `help`, `ls`, `cd`, `pwd`, `mkdir`, `touch`, `cat`,
`echo >`, `history`, `neofetch`, `open`), System Monitor (clearly labelled **simulated** graphs),
Software Center (install/remove simulator apps, which updates the Applications menu), Trash,
and a Welcome window on first login.

---

## Quick start

Requirements: **Node 18+** (20 recommended) and npm.

```bash
npm install
npm run dev        # http://localhost:5173
```

Other scripts:

```bash
npm run typecheck  # strict TypeScript, no emit
npm run test       # Vitest + Testing Library (jsdom)
npm run build      # typecheck + production bundle into dist/
npm run preview    # serve the production build locally
```

---

## Deploying to GitHub Pages

1. Push the repository to GitHub (suggested name: `nova-linux-web`).
2. **Settings → Pages → Build and deployment → Source: GitHub Actions.**
   This is the one setting that cannot be automated: the workflow token is not allowed to create
   the Pages site, so `configure-pages` can only *configure* an existing one. Until it is flipped,
   the run stops at **Configure Pages** with a `404` from the Pages API.
3. Push to `test` (this repository's default branch), to `main`, or run the workflow manually with
   **Run workflow**. `.github/workflows/deploy.yml` will type-check, run the tests, verify the Pages
   status, build with `VITE_BASE=/<repo-name>/`, add `.nojekyll`, upload `dist` and deploy it.

The live URL is `https://<user>.github.io/<repo>/`. If a run fails only at *Configure Pages*, the
build is fine — enable Pages and press **Re-run all jobs**.

The Vite `base` comes from `VITE_BASE`, so the same code works at a project sub-path
(`https://user.github.io/<repo>/`) **and** at a domain root. There are no absolute asset URLs in the
bundle — fonts are bundled locally through `@fontsource-variable`, icons are inline SVG components,
and wallpapers are pure CSS gradients.

For a custom domain, set `VITE_BASE=/` in the workflow environment.

---

## Project structure

```
src/
  app/                    App shell + phase machine (boot → login → desktop → locked → off)
  components/
    desktop/              Desktop surface, icons, context menus, intro animation
    windows/              WindowFrame (drag/resize/snap) + WindowManager
    taskbar/              Panel (positions, tray, task list, clock)
    start-menu/           Applications menu
    quick-settings/       Quick Settings popover
    notifications/        Notification center + calendar popover
    screens/              Boot and login screens
    common/               NovaLogo, AppIcon, Modal, ContextMenu, Toasts, FilePicker, Controls…
  apps/
    files/ browser/ writer/ calc/ impress/ notes/ accounting/
    settings/ terminal/ calculator/ calendar/ software-center/
    system-monitor/ welcome/ games/ music/ photos/ weather/
  core/
    apps/                 App metadata, registry (the app contract), launcher + shell stores
    window-manager/       Window store + responsive metrics
    virtual-filesystem/   FS store, seed image, path helpers, clipboard
    persistence/          IndexedDB wrapper (kv store) + React bindings
    themes/               Settings store + theme application
    localization/         i18n (English keys → Persian values), localized dates
    notifications/        Notification store
    audio/ pwa/           Web Audio feedback sounds + service-worker registration
  hooks/ services/ styles/ types/ utils/
tests/                    Vitest suites (core logic, apps, shell, games, a11y)
e2e/                      Playwright smoke suite
docs/                     Architecture, testing checklist, shortcuts
public/                   Logo, PWA manifest + icons, service worker, robots.txt
```

**Adding an app** only needs: metadata in `core/apps/appMeta.ts`, a component accepting
`AppWindowProps` (`{ win }`), and one line in `core/apps/registry.ts`. Everything else — window
handling, launcher entry, search, pinning, software center, persistence helpers — is generic.

---

## Persistence model

| Data | Where | Notes |
| --- | --- | --- |
| Virtual file system (documents, notes, images, trash) | **IndexedDB** (`nova-linux-web`, versioned) | Falls back to an in-memory store when storage is blocked; the UI then shows a warning banner and says changes are session-only. |
| App data (browser tabs/history/bookmarks, accounting ledger, calendar) | **IndexedDB** key-value stores | Versioned keys such as `app.browser.v1`, `app.accounting.v1`. |
| UI preferences (theme, accent, wallpaper, panel, language, accessibility) | **LocalStorage** (`nova-linux.settings.v1`) | Small, synchronous, safe to lose. |
| Session phase | `sessionStorage['nova.session']` | `active` / `locked` only — **no credentials, ever**. |

Storage → Settings offers JSON export/import of the whole workspace (settings, launcher, files and
app data) plus a "clear demo data" action that always asks for confirmation.

---

## Keyboard shortcuts

| Shortcut | Action |
| --- | --- |
| `Ctrl/Cmd + K` | Open the command palette (apps, windows, actions) |
| `Ctrl + Alt + T` | Open Terminal |
| `Ctrl + Alt + ↑` | Window overview (Exposé) |
| `Ctrl + Alt + ←/→` | Switch virtual desktop |
| `Super + ←/→/↑/↓` | Tile / maximise / restore the active window |
| `Alt + Tab` | Switch to the next window |
| `Ctrl + Alt + L` | Lock the session |
| `Shift + ?` | Keyboard shortcut sheet |
| `Esc` | Close the open menu / dialog |
| `Delete`, `F2`, `Enter`, `Ctrl+A/C/V` | Files: delete, rename, open, select-all, copy/paste |
| `Ctrl + S` | Save in Writer / Calc / Impress |
| Arrow keys, `Esc` | Slide-show navigation |

---

## Testing

```bash
npm run test        # 166 Vitest tests (jsdom + Testing Library)
npm run test:e2e    # Playwright smoke suite (needs `npx playwright install chromium`)
```

The Playwright suite (`e2e/desktop.spec.ts`, workflow `.github/workflows/e2e.yml`) boots the real
app in Chromium and drives it with the actual shortcuts: sign-in, the application menu, the command
palette, launching a game, snapping windows, switching desktops, the overview, and the honest
per-provider failure state of Nova Search (third-party calls are blocked on purpose).

The unit suite runs in `jsdom` with Testing Library and covers:

- utilities, the formula engine and the spreadsheet engine (including error cases),
- virtual file system CRUD, trash/restore and unique-name handling,
- accounting totals, invoice status derivation and sample-data handling,
- the boot → login → desktop flow, the Applications menu, Quick Settings,
- every registered app rendering without crashing, plus **every Accounting tab** and **every Settings
  section**,
- the desktop surface: an icon for every installed application, column layout, adding/removing app
  shortcuts, and files created from the desktop context menu showing up immediately,
- volume and brightness: the slider track fill follows the value, the Quick Settings control and the
  settings store agree, and both surfaces raise the same on-screen display,
- real interactions: Terminal commands (and the `sudo` refusal), Notes autosave, Files folder
  creation through the dialog, Trash restore, Accounting create/validate, Calculator keypad,
  Browser navigation (including the iframe-blocked path), Software Center install/uninstall,
  Calendar events, Settings language & reduced motion, theme/accent persistence,
- **games logic**: safe first click, mine counting, flags/chording, win & loss, 2048 merge and
  lock rules, snake movement, self-collision and speed curve, tic-tac-toe minimax (never loses as O),
  best-score bookkeeping,
- **weather mapping**: WMO code vocabulary, geocoding and forecast shaping, incomplete payload →
  `null` instead of invented data, keyless URL construction, hourly slicing,
- **new shell behaviour**: virtual desktops, window tiling, palette state, high-contrast/theme studio.

`docs/TESTING.md` contains the full 30-point manual behaviour checklist used for the release pass.

---

## Honest limitations

NOVA Linux is deliberately honest about what it cannot do:

- **No real OS, kernel, hardware or network access.** Terminal is a simulator over the virtual FS;
  System Monitor graphs and battery/network readings are synthetic and labelled as such.
- **Search is real, page rendering is limited.** Nova Search returns genuine results from public
  APIs, but arbitrary websites still cannot be rendered inside the shell: the Browser can only
  display pages that explicitly allow embedding, many sites block it, and you get a clear
  explanation plus a link for your real browser. There is no proxy, no server-side fetch and no
  cookie jar.
- **No DOCX/PDF import/export.** Writer exports TXT and HTML, and printing uses the browser's own
  print dialog. Nothing pretends to produce documents it cannot.
- **No real authentication.** The login screen is a demo: any password works, nothing is validated
  or stored. Passwords typed there never leave the component.
- **Brightness** dims the desktop layer only (a real display brightness API does not exist in a
  browser).
- **Virtual resolution** is a simulated canvas — it changes layout metrics, not your display.
- Downloadable files are generated in-memory and handed to the browser; there is no server upload.
- **Offline mode** is a cached shell: apps load from the service-worker cache, but anything that needs
  the internet (search, weather, real web pages) shows its normal network-error state while offline.
- **Music** ships synthesised Web Audio tones, not songs. Files you place in `~/Music` are played by
  the browser and therefore depend on its codec support; unsupported formats are reported, not faked.
- **Weather** comes from Open-Meteo and needs a connection; there is no offline forecast cache
  pretending to be current.

---

## Design notes

- One CSS-variable design system (`styles/tokens.css`): colours, radii, shadows, motion and layout
  metrics. Themes and accents swap tokens only — no component knows a hex value.
- Dark-first, with a full light theme; accent palettes (mint, sky, violet, amber, rose); Persian uses
  Vazirmatn and the whole document flips to RTL with logical CSS properties.
- Motion is cheap and optional: reduced-motion is honoured both from Settings and from
  `prefers-reduced-motion`, and heavy effects are avoided on the compositor path.
- Every interactive element does something real: no placeholder buttons, no fake success toasts.
  Empty, loading, error and confirmation states exist throughout.

---

Built as a portfolio-grade demonstration that a desktop-class experience can live inside a single
static web page. Not affiliated with any operating-system vendor; "Chrome-inspired" only describes a
browser layout, and NOVA is not Chrome or Chromium.
