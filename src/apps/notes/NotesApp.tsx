import { useEffect, useMemo, useRef, useState } from 'react';
import {
  Download,
  FolderOpen,
  Pin,
  PinOff,
  Plus,
  Search,
  StickyNote,
  Trash2,
} from 'lucide-react';
import type { FSNode } from '@/types';
import type { AppWindowProps } from '@/core/apps/types';
import { useFiles } from '@/core/virtual-filesystem/fsStore';
import { FOLDER_IDS } from '@/core/virtual-filesystem/fsUtils';
import { useWindows } from '@/core/window-manager/windowsStore';
import { useT } from '@/core/localization/i18n';
import { FilePicker } from '@/components/common/FilePicker';
import { ConfirmDialog } from '@/components/common/Modal';
import { EmptyState } from '@/components/common/Controls';
import { notify, notifySuccess } from '@/core/notifications/notificationsStore';
import { downloadText, formatDate, stripExtension, cn } from '@/utils';
import { useSettings } from '@/core/themes/settingsStore';

const COLORS = [
  { id: 'mint', value: '#3ddc97' },
  { id: 'sky', value: '#5aa9ff' },
  { id: 'amber', value: '#f5c542' },
  { id: 'violet', value: '#a586ff' },
  { id: 'rose', value: '#ff7a90' },
  { id: 'slate', value: '#8fa3b8' },
];

