import { useCallback, useEffect, useMemo, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import {
  FilePlus2,
  FileSpreadsheet,
  FileText,
  FolderPlus,
  ImageIcon,
  MonitorCog,
  NotebookPen,
  Presentation,
  Settings2,
  Sparkles,
  Trash2,
  User,
} from 'lucide-react';
import type { FSNode, SettingsState } from '@/types';
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

const SHORTCUTS: Array<{ key: string; appId: 'files' | 'browser' | 'writer' | 'calc' | 'accounting' | 'notes' | 'settings' | 'trash'; label: string }> = [
  { key: 'computer', appId: 'files', label: 'Computer' },
  { key: 'browser', appId: 'browser', label: 'Browser' },
  { key: 'writer', appId: 'writer', label: 'Writer' },
  { key: 'calc', appId: 'calc', label: 'Calc' },
  { key: 'accounting', appId: 'accounting', label: 'Accounting' },
  { key: 'notes', appId: 'notes', label: 'Notes' },
  { key: 'settings', appId: 'settings', label: 'Settings' },
  { key: 'trash', appId: 'trash', label: 'Trash' },
];

export function Desktop({ onLock, onShutdown, onRestart }: DesktopProps) {
  const t = useT();
  const settings = useSettings();
  const nodes = useFiles((state) => state.nodes);
  const ready = useFiles((state) => state.ready);
  const createFolder = useFiles((state) => state.createFolder);
  const trashNode = useFiles((state) => state.trashNode);
  const renameNode = useFiles((state) => state.renameNode);
  const openApp = useWindows((state) => state.openApp);
  const minimizeAll = useWindows((state) => state.minimizeAll);
  const overlay = useShell((state) => state.overlay);
  const toggleOverlay = useShell((state) => state.toggleOverlay);
  const favorites = useLauncher((state) => state.favorites);
  const menu = useContextMenu();
  const uiWarning = useUiStatus((state) => state.storageWarning);
  const reduceMotion = settings.reduceMotion;

  const [viewport, setViewport] = useState(() => ({
    width: window.innerWidth,
    height: window.innerHeight,
  }));
  const [selected, setSelected] = useState<string | null>(null);
  const [prompt, setPrompt] = useState<{ mode: 'folder' | 'text' | 'rename'; node?: FSNode } | null>(null);
  const [introVisible, setIntroVisible] = useState(!sessionStorage.getItem('nova.introShown'));

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

  const desktopFolder = nodes[FOLDER_IDS.desktop];
  const desktopFiles = desktopFolder ? childrenOf(nodes, FOLDER_IDS.desktop) : [];
  const trashCount = Object.values(nodes).filter((node) => node.trashed && !node.system).length;

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
      openNode(created);
    },
    [nodes, openNode, t],
  );

  const desktopMenu = (event: React.MouseEvent) => {
    event.preventDefault();
    menu.open(event, [
      { id: 'new-folder', label: t('New Folder'), icon: FolderPlus, onClick: () => createItem('folder') },
      { id: 'new-text', label: t('New Text File'), icon: FilePlus2, onClick: () => createItem('text') },
      { id: 'new-doc', label: t('New Document'), icon: FileText, onClick: () => createItem('document') },
      { id: 'new-sheet', label: t('New Spreadsheet'), icon: FileSpreadsheet, onClick: () => createItem('spreadsheet') },
      { id: 'new-deck', label: t('New Presentation'), icon: Presentation, onClick: () => createItem('presentation') },
      { id: 'new-note', label: t('New Note'), icon: NotebookPen, onClick: () => createItem('note') },
      { id: 'sep-1', separator: true },
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
        id: 'open-files',
        label: t('Open in Files'),
        icon: FileText,
        onClick: () => openApp('files', { folderPath: '/home/demo/Desktop' }),
      },
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

  const quickMenu = (event: React.MouseEvent, appId: (typeof SHORTCUTS)[number]['appId']) => {
    event.preventDefault();
    event.stopPropagation();
    const isPinned = favorites.includes(appId);
    menu.open(event, [
      { id: 'open', label: t('Open'), onClick: () => openApp(appId) },
      {
        id: 'pin',
        label: isPinned ? t('Unpin') : t('Pin'),
        onClick: () => useLauncher.getState().toggleFavorite(appId),
      },
      ...(appId === 'trash'
        ? [{ id: 'empty', label: t('Empty Trash'), danger: true, onClick: () => useFiles.getState().emptyTrash() }]
        : []),
    ]);
  };

  const wallpaperStyle = useMemo<React.CSSProperties>(() => {
    if (settings.wallpaper === 'custom' && settings.customWallpaper) {
      return { backgroundImage: `url(${settings.customWallpaper})` };
    }
    return {};
  }, [settings.wallpaper, settings.customWallpaper]);

  const dimOpacity = Math.max(0, Math.min(0.82, (100 - settings.brightness) / 118));

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
      >
        <div className={cn('wallpaper', wallpaperClass(settings.wallpaper))} style={wallpaperStyle} />

        {uiWarning && (
          <div className="desktop__warning">
            {t('Browser storage is unavailable. Changes will only last until you close this tab.')}
          </div>
        )}

        <div className="desktop__surface">
          <div className="desktop__icons" role="list">
            {SHORTCUTS.map((shortcut) => {
              const meta = APP_META[shortcut.appId];
              return (
                <button
                  key={shortcut.key}
                  role="listitem"
                  className={cn('desktop-icon', selected === shortcut.key && 'is-selected')}
                  onPointerDown={(event) => event.stopPropagation()}
                  onClick={() => setSelected(shortcut.key)}
                  onDoubleClick={() => openApp(shortcut.appId)}
                  onContextMenu={(event) => quickMenu(event, shortcut.appId)}
                  title={t(meta.name)}
                >
                  {shortcut.appId === 'trash' ? (
                    <span className="app-tile" style={{ ['--tile-color' as string]: '#6f8099' }}>
                      <Trash2 size={19} color="#fff" />
                      {trashCount > 0 && <span className="desktop-icon__badge">{trashCount}</span>}
                    </span>
                  ) : (
                    <AppIcon appId={shortcut.appId} size="md" />
                  )}
                  <span className="desktop-icon__label">{t(shortcut.label)}</span>
                </button>
              );
            })}
            {desktopFiles.map((node) => (
              <button
                key={node.id}
                role="listitem"
                className={cn('desktop-icon', selected === node.id && 'is-selected')}
                onPointerDown={(event) => event.stopPropagation()}
                onClick={() => setSelected(node.id)}
                onDoubleClick={() => openNode(node)}
                onContextMenu={(event) => iconMenu(event, node)}
                title={node.name}
              >
                <FileGlyph node={node} />
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
              transition={{ duration: 0.5 }}
            >
              <motion.div
                initial={{ scale: 0.8, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                exit={{ scale: 1.15, opacity: 0 }}
                transition={{ duration: 0.8, ease: [0.22, 1, 0.36, 1] }}
                className="session-intro__logo"
              >
                <NovaLogo size={96} />
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>

        {!ready && (
          <div className="desktop__loading">
            <span className="poweroff__spinner" />
            <span>{t('Loading…')}</span>
          </div>
        )}
      </div>

      {settings.virtualResolution !== 'auto' && (
        <div className="desktop__monitor-label">
          <Settings2 size={12} /> {t('Virtual resolution')}: {settings.virtualResolution} — {t('simulated canvas')}
        </div>
      )}

      <Toasts />
      {menu.node}

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
          if (created) notify(t('Folder created'), { body: created.name, kind: 'success' });
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
          if (created) openNode(created);
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
  const style = { color: '#e8eef6' };
  if (node.kind === 'folder') return <AppIcon appId="files" size="md" />;
  if (node.kind === 'spreadsheet') return <AppIcon appId="calc" size="md" />;
  if (node.kind === 'presentation') return <AppIcon appId="impress" size="md" />;
  if (node.kind === 'document' || node.kind === 'text') return <AppIcon appId="writer" size="md" />;
  if (node.kind === 'note') return <AppIcon appId="notes" size="md" />;
  return (
    <span className="app-tile" style={{ ['--tile-color' as string]: '#8899ac' }}>
      <FileText size={19} color="#fff" style={style} />
    </span>
  );
}
