# Architecture

NOVA Linux is a single-page React application that models a desktop environment in the browser.
This document explains the moving parts and the rules that keep them decoupled.

## 1. Session lifecycle

`src/app/App.tsx` owns a small phase machine:

```
boot ──▶ login ──▶ desktop ──▶ locked
  ▲        │           │          │
  │        ▼           ▼          ▼
  └──── restart ◀── shutdown ──▶ off
```

- `boot` renders `BootScreen` (skippable, time-based progress).
- `login` / `locked` render `LoginScreen` in two modes; the counter-field is cosmetic and never
  persisted.
- `desktop` renders `Desktop`, which mounts the panel, window layer, menus and intro animation.
- `sessionStorage['nova.session']` only stores `active` or `locked`, so a refresh restores the
  desktop but a new tab starts at the boot splash.
- Restart resets the window manager and returns to the boot splash; shutdown renders a power-off
  screen with an explicit "Power on" action.

## 2. Stores (Zustand)

| Store | File | Responsibility |
| --- | --- | --- |
| `useSettings` | `core/themes/settingsStore.ts` | Every UI preference, persisted to LocalStorage via `persist`. |
| `useWindows` | `core/window-manager/windowsStore.ts` | Open windows, z-index, focus, geometry, minimise/maximise. |
| `useShell` | `core/apps/shellStore.ts` | Single source of truth for which overlay is open (`appmenu`, `quick`, `notifications`, `calendar`, `power`). |
| `useLauncher` | `core/apps/launcherStore.ts` | Installed apps, favourites, recents. |
| `useNotifications` | `core/notifications/notificationsStore.ts` | Notification queue + read state. |
| `useFiles` | `core/virtual-filesystem/fsStore.ts` | Virtual file system nodes and every mutation, mirrored to IndexedDB. |
| `useUsage` | `core/analytics/usage.ts` | Local launch counters per app (LocalStorage, never transmitted). |

Rules:

- Stores never import React components; components import stores.
- `core/apps/appMeta.ts` is pure data so the window store can resolve titles and sizes without
  pulling the component registry (no import cycles).
- Only one overlay may be open at a time — everything routes through `useShell`.

## 3. App contract

```ts
export interface AppWindowProps {
  win: WindowInstance;       // geometry, title, payload
}

export const APP_COMPONENTS: Record<AppId, ComponentType<AppWindowProps>> = { … };
```

An app receives its window instance and reads/writes global state directly. Deep links use
`win.payload` (`path`, `folderPath`, `section`, `tab`, `date`, `untitled`, `query`). Files are opened
through `services/fileActions.openNode()`, which maps a node to an app via
`core/apps/types.fileAppFor()`.

## 4. Window manager

- `metrics.ts` computes the work area from the viewport, the active panel side and the simulated
  resolution; `currentMetrics()` is used by the store so new windows always open inside the work area.
- `WindowFrame` handles pointer-based move/resize with `pointercapture`, keeps interaction state
  local (so dragging does not re-render the tree), and writes final geometry to the store.
- `WindowManager` re-clamps every window when metrics change (panel move, resolution change,
  mobile breakpoint crossing).
- `session.ts` holds the pure geometry layer: `LAYOUTS`, `SNAP_PRESETS` and `layoutRects(id, area, n)`
  return the rectangles for the five multi-window layouts, so the layout menu and the tests share one
  implementation. Snapshots (`saveSession`/`loadSession`/`clearSession`) serialise up to twelve
  windows — app id, title, rounded rect, maximised/snapped state, workspace, minimised flag and a
  payload filtered down to string/boolean values. A corrupt or older snapshot is ignored, never
  applied partially.
- `core/sync/broadcast.ts` mirrors the shell between tabs of the same origin over `BroadcastChannel`:
  window state, session saves, theme changes, file mutations and notifications. It is
  broadcast-only (no server), and it ignores its own messages through a per-tab id.

## 5. Virtual file system

`fsStore` keeps a flat `Record<id, FSNode>` with parent pointers — cheap updates, easy ancestor
checks. Path helpers (`pathOf`, `findByPath`, `resolvePath`, `childrenOf`, `breadcrumbs`) live in
`fsUtils.ts` and are pure functions over the node map.

- Seed data (`seed.ts`) is a simulated disk image: `/home/demo/...`, `/usr/share/...`, a read-only
  system tree, sample documents and one image.
- Deletion is two-phase: `trashNode` sets `trashed`, `deletedAt` and `trashedFrom`;
  `restoreNode` undoes it; `deleteForever` removes the node and its descendants.
