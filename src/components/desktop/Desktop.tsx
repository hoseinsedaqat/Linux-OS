import { useCallback, useEffect, useMemo, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import {
  FilePlus2,
  FileSpreadsheet,
  FileText,
  FolderOpen,
  FolderPlus,
  Grid2x2,
  ImageIcon,
  MonitorCog,
  NotebookPen,
  PinOff,
  Presentation,
  Settings2,
  Sparkles,
  Star,
  StarOff,
  Trash2,
  User,
  Wand2,
} from 'lucide-react';
import type { AppId, FSNode, SettingsState } from '@/types';
import { useSettings } from '@/core/themes/settingsStore';
import { wallpaperClass } from '@/core/themes/applyTheme';
import { useFiles } from '@/core/virtual-filesystem/fsStore';
import { FOLDER_IDS, childrenOf } from '@/core/virtual-filesystem/fsUtils';
import { useWindows } from '@/core/window-manager/windowsStore';
import { computeMetrics, setActiveMetrics, type Metrics } from '@/core/window-manager/metrics';
import { useLauncher } from '@/core/apps/launcherStore';
import { useShell } from '@/core/apps/shellStore';
import { APP_META } from '@/core/apps/appMeta';
import { WindowManager } from '@/components/windows/WindowManager';
import { Panel } from '@/components/taskbar/Panel';
import { AppMenu } from '@/components/start-menu/AppMenu';
import { Toasts } from '@/components/common/Toasts';
import { AppIcon } from '@/components/common/AppIcon';
import { useContextMenu } from '@/components/common/ContextMenu';
import { PromptDialog } from '@/components/common/PromptDialog';
import { NovaLogo } from '@/components/common/NovaLogo';
import { Osd } from '@/components/common/Osd';
import { AppShortcutDialog } from '@/components/desktop/AppShortcutDialog';
import { useT } from '@/core/localization/i18n';
import { useUiStatus } from '@/core/persistence/kvStore';
import { notify, notifyError } from '@/core/notifications/notificationsStore';
import { templateFor } from '@/services/fileTemplates';
import { openNode } from '@/services/fileActions';
import { cn, formatBytes, fileSize } from '@/utils';

interface DesktopProps {
  onLock: () => void;
  onShutdown: () => void;
  onRestart: () => void;
}

interface CanvasRect {
  left: number;
  top: number;
  width: number;
  height: number;
}

function canvasFor(viewport: { width: number; height: number }, resolution: SettingsState['virtualResolution']): CanvasRect {
  if (resolution === 'auto') {
    return { left: 0, top: 0, width: viewport.width, height: viewport.height };
  }
  const [width, height] = resolution.split('x').map(Number);
  const margin = 18;
  const scale = Math.min((viewport.width - margin * 2) / width, (viewport.height - margin * 2) / height);
  const canvasWidth = Math.round(width * scale);
  const canvasHeight = Math.round(height * scale);
  return {
    left: Math.round((viewport.width - canvasWidth) / 2),
    top: Math.round((viewport.height - canvasHeight) / 2),
    width: canvasWidth,
    height: canvasHeight,
  };
}

export function Desktop({ onLock, onShutdown, onRestart }: DesktopProps) {
  const t = useT();
  const settings = useSettings();
  const nodes = useFiles((state) => state.nodes);
  const ready = useFiles((state) => state.ready);
  const createFolder = useFiles((state) => state.createFolder);
  const trashNode = useFiles((state) => state.trashNode);
  const renameNode = useFiles((state) => state.renameNode);
  const openApp = useWindows((state) => state.openApp);
  const openWindows = useWindows((state) => state.windows);
  const minimizeAll = useWindows((state) => state.minimizeAll);
  const overlay = useShell((state) => state.overlay);
  const toggleOverlay = useShell((state) => state.toggleOverlay);
  const desktopApps = useLauncher((state) => state.desktopApps);
  const installed = useLauncher((state) => state.installed);
  const favorites = useLauncher((state) => state.favorites);
  const menu = useContextMenu();
  const uiWarning = useUiStatus((state) => state.storageWarning);
  const reduceMotion = settings.reduceMotion;

  const [viewport, setViewport] = useState(() => ({
    width: window.innerWidth,
    height: window.innerHeight,
  }));
  const [selected, setSelected] = useState<string | null>(null);
  const [shortcutDialog, setShortcutDialog] = useState(false);
  const [prompt, setPrompt] = useState<{ mode: 'folder' | 'text' | 'rename'; node?: FSNode } | null>(null);
  const [introVisible, setIntroVisible] = useState(!sessionStorage.getItem('nova.introShown'));

  const coarsePointer = useMemo(
    () => typeof window !== 'undefined' && window.matchMedia?.('(pointer: coarse)').matches,
    [],
  );

  useEffect(() => {
    const onResize = () => setViewport({ width: window.innerWidth, height: window.innerHeight });
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, []);

  const canvas = useMemo(() => canvasFor(viewport, settings.virtualResolution), [viewport, settings.virtualResolution]);

  const metrics: Metrics = useMemo(
    () =>
      computeMetrics(
        canvas.width,
        canvas.height,
        { ...settings, panelPosition: settings.panelPosition },
        true,
      ),
    [canvas.width, canvas.height, settings],
  );

  useEffect(() => {
    setActiveMetrics(metrics);
    return () => setActiveMetrics(null);
  }, [metrics]);

  useEffect(() => {
    if (!introVisible) return;
    const timer = window.setTimeout(() => {
      setIntroVisible(false);
      sessionStorage.setItem('nova.introShown', '1');
    }, 1600);
    return () => window.clearTimeout(timer);
  }, [introVisible]);

  useEffect(() => {
    if (!ready) return;
    if (sessionStorage.getItem('nova.welcomed') === '1') return;
    const timer = window.setTimeout(() => {
      openApp('welcome');
      sessionStorage.setItem('nova.welcomed', '1');
    }, 900);
    return () => window.clearTimeout(timer);
  }, [ready, openApp]);

  const desktopFiles = useMemo(
    () => (nodes[FOLDER_IDS.desktop] ? childrenOf(nodes, FOLDER_IDS.desktop) : []),
    [nodes],
  );
  const trashCount = Object.values(nodes).filter((node) => node.trashed && !node.system).length;

  /** App icons = the persisted desktop order, restricted to installed apps. */
  const appIcons = useMemo(
    () => desktopApps.filter((id) => installed.includes(id) && APP_META[id]),
    [desktopApps, installed],
  );

  const createItem = useCallback(
    (kind: 'folder' | 'text' | 'document' | 'spreadsheet' | 'presentation' | 'note') => {
      const desktopId = nodes[FOLDER_IDS.desktop]?.id;
      if (!desktopId) return;
      if (kind === 'folder') {
        setPrompt({ mode: 'folder' });
        return;
      }
      if (kind === 'text') {
        setPrompt({ mode: 'text' });
        return;
      }
      const template = templateFor(kind);
      const created = useFiles.getState().createFile(desktopId, template.name, {
        content: template.content,
        kind: template.kind,
        meta: template.meta,
      });
      if (!created) {
        notifyError(t('Could not create file'));
        return;
      }
      notify(t('Created'), { body: created.name, kind: 'success' });
      setSelected(created.id);
      openNode(created);
    },
    [nodes, t],
  );

  const desktopMenu = (event: React.MouseEvent) => {
    event.preventDefault();
    menu.open(event, [
      { id: 'head-new', heading: t('Create new') },
      { id: 'new-folder', label: t('New Folder'), icon: FolderPlus, onClick: () => createItem('folder') },
      { id: 'new-text', label: t('New Text File'), icon: FilePlus2, onClick: () => createItem('text') },
      { id: 'new-doc', label: t('New Document'), icon: FileText, onClick: () => createItem('document') },
      { id: 'new-sheet', label: t('New Spreadsheet'), icon: FileSpreadsheet, onClick: () => createItem('spreadsheet') },
      { id: 'new-deck', label: t('New Presentation'), icon: Presentation, onClick: () => createItem('presentation') },
      { id: 'new-note', label: t('New Note'), icon: NotebookPen, onClick: () => createItem('note') },
      { id: 'sep-1', separator: true },
      {
        id: 'add-shortcut',
        label: t('Add app shortcut…'),
        icon: Grid2x2,
        onClick: () => setShortcutDialog(true),
      },
      {
        id: 'wallpaper',
        label: t('Change Wallpaper'),
        icon: ImageIcon,
        onClick: () => openApp('settings', { section: 'wallpapers' }),
      },
      {
        id: 'display',
        label: t('Display Settings'),
        icon: MonitorCog,
        onClick: () => openApp('settings', { section: 'display' }),
      },
      { id: 'apps', label: t('Applications'), icon: Sparkles, onClick: () => toggleOverlay('appmenu') },
      { id: 'sep-2', separator: true },
      {
        id: 'min-all',
        label: t('Show Desktop'),
        icon: User,
        onClick: () => minimizeAll(),
      },
      {
        id: 'tidy',
        label: t('Restore default icons'),
        icon: Wand2,
        onClick: () => {
          useLauncher.getState().resetDesktop();
          notify(t('Desktop icons restored'), { body: t('Default set'), kind: 'success' });
        },
      },
      {
        id: 'open-files',
        label: t('Open in Files'),
        icon: FolderOpen,
        onClick: () => openApp('files', { folderPath: '/home/demo/Desktop' }),
      },
    ]);
  };

  const appMenu = (event: React.MouseEvent, appId: AppId) => {
    event.preventDefault();
    event.stopPropagation();
    const isPinned = favorites.includes(appId);
    const meta = APP_META[appId];
    menu.open(event, [
      { id: 'open', label: t('Open'), onClick: () => openApp(appId) },
      { id: 'sep-0', separator: true },
      { id: 'head-app', heading: t(meta.name) },
      {
        id: 'remove-desktop',
        label: t('Remove from Desktop'),
        icon: PinOff,
        onClick: () => {
          useLauncher.getState().removeFromDesktop(appId);
          notify(t('Removed from Desktop'), { body: t(meta.name), kind: 'info' });
        },
      },
      {
        id: 'pin',
        label: isPinned ? t('Unpin from panel') : t('Pin to panel'),
        icon: isPinned ? StarOff : Star,
        onClick: () => useLauncher.getState().toggleFavorite(appId),
      },
      {
        id: 'move-left',
        label: t('Move left'),
        disabled: desktopApps.indexOf(appId) <= 0,
        onClick: () => useLauncher.getState().moveDesktopApp(appId, -1),
      },
      {
        id: 'move-right',
        label: t('Move right'),
        disabled: desktopApps.indexOf(appId) >= desktopApps.length - 1,
        onClick: () => useLauncher.getState().moveDesktopApp(appId, 1),
      },
      ...(appId === 'trash'
        ? [
            { id: 'sep-1', separator: true },
            {
              id: 'empty',
              label: t('Empty Trash'),
              icon: Trash2,
              danger: true,
              disabled: trashCount === 0,
              onClick: () => {
                useFiles.getState().emptyTrash();
                notify(t('Trash emptied'), { kind: 'info' });
              },
            },
          ]
        : []),
    ]);
  };

  const iconMenu = (event: React.MouseEvent, node: FSNode) => {
    event.preventDefault();
    event.stopPropagation();
    menu.open(event, [
      { id: 'open', label: t('Open'), onClick: () => openNode(node) },
      { id: 'sep-0', separator: true },
      ...(node.system
        ? [
            {
              id: 'sys',
              label: t('System files are part of the simulator image.'),
              disabled: true,
            },
          ]
        : [
            {
              id: 'rename',
              label: t('Rename'),
              onClick: () => setPrompt({ mode: 'rename', node }),
            },
          ]),
      { id: 'sep-1', separator: true },
      {
        id: 'props',
        label: t('Properties'),
        onClick: () =>
          notify(node.name, {
            body: `${t('Size')}: ${node.kind === 'folder' ? '—' : formatBytes(fileSize(node))} · ${t('Modified')}: ${new Date(node.modifiedAt).toLocaleString()}`,
            kind: 'info',
          }),
      },
      ...(node.system
        ? []
        : [
            {
              id: 'trash',
              label: t('Move to Trash'),
              icon: Trash2,
              danger: true,
              onClick: () => {
                trashNode(node.id);
                notify(t('Moved to Trash'), { body: node.name, kind: 'info' });
              },
            },
          ]),
    ]);
  };

  const onKeyDown = (event: React.KeyboardEvent) => {
    if (!selected) return;
    if (event.key === 'Enter') {
      const appId = appIcons.find((id) => `app:${id}` === selected);
      if (appId) openApp(appId);
      const file = desktopFiles.find((node) => node.id === selected);
      if (file) openNode(file);
    }
    if (event.key === 'F2') {
      const file = desktopFiles.find((node) => node.id === selected);
      if (file && !file.system) setPrompt({ mode: 'rename', node: file });
    }
    if (event.key === 'Delete') {
      const file = desktopFiles.find((node) => node.id === selected);
      if (file && !file.system) {
        trashNode(file.id);
        notify(t('Moved to Trash'), { body: file.name, kind: 'info' });
        setSelected(null);
      }
    }
    if (event.key === 'Escape') setSelected(null);
  };

  const wallpaperStyle = useMemo<React.CSSProperties>(() => {
    if (settings.wallpaper === 'custom' && settings.customWallpaper) {
      return { backgroundImage: `url(${settings.customWallpaper})` };
    }
    return {};
  }, [settings.wallpaper, settings.customWallpaper]);

  const dimOpacity = Math.max(0, Math.min(0.86, (100 - settings.brightness) / 100 * 0.86));

  return (
    <div className="nova-root desktop" onContextMenu={desktopMenu} style={{ background: '#04070a' }}>
      <div
        className="desktop__canvas"
        style={
          {
            position: 'absolute',
            left: canvas.left,
            top: canvas.top,
            width: canvas.width,
            height: canvas.height,
            overflow: 'hidden',
            borderRadius: settings.virtualResolution === 'auto' ? 0 : Math.max(10, settings.cornerRadius + 6),
            boxShadow:
              settings.virtualResolution === 'auto'
                ? 'none'
                : '0 40px 120px -40px rgba(0,0,0,0.9), 0 0 0 1px rgba(255,255,255,0.08)',
            '--panel-h': `${metrics.panelThickness}px`,
          } as React.CSSProperties
        }
        onPointerDown={() => setSelected(null)}
        onKeyDown={onKeyDown}
      >
        <div className={cn('wallpaper', wallpaperClass(settings.wallpaper))} style={wallpaperStyle}>
          <span className="wallpaper__grain" aria-hidden />
          <span className="wallpaper__vignette" aria-hidden />
        </div>

        {uiWarning && (
          <div className="desktop__warning">
            {t('Browser storage is unavailable. Changes will only last until you close this tab.')}
          </div>
        )}

        <div className="desktop__surface">
          <div className="desktop__icons" role="list">
            {appIcons.map((appId) => {
              const meta = APP_META[appId];
              const key = `app:${appId}`;
              return (
                <button
                  key={key}
                  role="listitem"
                  type="button"
                  className={cn('desktop-icon', selected === key && 'is-selected')}
                  onPointerDown={(event) => event.stopPropagation()}
                  onClick={() => {
                    setSelected(key);
                    // Touch screens have no double-click gesture.
                    if (coarsePointer) openApp(appId);
                  }}
                  onDoubleClick={() => {
                    if (!coarsePointer) openApp(appId);
                  }}
                  onContextMenu={(event) => appMenu(event, appId)}
                  title={t(meta.description)}
                  aria-label={t(meta.name)}
                >
                  <span className="desktop-icon__tile">
                    <AppIcon appId={appId} size="xl" />
                    {appId === 'trash' && trashCount > 0 && <span className="desktop-icon__badge">{trashCount}</span>}
                    {openWindows.some((win) => win.appId === appId) && (
                      <span className="desktop-icon__dot" aria-hidden />
                    )}
                  </span>
                  <span className="desktop-icon__label">{t(meta.name)}</span>
                </button>
              );
            })}

            {desktopFiles.map((node) => (
              <button
                key={node.id}
                role="listitem"
                type="button"
                className={cn('desktop-icon', selected === node.id && 'is-selected')}
                onPointerDown={(event) => event.stopPropagation()}
                onClick={() => {
                  setSelected(node.id);
                  if (coarsePointer) openNode(node);
                }}
                onDoubleClick={() => {
                  if (!coarsePointer) openNode(node);
                }}
                onContextMenu={(event) => iconMenu(event, node)}
                title={node.name}
                aria-label={node.name}
              >
                <span className="desktop-icon__tile">
                  <FileGlyph node={node} />
                </span>
                <span className="desktop-icon__label">{node.name}</span>
              </button>
            ))}
          </div>
        </div>

        <WindowManager metrics={metrics} />

        <div className="desktop__brightness" style={{ opacity: dimOpacity }} />

        <Panel metrics={metrics} onLock={onLock} onShutdown={onShutdown} onRestart={onRestart} />

        <AppMenu open={overlay === 'appmenu'} onLock={onLock} onShutdown={onShutdown} />

        <AnimatePresence>
          {introVisible && !reduceMotion && (
            <motion.div
              className="session-intro"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.45 }}
            >
              <div className="session-intro__stage">
                <span className="session-intro__ring session-intro__ring--1" aria-hidden />
                <span className="session-intro__ring session-intro__ring--2" aria-hidden />
                <motion.div
                  className="session-intro__mark"
                  initial={{ scale: 0.82, opacity: 0 }}
                  animate={{ scale: 1, opacity: 1 }}
                  transition={{ duration: 0.7, ease: [0.22, 1, 0.36, 1] }}
                >
                  <span className="session-intro__logo">
                    <NovaLogo size={56} />
                  </span>
                </motion.div>
              </div>

              <div className="session-intro__text">
                <div className="session-intro__wordmark">
                  NOVA <span>LINUX</span>
                </div>
                <div className="session-intro__caption">{t('Welcome back, Demo User')}</div>
              </div>

              <div className="session-intro__bar" aria-hidden>
                <span />
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {!ready && (
          <div className="desktop__loading" role="status" aria-live="polite">
            <span className="poweroff__spinner" />
            <span className="desktop__loading-label">{t('Preparing your workspace…')}</span>
          </div>
        )}
      </div>

      {settings.virtualResolution !== 'auto' && (
        <div className="desktop__monitor-label">
          <Settings2 size={12} /> {t('Virtual resolution')}: {settings.virtualResolution} — {t('simulated canvas')}
        </div>
      )}

      <Toasts />
      <Osd />
      {menu.node}

      <AppShortcutDialog open={shortcutDialog} onClose={() => setShortcutDialog(false)} />

      <PromptDialog
        open={prompt?.mode === 'folder'}
        title={t('New Folder')}
        label={t('New folder name')}
        initialValue="New Folder"
        onCancel={() => setPrompt(null)}
        onSubmit={(name) => {
          const id = nodes[FOLDER_IDS.desktop]?.id;
          if (!id) return;
          const created = createFolder(id, name);
          if (created) {
            notify(t('Folder created'), { body: created.name, kind: 'success' });
            setSelected(created.id);
          }
        }}
      />
      <PromptDialog
        open={prompt?.mode === 'text'}
        title={t('New Text File')}
        label={t('New file name')}
        initialValue="New Text File.txt"
        onCancel={() => setPrompt(null)}
        onSubmit={(name) => {
          const id = nodes[FOLDER_IDS.desktop]?.id;
          if (!id) return;
          const created = useFiles.getState().createFile(id, name, { content: '' });
          if (created) {
            setSelected(created.id);
            openNode(created);
          }
        }}
      />
      <PromptDialog
        open={prompt?.mode === 'rename'}
        title={t('Rename')}
        label={t('Name')}
        initialValue={prompt?.node?.name ?? ''}
        onCancel={() => setPrompt(null)}
        onSubmit={(name) => {
          if (!prompt?.node) return;
          const ok = renameNode(prompt.node.id, name);
          if (!ok) notifyError(t('Name already exists'));
        }}
      />
    </div>
  );
}

function FileGlyph({ node }: { node: FSNode }) {
  if (node.kind === 'folder') return <AppIcon appId="files" size="xl" />;
  if (node.kind === 'spreadsheet') return <AppIcon appId="calc" size="xl" />;
  if (node.kind === 'presentation') return <AppIcon appId="impress" size="xl" />;
  if (node.kind === 'note') return <AppIcon appId="notes" size="xl" />;
  if (node.kind === 'document' || node.kind === 'text') return <AppIcon appId="writer" size="xl" />;
  return (
    <span className="app-tile app-tile--xl" style={{ ['--tile-color' as string]: '#8899ac' }}>
      <FileText size={26} strokeWidth={1.8} color="#fff" />
    </span>
  );
}
