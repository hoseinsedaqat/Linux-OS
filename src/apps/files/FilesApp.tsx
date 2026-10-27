import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ArrowLeft,
  ArrowRight,
  ArrowUp,
  Clipboard,
  Copy,
  Download,
  FilePlus2,
  FileSpreadsheet,
  FileText,
  Folder,
  FolderOpen,
  FolderPlus,
  Grid2x2,
  Home,
  Image as ImageIcon,
  Info,
  List,
  Monitor,
  Music,
  Pencil,
  Plus,
  Presentation,
  RotateCcw,
  Scissors,
  Search,
  Star,
  Trash2,
  Video,
  X,
} from 'lucide-react';
import type { FSNode, WindowPayload } from '@/types';
import type { AppWindowProps } from '@/core/apps/types';
import { useFiles } from '@/core/virtual-filesystem/fsStore';
import {
  FOLDER_IDS,
  HOME_ID,
  breadcrumbs,
  childrenOf,
  findByPath,
  pathOf,
  trashedNodes,
} from '@/core/virtual-filesystem/fsUtils';
import { useFileClipboard } from '@/core/virtual-filesystem/clipboard';
import { useLauncher } from '@/core/apps/launcherStore';
import { APP_META, VISIBLE_APP_IDS } from '@/core/apps/appMeta';
import { useWindows } from '@/core/window-manager/windowsStore';
import { useContextMenu, type MenuEntry } from '@/components/common/ContextMenu';
import { ConfirmDialog, Modal } from '@/components/common/Modal';
import { PromptDialog } from '@/components/common/PromptDialog';
import { EmptyState } from '@/components/common/Controls';
import { AppIcon } from '@/components/common/AppIcon';
import { useT } from '@/core/localization/i18n';
import { useSettings } from '@/core/themes/settingsStore';
import { notify, notifyError } from '@/core/notifications/notificationsStore';
import { openNode } from '@/services/fileActions';
import { templateFor } from '@/services/fileTemplates';
import { cn, downloadBlob, extensionOf, fileSize, formatBytes, formatDate } from '@/utils';

type Location =
  | { type: 'path'; id: string }
  | { type: 'trash' }
  | { type: 'recent' }
  | { type: 'favorites' }
  | { type: 'apps' };

type SortKey = 'name' | 'modifiedAt' | 'size' | 'kind';

const SIDEBAR: Array<{ key: string; label: string; icon: typeof Home; location: Location }> = [
  { key: 'home', label: 'Home', icon: Home, location: { type: 'path', id: HOME_ID } },
  { key: 'desktop', label: 'Desktop', icon: Monitor, location: { type: 'path', id: FOLDER_IDS.desktop } },
  { key: 'documents', label: 'Documents', icon: FileText, location: { type: 'path', id: FOLDER_IDS.documents } },
  { key: 'downloads', label: 'Downloads', icon: Download, location: { type: 'path', id: FOLDER_IDS.downloads } },
  { key: 'pictures', label: 'Pictures', icon: ImageIcon, location: { type: 'path', id: FOLDER_IDS.pictures } },
  { key: 'music', label: 'Music', icon: Music, location: { type: 'path', id: FOLDER_IDS.music } },
  { key: 'videos', label: 'Videos', icon: Video, location: { type: 'path', id: FOLDER_IDS.videos } },
  { key: 'notes', label: 'Notes', icon: FileText, location: { type: 'path', id: FOLDER_IDS.notes } },
  { key: 'favorites', label: 'Favorites', icon: Star, location: { type: 'favorites' } },
  { key: 'recent', label: 'Recent', icon: RotateCcw, location: { type: 'recent' } },
  { key: 'apps', label: 'Applications', icon: Grid2x2, location: { type: 'apps' } },
  { key: 'trash', label: 'Trash', icon: Trash2, location: { type: 'trash' } },
];

function initialLocation(winPayload: WindowPayload | undefined, isTrashApp: boolean): Location {
  if (isTrashApp) return { type: 'trash' };
  const path = winPayload?.folderPath ?? winPayload?.path;
  if (path) {
    const node = findByPath(useFiles.getState().nodes, path);
    if (node) return { type: 'path', id: node.kind === 'folder' ? node.id : node.parentId ?? HOME_ID };
  }
  return { type: 'path', id: HOME_ID };
}

