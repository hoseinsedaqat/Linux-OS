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

Four stylesheets, loaded in order:

1. `tokens.css` — CSS custom properties: colours, radii, shadows, motion, layout metrics, themes.
2. `base.css` — reset, typography, shared primitives (buttons, inputs, tables, modal, menus, toasts).
3. `shell.css` — desktop, wallpaper, windows, panel, popovers, applications menu, boot/login.
4. `apps.css` — per-application layouts.

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
component tests drive real interactions against the stores. The 30-point checklist is executed
manually against a production build before a release.

## 10. Extension checklist

Adding an app:

1. `src/apps/<name>/<Name>App.tsx` exporting a component with `AppWindowProps`.
2. Metadata entry in `APP_META` (name, description, category, colour, default size, singleton?).
3. Register the component in `core/apps/registry.ts`.
4. Add classes to `styles/apps.css`; add Persian strings for visible labels.
5. Add a render smoke test to `tests/ui.test.tsx` (it iterates the registry automatically).
