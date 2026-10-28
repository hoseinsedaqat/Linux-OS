import { useEffect, useMemo, useState } from 'react';
import {
  ChevronRight,
  Download,
  FileText,
  Folder,
  FolderOpen,
  Home,
  Image as ImageIcon,
  Music,
  Search,
  Table2,
  Trash2,
  Video,
} from 'lucide-react';
import type { FSNode, FSNodeKind } from '@/types';
import { useFiles } from '@/core/virtual-filesystem/fsStore';
import {
  FOLDER_IDS,
  HOME_ID,
  breadcrumbs,
  childrenOf,
  findByPath,
} from '@/core/virtual-filesystem/fsUtils';
import { Modal } from '@/components/common/Modal';
import { useT } from '@/core/localization/i18n';
import { cn, extensionOf, stripExtension } from '@/utils';

export type PickerMode = 'save' | 'open';

interface FilePickerProps {
  open: boolean;
  mode: PickerMode;
  title?: string;
  initialName?: string;
  initialFolderPath?: string;
  /** Force a file extension in save mode (without the dot). */
  extension?: string;
  /** Restrict the visible items in open mode. */
  kinds?: FSNodeKind[];
  confirmLabel?: string;
  onClose: () => void;
  onSave?: (args: { name: string; folderId: string; folderPath: string }) => void;
  onOpen?: (node: FSNode) => void;
}

const QUICK_PATH = [
  { key: 'home', path: '/home/demo', label: 'Home', icon: Home },
  { key: 'desktop', path: '/home/demo/Desktop', label: 'Desktop', icon: Folder },
  { key: 'documents', path: '/home/demo/Documents', label: 'Documents', icon: FileText },
  { key: 'downloads', path: '/home/demo/Downloads', label: 'Downloads', icon: Download },
  { key: 'pictures', path: '/home/demo/Pictures', label: 'Pictures', icon: ImageIcon },
  { key: 'music', path: '/home/demo/Music', label: 'Music', icon: Music },
  { key: 'videos', path: '/home/demo/Videos', label: 'Videos', icon: Video },
  { key: 'trash', path: '/home/demo/Notes', label: 'Notes', icon: Trash2 },
];

function nodeIcon(node: FSNode) {
  switch (node.kind) {
    case 'folder':
      return <Folder size={16} style={{ color: '#f0b849' }} />;
    case 'spreadsheet':
      return <Table2 size={16} style={{ color: '#3fbf7f' }} />;
    case 'image':
      return <ImageIcon size={16} style={{ color: '#a586ff' }} />;
    default:
      return <FileText size={16} style={{ color: 'var(--text-3)' }} />;
  }
}

