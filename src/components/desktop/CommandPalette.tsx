import { useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import {
  AppWindow,
  ArrowRight,
  CornerDownLeft,
  FileText,
  Grid2x2,
  Keyboard,
  Lock,
  Moon,
  Search,
  Settings2,
  Sun,
  TerminalSquare,
} from 'lucide-react';
import { APP_META, VISIBLE_APP_IDS } from '@/core/apps/appMeta';
import { fileAppFor } from '@/core/apps/types';
import { useFiles } from '@/core/virtual-filesystem/fsStore';
import { pathOf } from '@/core/virtual-filesystem/fsUtils';
import { useLauncher } from '@/core/apps/launcherStore';
import { useWindows, WORKSPACE_COUNT, workspaceOf } from '@/core/window-manager/windowsStore';
import { useSettings } from '@/core/themes/settingsStore';
import { useShell } from '@/core/apps/shellStore';
import { useT } from '@/core/localization/i18n';
import { AppIcon } from '@/components/common/AppIcon';
import type { AppId } from '@/types';
import { cn } from '@/utils';

interface Command {
  id: string;
  label: string;
  hint?: string;
  group: string;
  icon?: typeof Search;
  appId?: AppId;
  run: () => void;
}

interface CommandPaletteProps {
  open: boolean;
  onClose: () => void;
  onLock: () => void;
  onShowShortcuts: () => void;
}

/**
 * Ctrl+K — a real command palette: launch apps, jump to a workspace, switch the
 * theme or open shell panels. Every row performs an action; nothing is a stub.
 */
export function CommandPalette({ open, onClose, onLock, onShowShortcuts }: CommandPaletteProps) {
  const t = useT();
  const installed = useLauncher((state) => state.installed);
  const windows = useWindows((state) => state.windows);
  const openApp = useWindows((state) => state.openApp);
  const focusWindow = useWindows((state) => state.focusWindow);
  const switchWorkspace = useWindows((state) => state.switchWorkspace);
  const closeOverlays = useShell((state) => state.closeOverlays);
  const toggleOverlay = useShell((state) => state.toggleOverlay);
  const theme = useSettings((state) => state.theme);
  const setSetting = useSettings((state) => state.set);
  const nodes = useFiles((state) => state.nodes);
  const [query, setQuery] = useState('');
  const [index, setIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement | null>(null);
  const listRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!open) return;
    setQuery('');
    setIndex(0);
    const timer = window.setTimeout(() => inputRef.current?.focus(), 40);
    return () => window.clearTimeout(timer);
  }, [open]);

  const commands = useMemo<Command[]>(() => {
    const apps: Command[] = VISIBLE_APP_IDS.filter((id) => installed.includes(id)).map((id) => ({
      id: `app-${id}`,
      label: t(APP_META[id].name),
      hint: t(APP_META[id].category),
      group: t('Applications'),
      appId: id,
      run: () => {
        openApp(id);
        closeOverlays();
        onClose();
      },
    }));

    const openWindows: Command[] = windows
      .filter((win) => !win.minimized)
      .map((win) => ({
        id: `win-${win.id}`,
        label: win.title,
        hint: `${t('Workspace')} ${workspaceOf(win)}`,
        group: t('Open windows'),
        icon: AppWindow,
        run: () => {
          if (workspaceOf(win) !== useWindows.getState().workspace) {
            switchWorkspace(workspaceOf(win));
          }
          focusWindow(win.id);
          onClose();
        },
      }));

    const actions: Command[] = [
      {
        // Cycles Kali → Dark → Light → Kali, so the command never lies about
        // what it will do with the three themes we ship.
        id: 'theme',
        label:
          theme === 'kali'
            ? t('Switch to dark theme')
            : theme === 'dark'
              ? t('Switch to light theme')
              : t('Switch to Kali theme'),
        hint: t('Theme'),
        group: t('Actions'),
        icon: theme === 'kali' ? Moon : theme === 'dark' ? Sun : TerminalSquare,
        run: () => {
          setSetting('theme', theme === 'kali' ? 'dark' : theme === 'dark' ? 'light' : 'kali');
          onClose();
        },
      },
      {
        id: 'settings',
        label: t('Open Settings'),
        group: t('Actions'),
        icon: Settings2,
        run: () => {
          openApp('settings');
          onClose();
        },
      },
      {
        id: 'terminal',
        label: t('Open Terminal'),
        group: t('Actions'),
        icon: TerminalSquare,
        run: () => {
          openApp('terminal');
          onClose();
        },
      },
      {
        id: 'overview',
        label: t('Show all windows'),
        group: t('Actions'),
        icon: Grid2x2,
        run: () => {
          useShell.getState().openOverlay('overview');
          onClose();
        },
      },
      {
        id: 'shortcuts',
        label: t('Keyboard shortcuts'),
        group: t('Actions'),
        icon: Keyboard,
        run: () => {
          onClose();
          onShowShortcuts();
        },
      },
      {
        id: 'lock',
        label: t('Lock Screen'),
        group: t('Actions'),
        icon: Lock,
        run: () => {
          onClose();
          onLock();
        },
      },
    ];

    // Files: name matches always, content matches once the term is specific
    // enough to be useful (a 1-letter scan of every file is noise, not search).
    const term = query.trim().toLowerCase();
    const fileCommands: Command[] =
      term.length < 2
        ? []
        : Object.values(nodes)
            .filter((node) => node.kind !== 'folder' && !node.trashed)
            .flatMap((node) => {
              const name = node.name.toLowerCase();
              const content = (node.content ?? '').toLowerCase();
              const nameHit = name.includes(term);
              const contentHit = !nameHit && content.includes(term);
              if (!nameHit && !contentHit) return [];
              const at = contentHit ? Math.max(0, content.indexOf(term) - 24) : 0;
              const snippet = contentHit
                ? (node.content ?? '').slice(at, at + 70).replace(/\s+/g, ' ').trim()
                : pathOf(nodes, node.id);
              return [{
                id: `file-${node.id}`,
                label: node.name,
                hint: contentHit ? `…${snippet}…` : pathOf(nodes, node.id),
                group: t('Files'),
                icon: FileText,
                rank: nameHit ? 0 : 1,
                run: () => {
                  openApp(fileAppFor(node), { path: pathOf(nodes, node.id) });
                  onClose();
                },
              }];
            })
            .sort((a, b) => a.rank - b.rank || a.label.localeCompare(b.label))
            .slice(0, 8);

    const workspaces: Command[] = Array.from({ length: WORKSPACE_COUNT }, (_, i) => i + 1).map((n) => ({
      id: `ws-${n}`,
      label: t('Go to workspace {n}', { n }),
      group: t('Workspaces'),
      icon: ArrowRight,
      run: () => {
        switchWorkspace(n);
        onClose();
      },
    }));

    return [...fileCommands, ...apps, ...openWindows, ...actions, ...workspaces];
  }, [
    installed,
    windows,
    t,
    openApp,
    closeOverlays,
    onClose,
    focusWindow,
    switchWorkspace,
    theme,
    setSetting,
    onLock,
    onShowShortcuts,
    nodes,
    query,
  ]);

  const results = useMemo(() => {
    const term = query.trim().toLowerCase();
    if (!term) return commands.slice(0, 24);
    const files = commands.filter((command) => command.id.startsWith('file-'));
    const rest = commands.filter((command) => !command.id.startsWith('file-'));
    return [...files, ...rest]
      .filter((command) => `${command.label} ${command.hint ?? ''} ${command.group}`.toLowerCase().includes(term))
      .slice(0, 24);
  }, [commands, query]);

  useEffect(() => {
    setIndex(0);
  }, [query]);

  useEffect(() => {
    const node = listRef.current?.querySelector<HTMLElement>(`[data-index="${index}"]`);
    node?.scrollIntoView({ block: 'nearest' });
  }, [index]);

  if (!open || typeof document === 'undefined') return null;

  const grouped = results.reduce<Record<string, Array<{ command: Command; position: number }>>>((acc, command, position) => {
    acc[command.group] = acc[command.group] ?? [];
    acc[command.group].push({ command, position });
    return acc;
  }, {});

  return createPortal(
    <div className="palette-backdrop" onMouseDown={onClose}>
      <div
        className="palette"
        role="dialog"
        aria-modal="true"
        aria-label={t('Command palette')}
        onMouseDown={(event) => event.stopPropagation()}
        onKeyDown={(event) => {
          if (event.key === 'Escape') {
            event.preventDefault();
            onClose();
          } else if (event.key === 'ArrowDown') {
            event.preventDefault();
            setIndex((value) => (results.length === 0 ? 0 : (value + 1) % results.length));
          } else if (event.key === 'ArrowUp') {
            event.preventDefault();
            setIndex((value) => (results.length === 0 ? 0 : (value - 1 + results.length) % results.length));
          } else if (event.key === 'Enter') {
            event.preventDefault();
            results[index]?.run();
          }
        }}
      >
        <div className="palette__search">
          <Search size={16} />
          <input
            ref={inputRef}
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder={t('Type a command or app name…')}
            aria-label={t('Command palette')}
          />
          <span className="kbd">Esc</span>
        </div>

        <div className="palette__list" ref={listRef}>
          {results.length === 0 && <div className="palette__empty">{t('No matching command')}</div>}
          {Object.entries(grouped).map(([group, entries]) => (
            <div className="palette__group" key={group}>
              <div className="palette__group-title">{group}</div>
              {entries.map(({ command, position }) => {
                const Icon = command.icon;
                return (
                  <button
                    key={command.id}
                    data-index={position}
                    className={cn('palette__item', position === index && 'is-active')}
                    onMouseEnter={() => setIndex(position)}
                    onClick={command.run}
                  >
                    <span className="palette__item-icon">
                      {command.appId ? <AppIcon appId={command.appId} size="xs" plain /> : Icon ? <Icon size={14} /> : null}
                    </span>
                    <span className="palette__item-label">{command.label}</span>
                    {command.hint && <span className="palette__item-hint">{command.hint}</span>}
                    {position === index && <CornerDownLeft size={12} className="palette__item-enter" />}
                  </button>
                );
              })}
            </div>
          ))}
        </div>

        <div className="palette__foot">
          <span>
            <span className="kbd">↑</span> <span className="kbd">↓</span> {t('navigate')}
          </span>
          <span>
            <span className="kbd">↵</span> {t('run')}
          </span>
          <span>
            <span className="kbd">Ctrl</span> + <span className="kbd">K</span> {t('toggles this palette')}
          </span>
          <button
            className="palette__foot-link"
            onClick={() => {
              onClose();
              toggleOverlay('appmenu');
            }}
          >
            {t('Open the application menu')}
          </button>
        </div>
      </div>
    </div>,
    document.body,
  );
}