export function NotesApp({ win }: AppWindowProps) {
  const t = useT();
  const language = useSettings((state) => state.language);
  const nodes = useFiles((state) => state.nodes);
  const createFile = useFiles((state) => state.createFile);
  const updateContent = useFiles((state) => state.updateContent);
  const trashNode = useFiles((state) => state.trashNode);
  const setTitle = useWindows((state) => state.setTitle);

  const notes = useMemo(
    () =>
      Object.values(nodes)
        .filter((node) => (node.kind === 'note' || node.kind === 'text') && !node.trashed)
        .sort((a, b) => {
          const pinA = a.meta?.pinned ? 1 : 0;
          const pinB = b.meta?.pinned ? 1 : 0;
          if (pinA !== pinB) return pinB - pinA;
          return b.modifiedAt - a.modifiedAt;
        }),
    [nodes],
  );

  const [selectedId, setSelectedId] = useState<string | null>(() => {
    const path = win.payload?.path;
    const initial = path ? Object.values(useFiles.getState().nodes).find((node) => node.id === path) : notes[0];
    return initial?.id ?? null;
  });
  const [query, setQuery] = useState('');
  const [title, setTitleValue] = useState('');
  const [body, setBody] = useState('');
  const [saveState, setSaveState] = useState<'saved' | 'saving'>('saved');
  const [openPicker, setOpenPicker] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const timer = useRef<number | undefined>(undefined);
  const pending = useRef<{ id: string; content: string; meta: Record<string, unknown> } | null>(null);

  const selected = selectedId ? nodes[selectedId] : undefined;

  useEffect(() => {
    const path = win.payload?.path;
    if (!path) return;
    const node = Object.values(useFiles.getState().nodes).find((item) => item.id === path);
    if (node) setSelectedId(node.id);
  }, [win.payload?.path]);

  useEffect(() => {
    if (!selected) {
      setTitleValue('');
      setBody('');
      return;
    }
    setTitleValue(stripExtension(selected.name));
    setBody(selected.content ?? '');
    setSaveState('saved');
  }, [selected?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    setTitle(win.id, `${t('Notes')}${selected ? ` — ${stripExtension(selected.name)}` : ''}`);
  }, [selected, setTitle, t, win.id]);

  const flush = () => {
    if (!pending.current) return;
    const { id, content, meta } = pending.current;
    updateContent(id, content, meta);
    pending.current = null;
    setSaveState('saved');
  };

  const scheduleSave = (nextBody: string, nextTitle: string) => {
    if (!selected) return;
    setSaveState('saving');
    const finalName = selected.kind === 'note' && nextTitle.trim() ? `${nextTitle.trim()}.novanote` : selected.name;
    if (finalName !== selected.name) {
      useFiles.getState().renameNode(selected.id, nextTitle.trim() || selected.name);
    }
    pending.current = {
      id: selected.id,
      content: nextBody,
      meta: { ...selected.meta, updatedAt: Date.now() },
    };
    if (timer.current) window.clearTimeout(timer.current);
    timer.current = window.setTimeout(flush, 500);
  };

  useEffect(() => {
    const onUnload = () => flush();
    window.addEventListener('beforeunload', onUnload);
    return () => {
      window.removeEventListener('beforeunload', onUnload);
      if (timer.current) window.clearTimeout(timer.current);
      flush();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const createNote = () => {
    const folder = nodes[FOLDER_IDS.notes] ?? nodes[FOLDER_IDS.documents];
    if (!folder) return;
    const note = createFile(folder.id, 'Untitled Note.novanote', {
      content: '',
      kind: 'note',
      meta: { color: 'mint' },
    });
    if (!note) return;
    setSelectedId(note.id);
    setTitleValue('Untitled Note');
    setBody('');
    setSaveState('saved');
  };

  const openFile = (node: FSNode) => {
    setSelectedId(node.id);
  };

  const togglePin = () => {
    if (!selected) return;
    updateContent(selected.id, body, { ...selected.meta, pinned: !selected.meta?.pinned });
    setSaveState('saved');
  };

  const setColor = (color: string) => {
    if (!selected) return;
    updateContent(selected.id, body, { ...selected.meta, color });
    setSaveState('saved');
  };

  const filtered = query.trim()
    ? notes.filter(
        (note) =>
          note.name.toLowerCase().includes(query.toLowerCase()) ||
          note.content.toLowerCase().includes(query.toLowerCase()),
      )
    : notes;

  const colorOf = (node: FSNode) => {
    const id = (node.meta?.color as string) ?? 'mint';
    return COLORS.find((color) => color.id === id)?.value ?? COLORS[0].value;
  };

  return (
    <div className="app notes">
      <aside className="notes__sidebar">
        <div className="notes__sidebar-top">
          <button className="btn btn--primary btn--sm grow" onClick={createNote}>
            <Plus size={14} /> {t('New note')}
          </button>
          <button className="icon-btn" title={t('Open')} onClick={() => setOpenPicker(true)}>
            <FolderOpen size={16} />
          </button>
        </div>
        <div className="notes__search">
          <Search size={13} />
          <input
            className="input input--sm"
            placeholder={t('Search notes')}
            value={query}
            onChange={(event) => setQuery(event.target.value)}
          />
        </div>
        <div className="notes__list">
          {filtered.length === 0 ? (
            <EmptyState icon={StickyNote} title={query ? t('No notes yet') : t('No notes yet')} description={t('Create your first note')} compact />
          ) : (
            filtered.map((note) => (
              <button
                key={note.id}
                className={cn('notes__item', selectedId === note.id && 'is-active')}
                onClick={() => {
                  flush();
                  openFile(note);
                }}
              >
                <span className="notes__item-bar" style={{ background: colorOf(note) }} />
                <span className="notes__item-text">
                  <span className="notes__item-title">
                    {note.meta?.pinned ? <Pin size={10} /> : null}
                    {stripExtension(note.name)}
                  </span>
                  <span className="notes__item-preview">{note.content.slice(0, 68) || t('Empty')}</span>
                  <span className="notes__item-date">
                    {formatDate(note.modifiedAt, language, { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
                  </span>
                </span>
              </button>
            ))
          )}
        </div>
      </aside>

      <main className="notes__main">
        {selected ? (
          <>
            <div className="notes__toolbar">
              <input
                className="notes__title-input"
                value={title}
                placeholder={t('Note title')}
                aria-label={t('Note title')}
                onChange={(event) => {
                  setTitleValue(event.target.value);
                  scheduleSave(body, event.target.value);
                }}
              />
              <div className="row" style={{ gap: 2 }}>
                {selected.kind === 'note' &&
                  COLORS.map((color) => (
                    <button
                      key={color.id}
                      className={cn(
                        'notes__color',
                        ((selected.meta?.color as string) ?? 'mint') === color.id && 'is-active',
                      )}
                      style={{ background: color.value }}
                      onClick={() => setColor(color.id)}
                      title={t('Note color')}
                    />
                  ))}
                <span className="app__toolbar-sep" />
                <button className="icon-btn" onClick={togglePin} title={selected.meta?.pinned ? t('Unpin note') : t('Pin note')}>
                  {selected.meta?.pinned ? <PinOff size={15} /> : <Pin size={15} />}
                </button>
                <button
                  className="icon-btn"
                  title={t('Export as TXT file')}
                  onClick={() => {
                    downloadText(`${stripExtension(selected.name) || 'note'}.txt`, body);
                    notifySuccess(t('Export'), 'TXT');
                  }}
                >
                  <Download size={15} />
                </button>
                <button className="icon-btn" title={t('Delete note')} onClick={() => setConfirmDelete(true)}>
                  <Trash2 size={15} />
                </button>
              </div>
            </div>
            <textarea
              className="notes__body"
              value={body}
              placeholder={t('Start writing…')}
              dir={language === 'fa' ? 'rtl' : 'ltr'}
              onChange={(event) => {
                setBody(event.target.value);
                scheduleSave(event.target.value, title);
              }}
            />
            <footer className="app__status">
              <span className="row" style={{ gap: 6 }}>
                {saveState === 'saving' ? (
                  <span className="badge badge--warning">{t('Saving…')}</span>
                ) : (
                  <span className="badge badge--accent">{t('All changes saved')}</span>
                )}
              </span>
              <span className="faint">
                {body.length} {t('characters')} · {selected.name}
              </span>
            </footer>
          </>
        ) : (
          <EmptyState
            icon={StickyNote}
            title={t('No notes yet')}
            description={t('Create your first note')}
            action={
              <button className="btn btn--primary btn--sm" onClick={createNote}>
                <Plus size={14} /> {t('New note')}
              </button>
            }
          />
        )}
      </main>

      <FilePicker
        open={openPicker}
        mode="open"
        kinds={['note', 'text']}
        onClose={() => setOpenPicker(false)}
        onOpen={(node) => {
          flush();
          openFile(node);
        }}
      />
      <ConfirmDialog
        open={confirmDelete}
        title={t('Delete note')}
        message={t('Are you sure you want to delete this note?')}
        danger
        onCancel={() => setConfirmDelete(false)}
        onConfirm={() => {
          if (selected) {
            trashNode(selected.id);
            notify(t('Deleted'), { body: selected.name, kind: 'info' });
          }
          setConfirmDelete(false);
          setSelectedId(null);
        }}
      />
    </div>
  );
}