export function FilePicker({
  open,
  mode,
  title,
  initialName = '',
  initialFolderPath = '/home/demo/Documents',
  extension,
  kinds,
  confirmLabel,
  onClose,
  onSave,
  onOpen,
}: FilePickerProps) {
  const t = useT();
  const nodes = useFiles((state) => state.nodes);
  const createFolder = useFiles((state) => state.createFolder);
  const initialFolder = useMemo(() => findByPath(nodes, initialFolderPath), [initialFolderPath, nodes]);

  const [folderId, setFolderId] = useState(initialFolder?.id ?? FOLDER_IDS.documents);
  const [name, setName] = useState(initialName);
  const [query, setQuery] = useState('');
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    const folder = findByPath(useFiles.getState().nodes, initialFolderPath);
    setFolderId(folder?.id ?? FOLDER_IDS.documents);
    setName(initialName);
    setQuery('');
    setError(null);
  }, [open, initialFolderPath, initialName]);

  const folder = nodes[folderId];
  const crumbs = breadcrumbs(nodes, folderId);
  const items = childrenOf(nodes, folderId).filter((node) => {
    if (node.trashed) return false;
    if (mode === 'open' && node.kind === 'folder') return true;
    if (mode === 'open' && kinds && kinds.length > 0) return kinds.includes(node.kind);
    return true;
  });
  const filtered = query
    ? items.filter((node) => node.name.toLowerCase().includes(query.toLowerCase()))
    : items;

  const submit = () => {
    if (mode === 'save') {
      const trimmed = name.trim();
      if (!trimmed) {
        setError(t('Name cannot be empty'));
        return;
      }
      const hasExt = extensionOf(trimmed) !== '';
      const finalName = extension && !hasExt ? `${trimmed}.${extension}` : trimmed;
      const duplicate = childrenOf(nodes, folderId).some(
        (node) => node.name.toLowerCase() === finalName.toLowerCase(),
      );
      if (duplicate) {
        setError(`${t('Name already exists')}: ${finalName}`);
        return;
      }
      onSave?.({ name: finalName, folderId, folderPath: crumbs.map((crumb) => crumb.name).join('/') });
      onClose();
      return;
    }
    if (mode === 'open') {
      const trimmed = name.trim();
      const match = filtered.find((node) => node.name.toLowerCase() === trimmed.toLowerCase());
      if (match && match.kind !== 'folder') {
        onOpen?.(match);
        onClose();
      }
    }
  };

  const quickFolders = QUICK_PATH.map((entry) => ({
    ...entry,
    node: findByPath(nodes, entry.path),
  }));

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={title ?? (mode === 'save' ? t('Choose where to save') : t('Open'))}
      icon={<FolderOpen size={16} style={{ color: 'var(--accent)' }} />}
      wide
      footer={
        <>
          <button className="btn" onClick={onClose}>
            {t('Cancel')}
          </button>
          <button className="btn btn--primary" onClick={submit} disabled={mode === 'save' && !name.trim()}>
            {confirmLabel ?? (mode === 'save' ? t('Save') : t('Open'))}
          </button>
        </>
      }
    >
      <div className="picker">
        <aside className="picker__side">
          {quickFolders.map((entry) => (
            <button
              key={entry.key}
              className={cn('picker__quick', entry.node?.id === folderId && 'is-active')}
              onClick={() => entry.node && setFolderId(entry.node.id)}
              disabled={!entry.node}
            >
              <entry.icon size={14} />
              <span>{t(entry.label)}</span>
            </button>
          ))}
        </aside>
        <div className="picker__main">
          <div className="picker__bar">
            <div className="picker__crumbs">
              {crumbs.map((crumb, index) => (
                <span key={crumb.id} className="picker__crumb-wrap">
                  {index > 0 && <ChevronRight size={12} className="faint" />}
                  <button className="picker__crumb" onClick={() => setFolderId(crumb.id)}>
                    {crumb.id === FOLDER_IDS.root ? t('File System') : t(crumb.name)}
                  </button>
                </span>
              ))}
            </div>
            <div className="picker__search">
              <Search size={13} />
              <input
                className="input"
                style={{ height: 28, paddingInlineStart: 28 }}
                placeholder={t('Search')}
                value={query}
                onChange={(event) => setQuery(event.target.value)}
              />
            </div>
          </div>

          <div className="picker__list">
            {folder?.parentId && (
              <button className="picker__row" onClick={() => setFolderId(folder.parentId as string)}>
                <Folder size={16} style={{ color: 'var(--text-3)' }} />
                <span className="muted">..</span>
              </button>
            )}
            {filtered.length === 0 && (
              <div className="empty-state" style={{ padding: 20 }}>
                <div className="empty-state__title">{t('This folder is empty')}</div>
              </div>
            )}
            {filtered.map((node) => (
              <button
                key={node.id}
                className={cn('picker__row', name === node.name && 'is-selected')}
                onClick={() => {
                  if (node.kind === 'folder') {
                    setFolderId(node.id);
                    setName('');
                  } else {
                    setName(node.name);
                    setError(null);
                  }
                }}
                onDoubleClick={() => {
                  if (node.kind === 'folder') setFolderId(node.id);
                  else if (mode === 'open') {
                    onOpen?.(node);
                    onClose();
                  }
                }}
              >
                {nodeIcon(node)}
                <span className="truncate">{node.name}</span>
                {node.kind !== 'folder' && (
                  <span className="picker__row-meta">{extensionOf(node.name).toUpperCase()}</span>
                )}
              </button>
            ))}
          </div>

          {mode === 'save' && (
            <div className="picker__footer">
              <button
                className="btn btn--sm"
                onClick={() => {
                  const created = createFolder(folderId, 'New Folder');
                  if (created) setFolderId(created.id);
                }}
              >
                <Folder size={13} /> {t('New Folder')}
              </button>
              <div className="grow">
                <input
                  className={cn('input', error && 'input--error')}
                  style={{ height: 32 }}
                  value={name}
                  autoFocus
                  placeholder={mode === 'save' ? t('File name') : t('Search')}
                  onChange={(event) => {
                    setName(event.target.value);
                    setError(null);
                  }}
                  onKeyDown={(event) => {
                    if (event.key === 'Enter') submit();
                  }}
                />
              </div>
              {extension && <span className="badge">.{extension}</span>}
            </div>
          )}
          {error && <div className="field__error" style={{ padding: '0 4px 6px' }}>{error}</div>}
          {mode === 'save' && name && (
            <div className="faint tiny" style={{ padding: '0 6px 4px' }}>
              {crumbs.map((crumb) => (crumb.id === FOLDER_IDS.root ? '' : `/${crumb.name}`)).join('') || '/'}
              {extension && extensionOf(name) === '' ? `.${extension}` : ''}
            </div>
          )}
        </div>
      </div>
    </Modal>
  );
}

export { HOME_ID, stripExtension };