export function FilesApp({ win }: AppWindowProps) {
  const t = useT();
  const language = useSettings((state) => state.language);
  const nodes = useFiles((state) => state.nodes);
  const clipboard = useFileClipboard();
  const installed = useLauncher((state) => state.installed);

  const [location, setLocation] = useState<Location>(() => initialLocation(win.payload, win.appId === 'trash'));
  const [history, setHistory] = useState<Location[]>([initialLocation(win.payload, win.appId === 'trash')]);
  const [historyIndex, setHistoryIndex] = useState(0);
  const [selected, setSelected] = useState<string[]>([]);
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');
  const [iconSize, setIconSize] = useState(84);
  const [sort, setSort] = useState<{ key: SortKey; dir: 'asc' | 'desc' }>({ key: 'name', dir: 'asc' });
  const [query, setQuery] = useState('');
  const [showInfo, setShowInfo] = useState(false);
  const [prompt, setPrompt] = useState<null | { kind: 'folder' | 'file' | 'rename'; node?: FSNode }>(null);
  const [confirm, setConfirm] = useState<null | { kind: 'empty-trash' | 'delete'; node?: FSNode }>(null);
  const [dragOver, setDragOver] = useState<string | null>(null);
  const [preview, setPreview] = useState<FSNode | null>(null);
  const menu = useContextMenu();
  const containerRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (win.payload?.folderPath || win.payload?.path) {
      const next = initialLocation(win.payload, win.appId === 'trash');
      setLocation(next);
      setHistory([next]);
      setHistoryIndex(0);
    }
    /* Opening an image from the desktop or another app shows a preview here. */
    if (win.payload?.path) {
      const node = findByPath(useFiles.getState().nodes, win.payload.path);
      if (node && node.kind === 'image') setPreview(node);
    }
  }, [win.payload, win.appId]);

  const navigate = useCallback((next: Location) => {
    setSelected([]);
    setQuery('');
    setLocation(next);
    setHistory((current) => [...current.slice(0, historyIndex + 1), next]);
    setHistoryIndex((index) => index + 1);
  }, [historyIndex]);

  const goBack = () => {
    if (historyIndex <= 0) return;
    setHistoryIndex(historyIndex - 1);
    setLocation(history[historyIndex - 1]);
    setSelected([]);
  };

  const goForward = () => {
    if (historyIndex >= history.length - 1) return;
    setHistoryIndex(historyIndex + 1);
    setLocation(history[historyIndex + 1]);
    setSelected([]);
  };

  const currentFolder = location.type === 'path' ? nodes[location.id] : undefined;

  const goUp = () => {
    if (location.type !== 'path' || !currentFolder?.parentId) return;
    navigate({ type: 'path', id: currentFolder.parentId });
  };

  const items = useMemo(() => {
    let list: FSNode[] = [];
    if (location.type === 'path') list = childrenOf(nodes, location.id);
    else if (location.type === 'trash') list = trashedNodes(nodes);
    else if (location.type === 'recent') {
      list = Object.values(nodes)
        .filter((node) => node.kind !== 'folder' && !node.trashed)
        .sort((a, b) => b.modifiedAt - a.modifiedAt)
        .slice(0, 80);
    } else if (location.type === 'favorites') {
      list = Object.values(nodes).filter((node) => node.starred && !node.trashed);
    }
    if (query.trim()) {
      const term = query.trim().toLowerCase();
      list = list.filter((node) => node.name.toLowerCase().includes(term));
    }
    const direction = sort.dir === 'asc' ? 1 : -1;
    return [...list].sort((a, b) => {
      if (a.kind === 'folder' && b.kind !== 'folder') return -1;
      if (b.kind === 'folder' && a.kind !== 'folder') return 1;
      switch (sort.key) {
        case 'modifiedAt':
          return (a.modifiedAt - b.modifiedAt) * direction;
        case 'size':
          return (fileSize(a) - fileSize(b)) * direction;
        case 'kind':
          return a.kind.localeCompare(b.kind) * direction;
        default:
          return a.name.localeCompare(b.name, language === 'fa' ? 'fa' : 'en', { numeric: true }) * direction;
      }
    });
  }, [nodes, location, query, sort, language]);

  const selectedNodes = items.filter((node) => selected.includes(node.id));
  const single = selectedNodes.length === 1 ? selectedNodes[0] : undefined;

  const currentPath = location.type === 'path' && nodes[location.id] ? pathOf(nodes, location.id) : '';
  const targetFolderId = location.type === 'path' ? location.id : null;

  const canPaste = clipboard.ids.length > 0 && Boolean(targetFolderId) && location.type !== 'trash';

  const openSelected = () => {
    if (!single) return;
    if (single.kind === 'folder') navigate({ type: 'path', id: single.id });
    else openNode(single);
  };

  const createAt = (kind: 'folder' | 'text' | 'document' | 'spreadsheet' | 'presentation' | 'note') => {
    if (!targetFolderId) return;
    if (kind === 'folder') {
      setPrompt({ kind: 'folder' });
      return;
    }
    if (kind === 'text') {
      setPrompt({ kind: 'file' });
      return;
    }
    const template = templateFor(kind);
    const created = useFiles.getState().createFile(targetFolderId, template.name, {
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
  };

  const doDelete = () => {
    if (!single) return;
    useFiles.getState().trashNode(single.id);
    notify(t('Moved to Trash'), { body: single.name, kind: 'info' });
    setSelected([]);
  };

  const doRestore = (node: FSNode) => {
    useFiles.getState().restoreNode(node.id);
    notify(t('Restored item'), { body: node.name, kind: 'success' });
    setSelected([]);
  };

  const paste = async () => {
    if (!targetFolderId || clipboard.ids.length === 0) return;
    for (const id of clipboard.ids) {
      const node = useFiles.getState().nodes[id];
      if (!node) continue;
      if (clipboard.mode === 'cut') {
        const ok = useFiles.getState().moveNode(id, targetFolderId);
        if (!ok) notifyError(t('Name already exists'), node.name);
      } else {
        const copy = useFiles.getState().duplicateNode(id);
        if (copy) {
          useFiles.getState().moveNode(copy.id, targetFolderId);
        }
      }
    }
    notify(t('Copied to clipboard'), { body: `${clipboard.ids.length} item(s)`, kind: 'success' });
    clipboard.clear();
  };

  const itemMenu = (event: React.MouseEvent, node: FSNode) => {
    event.preventDefault();
    event.stopPropagation();
    const inTrash = location.type === 'trash' || node.trashed;
    menu.open(event, [
      {
        id: 'open',
        label: t('Open'),
        disabled: node.kind === 'folder' && location.type !== 'path',
        onClick: () => (node.kind === 'folder' ? navigate({ type: 'path', id: node.id }) : openNode(node)),
      },
      { id: 's1', separator: true },
      ...(inTrash
        ? [
            { id: 'restore', label: t('Restore'), icon: RotateCcw, onClick: () => doRestore(node) },
            {
              id: 'purge',
              label: t('Delete permanently'),
              icon: Trash2,
              danger: true,
              onClick: () => setConfirm({ kind: 'delete', node }),
            },
          ]
        : [
            { id: 'rename', label: t('Rename'), icon: Pencil, disabled: node.system, onClick: () => setPrompt({ kind: 'rename', node }) },
            {
              id: 'copy',
              label: t('Copy'),
              icon: Copy,
              disabled: node.system,
              onClick: () => clipboard.set([node.id], 'copy', node.parentId),
            },
            {
              id: 'cut',
              label: t('Cut'),
              icon: Scissors,
              disabled: node.system,
              onClick: () => clipboard.set([node.id], 'cut', node.parentId),
            },
            {
              id: 'duplicate',
              label: t('Duplicate'),
              icon: FilePlus2,
              disabled: node.system || node.kind === 'folder',
              onClick: () => {
                useFiles.getState().duplicateNode(node.id);
                notify(t('Duplicated'), { body: node.name, kind: 'success' });
              },
            },
            {
              id: 'star',
              label: node.starred ? t('Remove from Favorites') : t('Add to Favorites'),
              icon: Star,
              onClick: () => useFiles.getState().toggleStar(node.id),
            },
            {
              id: 'trash',
              label: t('Move to Trash'),
              icon: Trash2,
              danger: true,
              disabled: node.system,
              onClick: () => {
                useFiles.getState().trashNode(node.id);
                notify(t('Moved to Trash'), { body: node.name, kind: 'info' });
                setSelected([]);
              },
            },
          ]),
      { id: 's2', separator: true },
      {
        id: 'props',
        label: t('Properties'),
        icon: Info,
        onClick: () => {
          setSelected([node.id]);
          setShowInfo(true);
        },
      },
    ]);
  };

  const newMenuEntries = (): MenuEntry[] => [
    { id: 'folder', label: t('New Folder'), icon: FolderPlus, onClick: () => createAt('folder') },
    { id: 'text', label: t('New Text File'), icon: FilePlus2, onClick: () => createAt('text') },
    { id: 'doc', label: t('New Document'), icon: FileText, onClick: () => createAt('document') },
    { id: 'sheet', label: t('New Spreadsheet'), icon: FileSpreadsheet, onClick: () => createAt('spreadsheet') },
    { id: 'deck', label: t('New Presentation'), icon: Presentation, onClick: () => createAt('presentation') },
    { id: 'note', label: t('New Note'), icon: Pencil, onClick: () => createAt('note') },
  ];

  const openNewMenu = (event: React.MouseEvent<HTMLButtonElement>) => {
    const rect = event.currentTarget.getBoundingClientRect();
    menu.open({ clientX: rect.left, clientY: rect.bottom + 6 }, newMenuEntries());
  };

  const backgroundMenu = (event: React.MouseEvent) => {
    event.preventDefault();
    if (location.type === 'trash') {
      menu.open(event, [
        {
          id: 'empty',
          label: t('Empty Trash'),
          icon: Trash2,
          danger: true,
          onClick: () => setConfirm({ kind: 'empty-trash' }),
        },
      ]);
      return;
    }
    menu.open(event, [
      ...newMenuEntries(),
      { id: 's1', separator: true },
      { id: 'paste', label: t('Paste'), icon: Clipboard, disabled: !canPaste, onClick: () => void paste() },
      { id: 's2', separator: true },
      { id: 'refresh', label: t('Refresh'), icon: RotateCcw, onClick: () => setQuery('') },
    ]);
  };

  const onKeyDown = (event: React.KeyboardEvent) => {
    const mod = event.ctrlKey || event.metaKey;
    if (event.key === 'Delete' && single && location.type !== 'trash' && !single.system) {
      event.preventDefault();
      doDelete();
    } else if (event.key === 'F2' && single && !single.system) {
      event.preventDefault();
      setPrompt({ kind: 'rename', node: single });
    } else if (event.key === 'Enter') {
      openSelected();
    } else if (mod && event.key.toLowerCase() === 'a') {
      event.preventDefault();
      setSelected(items.map((node) => node.id));
    } else if (mod && event.key.toLowerCase() === 'c' && single) {
      clipboard.set([single.id], 'copy', single.parentId);
    } else if (mod && event.key.toLowerCase() === 'v') {
      event.preventDefault();
      void paste();
    } else if (event.key === 'Escape') {
      setSelected([]);
    }
  };

  const crumbs = location.type === 'path' && nodes[location.id] ? breadcrumbs(nodes, location.id) : [];

  const title =
    location.type === 'trash'
      ? t('Trash')
      : location.type === 'recent'
        ? t('Recent')
        : location.type === 'favorites'
          ? t('Favorites')
          : location.type === 'apps'
            ? t('Applications')
            : currentFolder?.name ?? t('Files');

  useEffect(() => {
    useWindows.getState().setTitle(win.id, `${t('Files')} — ${title}`);
  }, [title, t, win.id]);

  const sidebarCounts = useMemo(
    () => ({
      trash: Object.values(nodes).filter((node) => node.trashed && !node.system).length,
      favorites: Object.values(nodes).filter((node) => node.starred && !node.trashed).length,
    }),
    [nodes],
  );

  return (
    <div className="app files" onKeyDown={onKeyDown} tabIndex={-1} ref={containerRef}>
      <div className="files__toolbar">
        <div className="app__toolbar-group">
          <button className="icon-btn" onClick={goBack} disabled={historyIndex <= 0} title={t('Back')}>
            <ArrowLeft size={16} />
          </button>
          <button className="icon-btn" onClick={goForward} disabled={historyIndex >= history.length - 1} title={t('Forward')}>
            <ArrowRight size={16} />
          </button>
          <button
            className="icon-btn"
            onClick={goUp}
            disabled={location.type !== 'path' || !currentFolder?.parentId}
            title={t('Up')}
          >
            <ArrowUp size={16} />
          </button>
        </div>

        <div className="files__crumb">
          {location.type === 'path' ? (
            crumbs.map((crumb, index) => (
              <span key={crumb.id} className="files__crumb-item">
                {index > 0 && <span className="faint">/</span>}
                <button
                  className={cn('files__crumb-btn', index === crumbs.length - 1 && 'is-current')}
                  onClick={() => navigate({ type: 'path', id: crumb.id })}
                  onDragOver={(event) => {
                    event.preventDefault();
                    setDragOver(crumb.id);
                  }}
                  onDragLeave={() => setDragOver(null)}
                  onDrop={(event) => {
                    event.preventDefault();
                    const id = event.dataTransfer.getData('text/nova-file');
                    if (id) useFiles.getState().moveNode(id, crumb.id);
                    setDragOver(null);
                  }}
                >
                  {crumb.id === FOLDER_IDS.root ? t('File System') : t(crumb.name)}
                </button>
              </span>
            ))
          ) : (
            <span className="files__crumb-btn is-current">{title}</span>
          )}
        </div>

        <div className="files__search">
          <Search size={14} />
          <input
            className="input"
            placeholder={t('Search files')}
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            aria-label={t('Search files')}
          />
          {query && (
            <button className="icon-btn" style={{ width: 22, height: 22 }} onClick={() => setQuery('')}>
              <X size={12} />
            </button>
          )}
        </div>

        <div className="app__toolbar-group">
          <button className="icon-btn" onClick={() => setViewMode('grid')} title={t('Grid view')} data-active={viewMode === 'grid'}>
            <Grid2x2 size={15} style={{ opacity: viewMode === 'grid' ? 1 : 0.5 }} />
          </button>
          <button className="icon-btn" onClick={() => setViewMode('list')} title={t('List view')}>
            <List size={15} style={{ opacity: viewMode === 'list' ? 1 : 0.5 }} />
          </button>
          <button
            className={cn('icon-btn', showInfo && 'is-active')}
            onClick={() => setShowInfo((value) => !value)}
            title={t('Details')}
          >
            <Info size={15} />
          </button>
        </div>

        {location.type !== 'trash' && (
          <div className="app__toolbar-group">
            <button className="btn btn--sm" onClick={openNewMenu} disabled={!targetFolderId} title={t('New')}>
              <Plus size={14} /> {t('New')}
            </button>
            <button className="icon-btn" onClick={() => void paste()} disabled={!canPaste} title={t('Paste')}>
              <Clipboard size={15} />
            </button>
            <button
              className="icon-btn icon-btn--danger"
              onClick={doDelete}
              disabled={!single || Boolean(single.system)}
              title={single?.trashed ? t('Delete permanently') : t('Move to Trash')}
            >
              <Trash2 size={15} />
            </button>
          </div>
        )}
      </div>

      <div className="files__body">
        <aside className="files__sidebar">
          <div className="files__side-group">
            {SIDEBAR.map((entry) => {
              const isActive =
                (entry.location.type === 'path' &&
                  location.type === 'path' &&
                  location.id === entry.location.id) ||
                (entry.location.type !== 'path' && location.type === entry.location.type);
              const Icon = entry.icon;
              return (
                <button
                  key={entry.key}
                  className={cn('files__side-item', isActive && 'is-active')}
                  onClick={() => navigate(entry.location)}
                  onDragOver={(event) => {
                    if (entry.location.type === 'path') {
                      event.preventDefault();
                      setDragOver(entry.location.id);
                    }
                  }}
                  onDragLeave={() => setDragOver(null)}
                  onDrop={(event) => {
                    if (entry.location.type !== 'path') return;
                    event.preventDefault();
                    const id = event.dataTransfer.getData('text/nova-file');
                    if (id) useFiles.getState().moveNode(id, entry.location.id);
                    setDragOver(null);
                  }}
                >
                  <Icon size={15} />
                  <span className="truncate">{t(entry.label)}</span>
                  {entry.key === 'trash' && sidebarCounts.trash > 0 && (
                    <span className="badge">{sidebarCounts.trash}</span>
                  )}
                  {entry.key === 'favorites' && sidebarCounts.favorites > 0 && (
                    <span className="badge">{sidebarCounts.favorites}</span>
                  )}
                </button>
              );
            })}
          </div>
          <div className="files__side-foot">
            <p className="tiny faint">{t('Storage: simulated virtual file system')}</p>
          </div>
        </aside>

        <div
          className="files__main"
          onContextMenu={location.type === 'apps' ? undefined : backgroundMenu}
          onClick={() => setSelected([])}
          onDragOver={(event) => {
            if (targetFolderId) {
              event.preventDefault();
              setDragOver('background');
            }
          }}
          onDragLeave={() => setDragOver(null)}
          onDrop={(event) => {
            if (!targetFolderId) return;
            const id = event.dataTransfer.getData('text/nova-file');
            if (id) {
              const ok = useFiles.getState().moveNode(id, targetFolderId);
              if (!ok) notifyError(t('Name already exists'));
            }
            setDragOver(null);
          }}
        >
          {location.type === 'trash' && items.length > 0 && (
            <div className="files__trash-bar">
              <span className="small muted">{items.length} {t('items')}</span>
              <div className="row" style={{ gap: 6 }}>
                <button
                  className="btn btn--sm"
                  onClick={() => {
                    const restored = trashedNodes(nodes).filter((node) => !node.system);
                    restored.forEach((node) => useFiles.getState().restoreNode(node.id));
                    notify(t('Restore all'), { body: `${restored.length} ${t('items')}`, kind: 'success' });
                    setSelected([]);
                  }}
                >
                  <RotateCcw size={13} /> {t('Restore all')}
                </button>
                <button className="btn btn--sm" onClick={() => setConfirm({ kind: 'empty-trash' })}>
                  <Trash2 size={13} /> {t('Empty Trash')}
                </button>
              </div>
            </div>
          )}

          {location.type === 'apps' ? (
            <div className="files__grid" style={{ ['--icon-size' as string]: `${iconSize}px` }}>
              {VISIBLE_APP_IDS.filter((id) => installed.includes(id)).map((appId) => (
                <button
                  key={appId}
                  className="files__item"
                  onDoubleClick={() => useWindows.getState().openApp(appId)}
                  onClick={(event) => {
                    event.stopPropagation();
                    setSelected([`app:${appId}`]);
                  }}
                >
                  <AppIcon appId={appId} size="lg" />
                  <span className="files__item-name">{t(APP_META[appId].name)}</span>
                  <span className="files__item-meta">{t(APP_META[appId].category)}</span>
                </button>
              ))}
            </div>
          ) : items.length === 0 ? (
            <EmptyState
              icon={query ? Search : FolderOpen}
              title={query ? t('No files found') : location.type === 'trash' ? t('Trash is empty') : t('This folder is empty')}
              description={query ? t('Try a different search term or category.') : t('Drop files here')}
              action={
                location.type !== 'trash' && targetFolderId ? (
                  <button className="btn btn--sm" onClick={() => createAt('folder')}>
                    <FolderPlus size={13} /> {t('New Folder')}
                  </button>
                ) : undefined
              }
            />
          ) : viewMode === 'grid' ? (
            <div className="files__grid" style={{ ['--icon-size' as string]: `${iconSize}px` }}>
              {items.map((node) => (
                <button
                  key={node.id}
                  className={cn(
                    'files__item',
                    selected.includes(node.id) && 'is-selected',
                    dragOver === node.id && 'is-drop-target',
                  )}
                  draggable={!node.system && !node.trashed}
                  onDragStart={(event) => {
                    event.dataTransfer.setData('text/nova-file', node.id);
                    event.dataTransfer.effectAllowed = 'move';
                  }}
                  onDragOver={(event) => {
                    if (node.kind === 'folder' && !node.trashed) {
                      event.preventDefault();
                      setDragOver(node.id);
                    }
                  }}
                  onDragLeave={() => setDragOver(null)}
                  onDrop={(event) => {
                    event.stopPropagation();
                    const id = event.dataTransfer.getData('text/nova-file');
                    if (id && node.kind === 'folder') {
                      const ok = useFiles.getState().moveNode(id, node.id);
                      if (!ok) notifyError(t('Name already exists'));
                    }
                    setDragOver(null);
                  }}
                  onClick={(event) => {
                    event.stopPropagation();
                    if (event.ctrlKey || event.metaKey) {
                      setSelected((current) =>
                        current.includes(node.id) ? current.filter((id) => id !== node.id) : [...current, node.id],
                      );
                    } else {
                      setSelected([node.id]);
                      if (node.trashed) setShowInfo(true);
                    }
                  }}
                  onDoubleClick={() => (node.kind === 'folder' ? navigate({ type: 'path', id: node.id }) : openNode(node))}
                  onContextMenu={(event) => itemMenu(event, node)}
                  title={node.name}
                >
                  <span className="files__glyph">
                    <NodeGlyph node={node} size={Math.round(iconSize * 0.5)} />
                  </span>
                  <span className="files__item-name">{node.name}</span>
                  {location.type !== 'trash' && (
                    <span className="files__item-meta">
                      {node.kind === 'folder'
                        ? `${childrenOf(nodes, node.id).length} ${t('items')}`
                        : formatBytes(fileSize(node))}
                    </span>
                  )}
                </button>
              ))}
            </div>
          ) : (
            <table className="files__table">
              <thead>
                <tr>
                  <th style={{ width: '48%' }}>
                    <button className="files__sort" onClick={() => setSort((s) => ({ key: 'name', dir: s.dir === 'asc' ? 'desc' : 'asc' }))}>
                      {t('Name')}
                    </button>
                  </th>
                  <th>
                    <button className="files__sort" onClick={() => setSort((s) => ({ key: 'size', dir: s.dir === 'asc' ? 'desc' : 'asc' }))}>
                      {t('Size')}
                    </button>
                  </th>
                  <th>
                    <button className="files__sort" onClick={() => setSort((s) => ({ key: 'kind', dir: s.dir === 'asc' ? 'desc' : 'asc' }))}>
                      {t('Type')}
                    </button>
                  </th>
                  <th>
                    <button className="files__sort" onClick={() => setSort((s) => ({ key: 'modifiedAt', dir: s.dir === 'asc' ? 'desc' : 'asc' }))}>
                      {t('Modified')}
                    </button>
                  </th>
                </tr>
              </thead>
              <tbody>
                {items.map((node) => (
                  <tr
                    key={node.id}
                    className={cn(selected.includes(node.id) && 'is-selected')}
                    onClick={(event) => {
                      event.stopPropagation();
                      if (event.ctrlKey || event.metaKey) {
                        setSelected((current) =>
                          current.includes(node.id) ? current.filter((id) => id !== node.id) : [...current, node.id],
                        );
                      } else setSelected([node.id]);
                    }}
                    onDoubleClick={() => (node.kind === 'folder' ? navigate({ type: 'path', id: node.id }) : openNode(node))}
                    onContextMenu={(event) => itemMenu(event, node)}
                  >
                    <td>
                      <span className="files__row-name">
                        <NodeGlyph node={node} size={16} />
                        <span className="truncate">{node.name}</span>
                      </span>
                    </td>
                    <td className="numeric faint">{node.kind === 'folder' ? '—' : formatBytes(fileSize(node))}</td>
                    <td className="faint">{node.kind === 'folder' ? t('Folder') : extensionOf(node.name).toUpperCase() || t('File')}</td>
                    <td className="faint">{formatDate(node.modifiedAt, language, { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>

        {showInfo && (
          <aside className="files__info">
            <div className="files__info-head">
              <strong className="small">{t('Details')}</strong>
              <button className="icon-btn" onClick={() => setShowInfo(false)}>
                <X size={14} />
              </button>
            </div>
            {single ? (
              <div className="files__info-body">
                <div className="files__info-glyph">
                  <NodeGlyph node={single} size={44} />
                </div>
                <div className="files__info-name">{single.name}</div>
                <dl className="files__info-list">
                  <dt>{t('Type')}</dt>
                  <dd>{single.kind}</dd>
                  <dt>{t('Size')}</dt>
                  <dd>{single.kind === 'folder' ? '—' : formatBytes(fileSize(single))}</dd>
                  <dt>{t('Location')}</dt>
                  <dd className="mono tiny">{pathOf(nodes, single.id).replace(/\/[^/]+$/, '') || '/'}</dd>
                  <dt>{t('Modified')}</dt>
                  <dd>{formatDate(single.modifiedAt, language, { dateStyle: 'medium', timeStyle: 'short' })}</dd>
                  <dt>{t('Created')}</dt>
                  <dd>{formatDate(single.createdAt, language, { dateStyle: 'medium' })}</dd>
                </dl>
                <div className="col" style={{ gap: 6 }}>
                  {single.trashed ? (
                    <button className="btn btn--sm" onClick={() => doRestore(single)}>
                      <RotateCcw size={13} /> {t('Restore')}
                    </button>
                  ) : (
                    <>
                      <button className="btn btn--sm" onClick={() => openNode(single)}>
                        <FolderOpen size={13} /> {t('Open')}
                      </button>
                      <button className="btn btn--sm" onClick={() => useFiles.getState().toggleStar(single.id)}>
                        <Star size={13} /> {single.starred ? t('Remove from Favorites') : t('Add to Favorites')}
                      </button>
                    </>
                  )}
                </div>
              </div>
            ) : (
              <div className="files__info-body">
                <p className="small muted">
                  {selectedNodes.length > 1
                    ? `${selectedNodes.length} ${t('items selected')}`
                    : t('Select a file to see its details')}
                </p>
                {selectedNodes.length > 1 && (
                  <p className="small faint">
                    {t('Total')}: {formatBytes(selectedNodes.reduce((acc, node) => acc + fileSize(node), 0))}
                  </p>
                )}
              </div>
            )}
            <div style={{ marginTop: 'auto', padding: 10 }}>
              <label className="field">
                <span className="field__label">{t('Icon size')}</span>
                <input
                  className="slider"
                  type="range"
                  min={56}
                  max={120}
                  value={iconSize}
                  onChange={(event) => setIconSize(Number(event.target.value))}
                />
              </label>
            </div>
          </aside>
        )}
      </div>

      <footer className="app__status">
        <span>
          {items.length} {t('items')}
          {selected.length > 0 && ` · ${selected.length} ${t('items selected')}`}
        </span>
        <span className="faint">{location.type === 'trash' ? t('Trash') : currentPath || t('Storage: simulated virtual file system')}</span>
      </footer>

      <Modal
        open={Boolean(preview)}
        onClose={() => setPreview(null)}
        title={preview?.name}
        wide
        footer={
          <>
            <button className="btn" onClick={() => setPreview(null)}>
              {t('Close')}
            </button>
            <button
              className="btn btn--primary"
              onClick={() => {
                if (preview) {
                  const mime = (preview.meta?.mime as string | undefined) ?? 'image/svg+xml';
                  downloadBlob(preview.name, new Blob([preview.content ?? ''], { type: mime }));
                }
              }}
            >
              <Download size={14} /> {t('Save a copy')}
            </button>
          </>
        }
      >
        {preview && (
          <div className="files__preview">
            <img src={imageDataUrl(preview)} alt={preview.name} />
            <p className="tiny faint">
              {preview.name} · {formatBytes(fileSize(preview))} · {t('Stored in the simulated file system')}
            </p>
          </div>
        )}
      </Modal>

      <PromptDialog
        open={prompt?.kind === 'folder'}
        title={t('New Folder')}
        label={t('New folder name')}
        initialValue="New Folder"
        onCancel={() => setPrompt(null)}
        onSubmit={(name) => {
          if (!targetFolderId) return;
          const created = useFiles.getState().createFolder(targetFolderId, name);
          if (created) notify(t('Folder created'), { body: created.name, kind: 'success' });
        }}
      />
      <PromptDialog
        open={prompt?.kind === 'file'}
        title={t('New Text File')}
        label={t('New file name')}
        initialValue="New Text File.txt"
        onCancel={() => setPrompt(null)}
        onSubmit={(name) => {
          if (!targetFolderId) return;
          const created = useFiles.getState().createFile(targetFolderId, name, { content: '' });
          if (created) openNode(created);
        }}
      />
      <PromptDialog
        open={prompt?.kind === 'rename'}
        title={t('Rename')}
        label={t('Name')}
        initialValue={prompt?.node?.name ?? ''}
        onCancel={() => setPrompt(null)}
        onSubmit={(name) => {
          if (!prompt?.node) return;
          const ok = useFiles.getState().renameNode(prompt.node.id, name);
          if (!ok) notifyError(t('Name already exists'));
        }}
      />
      <ConfirmDialog
        open={confirm?.kind === 'empty-trash'}
        title={t('Empty Trash')}
        message={`${t('Are you sure?')} ${t('This action cannot be undone.')}`}
        confirmLabel={t('Empty Trash')}
        danger
        onCancel={() => setConfirm(null)}
        onConfirm={() => {
          useFiles.getState().emptyTrash();
          setConfirm(null);
          notify(t('Trash is empty'), { kind: 'success' });
        }}
      />
      <ConfirmDialog
        open={confirm?.kind === 'delete'}
        title={t('Delete permanently')}
        message={`${confirm?.node?.name ?? ''} — ${t('This action cannot be undone.')}`}
        confirmLabel={t('Delete permanently')}
        danger
        onCancel={() => setConfirm(null)}
        onConfirm={() => {
          if (confirm?.node) useFiles.getState().deleteForever(confirm.node.id);
          setConfirm(null);
          notify(t('Permanently deleted'), { kind: 'info' });
        }}
      />
      {menu.node}
    </div>
  );
}

function NodeGlyph({ node, size = 26 }: { node: FSNode; size?: number }) {
  if (node.kind === 'folder') {
    return <Folder size={size} style={{ color: '#f0b849' }} strokeWidth={1.6} />;
  }
  const map: Record<string, { color: string; app: 'writer' | 'calc' | 'impress' | 'notes' | 'browser' }> = {
    document: { color: '#6d8dff', app: 'writer' },
    text: { color: '#8fa3b8', app: 'writer' },
    spreadsheet: { color: '#3fbf7f', app: 'calc' },
    presentation: { color: '#ff9250', app: 'impress' },
    note: { color: '#f5c542', app: 'notes' },
    image: { color: '#a586ff', app: 'browser' },
  };
  const entry = map[node.kind];
  if (entry) {
    return (
      <span
        className="files__file-badge"
        style={{ width: size, height: size, borderRadius: Math.max(4, size * 0.22), background: entry.color }}
      >
        <span style={{ fontSize: Math.max(8, size * 0.32) }}>
          {extensionOf(node.name).slice(0, 4).toUpperCase() || 'TXT'}
        </span>
      </span>
    );
  }
  return <FileText size={size} style={{ color: '#8fa3b8' }} strokeWidth={1.6} />;
}

/* ------------------------------------------------------------------ */
/* Image preview helpers                                               */
/* ------------------------------------------------------------------ */

function imageDataUrl(node: FSNode): string {
  const content = node.content ?? '';
  if (content.startsWith('data:')) return content;
  const mime = (node.meta?.mime as string | undefined) ?? (node.name.toLowerCase().endsWith('.svg') ? 'image/svg+xml' : 'image/png');
  return `data:${mime};utf8,${encodeURIComponent(content)}`;
}