- Every mutation writes through to IndexedDB (`fsPut`, `fsDelete`, `fsPutMany`). If storage is
  unavailable the wrapper degrades to memory and the shell shows a warning banner.

## 6. Persistence

`core/persistence/db.ts` is a dependency-free IndexedDB wrapper with three stores: `fs`, `kv` and
`meta` (schema version). `kvStore.ts` builds `PersistedValue<T>` on top of it — a tiny observable
container with `usePersistedValue()` for React and plain `get()/set()` for services and tests.

Writes are debounced per key, data is validated on load, and a failed open falls back to an
in-memory adapter rather than throwing.

Backups (`services/backup.ts`) serialise settings, launcher state, file nodes and app KV data into one
JSON envelope with an explicit `version` so future migrations are possible.

## 7. Styling

Six stylesheets, loaded in order:

1. `tokens.css` — CSS custom properties: colours, radii, shadows, motion, layout metrics, themes.
2. `base.css` — reset, typography, shared primitives (buttons, inputs, tables, modal, menus, toasts).
3. `shell.css` — desktop, wallpaper, windows, panel, popovers, applications menu, boot/login.
4. `apps.css` — per-application layouts (templates, usage bars, reset preview).
5. `code.css` — the editor (explorer, palette, Markdown preview split).
6. `docs.css` — the Markdown renderer (`.md`) and the Documentation reader; `media.css` and
   `games.css` cover the media apps and the games grid.

Conventions:

- Only logical properties (`inset-inline-start`, `margin-inline-end`) so RTL works without overrides.
- No component sets a raw colour; accents are `rgba(var(--accent-rgb), …)`.
- Sizes that matter to the window manager are CSS variables set from metrics (`--panel-h`,
  `--titlebar-h`, `--radius-window`, `--window-alpha`, `--panel-alpha`, `--font-scale`).
- Reduced motion is a CSS-variable multiplier plus a global `prefers-reduced-motion` rule.

## 8. Localization

`core/localization/i18n.ts` uses **English source strings as keys** and a Persian dictionary.
`useT()` returns a memoised translator; `formatLocalizedDate()` formats with `fa-IR` (Jalali
calendar) or `en-US`. A missing Persian entry falls back to English rather than showing a key.
`applyTheme` sets `dir`/`lang` and the `data-language` attribute used by the font stack.

## 9. Testing strategy

See `docs/TESTING.md`. Unit tests cover pure logic (formula engine, totals, path helpers) and
component tests drive real interactions against the stores. The 61-point checklist is executed
manually against a production build before a release.

## 10. Extension checklist

Adding an app:

1. `src/apps/<name>/<Name>App.tsx` exporting a component with `AppWindowProps`.
2. Metadata entry in `APP_META` (name, description, category, colour, default size, singleton?).
3. Register the component in `core/apps/registry.ts`.
4. Add classes to `styles/apps.css`; add Persian strings for visible labels.
5. Add a render smoke test to `tests/ui.test.tsx` (it iterates the registry automatically).

## 11. Shell layers added in the latest round

| Layer | Module | Notes |
| --- | --- | --- |
| Command palette | `components/desktop/CommandPalette.tsx` + `shellStore.paletteOpen` | One command list built from apps, open windows, shell actions and workspaces. |
| Virtual desktops | `windowsStore.workspace`, `workspaceOf()` | Windows carry a `workspace` field; windows of other desktops stay mounted but hidden so app state survives a switch. |
| Tiling | `windowsStore.snapWindow()` | Pure rect presets over `currentMetrics().workArea`; the drag handler in `WindowFrame` maps edges/corners to them. |
| Overview (Exposé) | `components/desktop/Overview.tsx` | Lists windows with real geometry; no fake screenshots. |
| Screensaver | `components/desktop/Screensaver.tsx` | Idle timer from `settings.screensaverMinutes`; any input dismisses. |
| Onboarding tour | `components/desktop/OnboardingTour.tsx` | `localStorage['nova.tour.seen']`, also reachable via the `tour` overlay. |
| Shortcut sheet | `components/desktop/ShortcutsSheet.tsx` | Single source of truth rendered from a data table; opened with `Shift + ?`. |
| Code splitting | `core/apps/registry.ts` | `React.lazy` per app + `manualChunks` for react/motion/icons/state. |
| Sounds | `core/audio/sfx.ts` | Web Audio synthesis, gated by `settings.sounds` and the simulated volume. |
| PWA | `public/sw.js`, `core/pwa/register.ts`, `public/manifest.webmanifest` | Shell precache, network-first navigations, no caching of third-party APIs. |
| Weather | `apps/weather/weatherLogic.ts` | WMO vocabulary + payload mapping kept pure for unit tests. |

## 12. The Code editor (round 3)

`src/apps/code/codeUtils.ts` holds the pure half and is the only part the tests touch:

| Export | Responsibility |
| --- | --- |
| `detectLanguage(path)` / `LANGUAGE_LABEL` | Extension → language id and human label (ts, js, json, css, html, md, sh, txt). |
| `tokenize(code, language)` | Returns `{ kind, value }[]` per line: `comment`, `string`, `number`, `keyword`, `function`, `property`, `plain`. A `memberAccess` look-behind stops keyword-like property names (`obj.return`) from being painted as keywords. |
| `findInFile(text, query)` | Case-insensitive match list with offsets, used by the find panel for the count and wrap-around. |
| `indentSelection(value, start, end, outdent)` | Multi-line indent/outdent that returns the new text plus the new selection, so `Tab` behaves like an editor and not like a focus trap. |
| `caretPosition(value, offset)` / `lineCount(value)` | Status-bar line/column and gutter height. |

`CodeApp.tsx` is the view only: an explorer over `~/Projects` (seeded from `STARTER_FILES` on first
open), a tab strip with per-file dirty state, a line-number gutter, a `<pre>` highlight layer under a
transparent `<textarea>` (which keeps native undo, selection and IME behaviour), a find panel and a
status bar. Saving calls the same `updateContent(id, text)` action Files uses, so both apps agree on
file content. Below 760 px the explorer becomes an overlay (`.code__sidebar--overlay`).

Code extensions are routed here by `core/apps/types.ts`: `CODE_EXTENSIONS` maps `.ts/.tsx/.js/.jsx/
.json/.css/.html/.md/.sh` to the `code` app, so opening such a file from Files or the desktop lands in
the editor instead of the note viewer.

## 13. Round 4 modules

| Module | Responsibility |
| --- | --- |
| `core/window-manager/session.ts` | Session snapshots + `layoutRects()` / `LAYOUTS` / `SNAP_PRESETS` (pure). |
| `core/sync/broadcast.ts` | `startCrossTabSync`, `useCrossTabSync`, `saveSessionNow`, `broadcastNotification`, presence pings. |
| `apps/terminal/shell.ts` | The whole simulated shell as a pure function: `tokenizeCommand`, `splitUnquoted`, `runLine(input, ctx)` → `{ lines, effects, cwd }`. Pipelines and redirection are composed there, so the terminal component only applies effects to the FS store. |
| `core/markdown/markdown.ts` | Block + inline parser (`parseMarkdown`, `parseInline`, `markdownToText`, `slugify`). No raw HTML is ever produced. |
| `components/common/MarkdownView.tsx` | The single renderer used by both the Documentation app and Code's preview. |
| `core/docs/content.ts` + `apps/docs/DocsApp.tsx` | `README.md` and `docs/*.md` imported with `?raw`, rendered with a section index and search. |
| `core/analytics/usage.ts` | `useUsage` (counts/lastUsed/totalOpens) + `usageRows()` for the About panel. |
| `services/storageReport.ts` | `profileReport()` builds the "what will be deleted" list; `resetProfile()` performs the reset in a fixed order. |
| `apps/writer/templates.ts`, `apps/impress/templates.ts` | Templates as data: Writer HTML bodies (with `rtl`), Impress `build(): DeckModel` factories. |
| `utils/image.ts` | `compressImage(file)` — canvas downscale to 1920 px, used by Settings and desktop drag & drop. |

## 14. Responsive contract (round 3, extended)

Breakpoints are owned per stylesheet and asserted by `tests/responsive.test.ts`, so a refactor that
drops one fails CI:

| Sheet | Breakpoints | Notes |
| --- | --- | --- |
| `shell.css` | 900, 760, 720, 420 | Panel compaction, palette/overview/shortcut-sheet/screensaver full-width. |
| `apps.css` | 860, 640 | Generic app layouts: sidebars collapse, grids reflow. |
| `games.css` | 860, 620, 400 | One card per row, board cell `--mines-cell` 22 → 18 → 15 px. |
| `media.css` | 860, 640 | Music/Photos/Weather panes stack. |
| `code.css` | 760 | Explorer becomes an overlay, Markdown preview stacks vertically; reduced-motion block added. |
| `docs.css` | 760, 480 | The reader's sidebar becomes a horizontal tab strip; headings and code blocks shrink. |

Rules that the test enforces: no fixed `width` above 640 px in the round-3 sheets, only
`repeat(auto-fill, minmax(...))` for card grids, `@media (prefers-reduced-motion: reduce)` in every
animated sheet, and the viewport/PWA meta tags in `index.html`.
