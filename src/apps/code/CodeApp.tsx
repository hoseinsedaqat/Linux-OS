import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ChevronRight,
  FilePlus2,
  Files,
  FolderClosed,
  FolderOpen,
  PanelLeftClose,
  PanelLeftOpen,
  Save,
  Search,
  Trash2,
  X,
} from 'lucide-react';
import type { AppWindowProps } from '@/core/apps/types';
import { useT } from '@/core/localization/i18n';
import { useFiles } from '@/core/virtual-filesystem/fsStore';
import { FOLDER_IDS, childrenOf, findByPath } from '@/core/virtual-filesystem/fsUtils';
import { notifyError, notifySuccess } from '@/core/notifications/notificationsStore';
import type { FSNode } from '@/types';
import { cn } from '@/utils';
import {
  LANGUAGE_LABEL,
  STARTER_FILES,
  caretPosition,
  detectLanguage,
  findInFile,
  indentSelection,
  lineCount,
  tokenize,
} from './codeUtils';

const EDITABLE_KINDS = new Set(['text']);

function formatBytes(value: number): string {
  return value < 1024 ? `${value} B` : `${(value / 1024).toFixed(1)} kB`;
}

export function CodeApp({ win }: AppWindowProps) {
  const t = useT();
  const nodes = useFiles((state) => state.nodes);
  const updateContent = useFiles((state) => state.updateContent);
  const createFile = useFiles((state) => state.createFile);
  const trashNode = useFiles((state) => state.trashNode);

  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [tabs, setTabs] = useState<string[]>([]);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [drafts, setDrafts] = useState<Record<string, string>>({});
  const [dirty, setDirty] = useState<Record<string, boolean>>({});
  const [filter, setFilter] = useState('');
  const [findOpen, setFindOpen] = useState(false);
  const [findTerm, setFindTerm] = useState('');
  const [caret, setCaret] = useState({ line: 1, column: 1 });
  const [newFileName, setNewFileName] = useState<string | null>(null);

  const areaRef = useRef<HTMLTextAreaElement | null>(null);
  const preRef = useRef<HTMLPreElement | null>(null);
  const gutterRef = useRef<HTMLDivElement | null>(null);

  const projectFolder = findByPath(nodes, '~/Projects') ?? nodes[FOLDER_IDS.projects];
  const projectFiles = useMemo(
    () =>
      projectFolder
        ? childrenOf(nodes, projectFolder.id)
            .filter((node) => node.kind !== 'folder')
            .sort((a, b) => a.name.localeCompare(b.name))
        : [],
    [nodes, projectFolder],
  );

  const visibleFiles = useMemo(() => {
    const needle = filter.trim().toLowerCase();
    return needle ? projectFiles.filter((node) => node.name.toLowerCase().includes(needle)) : projectFiles;
  }, [projectFiles, filter]);

  const activeNode = activeId ? nodes[activeId] : null;
  const value = activeId ? drafts[activeId] ?? activeNode?.content ?? '' : '';
  const language = activeNode ? detectLanguage(activeNode.name) : 'text';

  /* ---------- opening & closing ---------- */

  const openFile = useCallback(
    (node: FSNode) => {
      if (!EDITABLE_KINDS.has(node.kind) && node.kind !== 'binary') {
        notifyError(t('This file cannot be edited here'), node.name, 'code');
        return;
      }
      setTabs((current) => (current.includes(node.id) ? current : [...current, node.id]));
      setActiveId(node.id);
      setDrafts((current) => (node.id in current ? current : { ...current, [node.id]: node.content ?? '' }));
    },
    [t],
  );

  /* Deep link: Files can open a file with both a path and the editor. */
  useEffect(() => {
    const path = win.payload?.path ?? win.payload?.folderPath;
    if (!path) return;
    const node = findByPath(nodes, String(path));
    if (node && node.kind !== 'folder') openFile(node);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [win.payload?.path, win.payload?.folderPath]);

  /* First run: seed the project folder with readable starter files. */
  useEffect(() => {
    if (!projectFolder) return;
    if (projectFiles.length > 0) return;
    Object.entries(STARTER_FILES).forEach(([name, content]) => {
      createFile(projectFolder.id, name, { content });
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [projectFolder?.id, projectFiles.length]);

  const closeTab = (id: string) => {
    setTabs((current) => current.filter((tab) => tab !== id));
    if (activeId === id) {
      const remaining = tabs.filter((tab) => tab !== id);
      setActiveId(remaining.length > 0 ? remaining[remaining.length - 1] : null);
    }
  };

  /* ---------- editing ---------- */

  const save = useCallback(() => {
    if (!activeId) return;
    const next = drafts[activeId];
    if (next === undefined) return;
    updateContent(activeId, next);
    setDirty((current) => ({ ...current, [activeId]: false }));
    notifySuccess(t('Saved'), activeNode?.name, 'code');
  }, [activeId, drafts, updateContent, t, activeNode?.name]);

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement | null;
      if (!target?.closest('.code')) return;
      const mod = event.ctrlKey || event.metaKey;
      if (mod && event.key.toLowerCase() === 's') {
        event.preventDefault();
        save();
      }
      if (mod && event.key.toLowerCase() === 'f') {
        event.preventDefault();
        setFindOpen(true);
      }
      if (event.key === 'Escape') setFindOpen(false);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [save]);

  const onChange = (next: string) => {
    if (!activeId) return;
    setDrafts((current) => ({ ...current, [activeId]: next }));
    setDirty((current) => (current[activeId] ? current : { ...current, [activeId]: true }));
  };

  const syncScroll = () => {
    const area = areaRef.current;
    if (!area) return;
    if (preRef.current) {
      preRef.current.scrollTop = area.scrollTop;
      preRef.current.scrollLeft = area.scrollLeft;
    }
    if (gutterRef.current) gutterRef.current.scrollTop = area.scrollTop;
  };

  const updateCaret = () => {
    const area = areaRef.current;
    if (!area) return;
    setCaret(caretPosition(area.value, area.selectionStart));
  };

  const tokens = useMemo(() => tokenize(value, language), [value, language]);
  const lines = lineCount(value);
  const hits = useMemo(() => (findOpen ? findInFile(value, findTerm) : []), [findOpen, value, findTerm]);

  const jumpTo = (line: number, column: number) => {
    const area = areaRef.current;
    if (!area) return;
    const source = area.value;
    const offset = source
      .split('\n')
      .slice(0, line - 1)
      .reduce((total, row) => total + row.length + 1, 0) + column - 1;
    area.focus();
    area.setSelectionRange(offset, offset + Math.max(1, findTerm.length));
    updateCaret();
  };

  const createNewFile = () => {
    const name = newFileName?.trim();
    if (!name || !projectFolder) return;
    const created = createFile(projectFolder.id, name, { content: '', kind: 'text' });
    setNewFileName(null);
    if (created) openFile(created);
  };

  return (
    <div className={cn('app code', !sidebarOpen && 'is-sidebar-hidden')}>
      {/* activity bar */}
      <div className="code__activity" role="toolbar" aria-label={t('Editor')}>
        <button
          className={cn('code__activity-btn', sidebarOpen && 'is-active')}
          onClick={() => setSidebarOpen((current) => !current)}
          title={sidebarOpen ? t('Hide explorer') : t('Show explorer')}
          aria-pressed={sidebarOpen}
        >
          <Files size={17} />
        </button>
        <button
          className="code__activity-btn"
          onClick={() => setFindOpen((current) => !current)}
          title={t('Find in file')}
        >
          <Search size={17} />
        </button>
        <span className="code__activity-spacer" />
        <button
          className="code__activity-btn"
          onClick={() => setSidebarOpen((current) => !current)}
          title={sidebarOpen ? t('Collapse sidebar') : t('Expand sidebar')}
        >
          {sidebarOpen ? <PanelLeftClose size={16} /> : <PanelLeftOpen size={16} />}
        </button>
      </div>

      {/* explorer */}
      <aside className="code__sidebar" aria-label={t('Explorer')}>
        <div className="code__sidebar-head">
          <span>{t('Explorer')}</span>
          <button
            className="code__mini-btn"
            title={t('New file')}
            onClick={() => setNewFileName((current) => (current === null ? '' : null))}
          >
            <FilePlus2 size={13} />
          </button>
        </div>

        <div className="code__folder">
          <ChevronRight size={12} className="code__chevron" />
          <FolderOpen size={13} />
          <span className="truncate">Projects</span>
          <span className="code__folder-count">{projectFiles.length}</span>
        </div>

        <label className="code__filter">
          <Search size={11} />
          <input
            value={filter}
            onChange={(event) => setFilter(event.target.value)}
            placeholder={t('Filter files…')}
            aria-label={t('Filter files')}
          />
        </label>

        {newFileName !== null && (
          <form
            className="code__new-file"
            onSubmit={(event) => {
              event.preventDefault();
              createNewFile();
            }}
          >
            <input
              autoFocus
              value={newFileName}
              onChange={(event) => setNewFileName(event.target.value)}
              placeholder="main.ts"
              aria-label={t('File name')}
              onBlur={() => setNewFileName(null)}
            />
          </form>
        )}

        <div className="code__file-list" role="tree">
          {visibleFiles.length === 0 && <div className="code__empty">{t('No files yet')}</div>}
          {visibleFiles.map((node) => (
            <div
              key={node.id}
              className={cn('code__file', node.id === activeId && 'is-active')}
              role="treeitem"
              aria-selected={node.id === activeId}
              tabIndex={0}
              onClick={() => openFile(node)}
              onKeyDown={(event) => {
                if (event.key === 'Enter' || event.key === ' ') {
                  event.preventDefault();
                  openFile(node);
                }
              }}
            >
              <span className={cn('code__dot', `is-${detectLanguage(node.name)}`)} />
              <span className="truncate">{node.name}</span>
              {dirty[node.id] && <span className="code__dirty-dot" title={t('Unsaved changes')} />}
              <button
                className="code__file-delete"
                title={t('Move to Trash')}
                onClick={(event) => {
                  event.stopPropagation();
                  trashNode(node.id);
                  closeTab(node.id);
                }}
              >
                <Trash2 size={11} />
              </button>
            </div>
          ))}
        </div>

        <div className="code__sidebar-foot">
          <FolderClosed size={11} /> ~/Projects
        </div>
      </aside>

      {/* editor */}
      <section className="code__main">
        <div className="code__tabs" role="tablist">
          {tabs.length === 0 && <span className="code__tabs-empty">{t('Open a file from the explorer')}</span>}
          {tabs.map((id) => {
            const node = nodes[id];
            if (!node) return null;
            return (
              <div
                key={id}
                className={cn('code__tab', id === activeId && 'is-active')}
                role="tab"
                aria-selected={id === activeId}
              >
                <button className="code__tab-label" onClick={() => setActiveId(id)}>
                  <span className={cn('code__dot', `is-${detectLanguage(node.name)}`)} />
                  {node.name}
                  {dirty[id] && <span className="code__dirty-dot" />}
                </button>
                <button className="code__tab-close" onClick={() => closeTab(id)} aria-label={t('Close tab')}>
                  <X size={11} />
                </button>
              </div>
            );
          })}
          <div className="code__tabs-actions">
            <button className="code__mini-btn" onClick={save} disabled={!activeId || !dirty[activeId ?? '']} title={t('Save (Ctrl+S)')}>
              <Save size={13} />
            </button>
          </div>
        </div>

        {findOpen && (
          <div className="code__find">
            <Search size={12} />
            <input
              autoFocus
              value={findTerm}
              onChange={(event) => setFindTerm(event.target.value)}
              placeholder={t('Find in file…')}
              aria-label={t('Find in file')}
            />
            <span className="code__find-count">
              {findTerm.trim() ? t('{count} matches', { count: hits.length }) : ''}
            </span>
            <button className="code__mini-btn" onClick={() => setFindOpen(false)} aria-label={t('Close find')}>
              <X size={12} />
            </button>
            {hits.length > 0 && (
              <div className="code__find-results">
                {hits.slice(0, 40).map((hit) => (
                  <button key={`${hit.line}-${hit.column}`} onClick={() => jumpTo(hit.line, hit.column)}>
                    <span className="code__find-line">
                      {hit.line}:{hit.column}
                    </span>
                    <span className="truncate">{hit.preview}</span>
                  </button>
                ))}
              </div>
            )}
          </div>
        )}

        {activeNode ? (
          <div className="code__editor">
            <div className="code__gutter" ref={gutterRef} aria-hidden>
              {Array.from({ length: lines }, (_, index) => (
                <span key={index} className={index + 1 === caret.line ? 'is-current' : undefined}>
                  {index + 1}
                </span>
              ))}
            </div>
            <div className="code__surface">
              <pre className="code__highlight" ref={preRef} aria-hidden>
                {tokens.map((token, index) => (
                  <span key={index} className={`tok-${token.type}`}>
                    {token.text}
                  </span>
                ))}
                {'\n'}
              </pre>
              <textarea
                ref={areaRef}
                className="code__input"
                value={value}
                spellCheck={false}
                autoCapitalize="off"
                autoCorrect="off"
                wrap="off"
                aria-label={t('Editing {name}', { name: activeNode.name })}
                onChange={(event) => onChange(event.target.value)}
                onScroll={syncScroll}
                onKeyUp={updateCaret}
                onClick={updateCaret}
                onKeyDown={(event) => {
                  if (event.key === 'Tab') {
                    event.preventDefault();
                    const area = event.currentTarget;
                    const { value: next, start, end } = indentSelection(
                      area.value,
                      area.selectionStart,
                      area.selectionEnd,
                      event.shiftKey,
                    );
                    onChange(next);
                    window.requestAnimationFrame(() => {
                      area.setSelectionRange(start, end);
                      updateCaret();
                    });
                  }
                }}
              />
            </div>
          </div>
        ) : (
          <div className="code__welcome">
            <span className="code__welcome-mark">N</span>
            <strong>NOVA Code</strong>
            <p>
              {t('A focused editor for the files in ~/Projects. Everything you type is saved to the virtual file system, never to a server.')}
            </p>
            <ul>
              <li>
                <span className="kbd">Ctrl</span> + <span className="kbd">S</span> {t('saves the current file')}
              </li>
              <li>
                <span className="kbd">Ctrl</span> + <span className="kbd">F</span> {t('searches inside the file')}
              </li>
              <li>
                <span className="kbd">Tab</span> / <span className="kbd">Shift</span> + <span className="kbd">Tab</span>{' '}
                {t('indents and outdents the selection')}
              </li>
            </ul>
            <button
              className="btn btn--primary btn--sm"
              onClick={() => {
                const first = projectFiles[0];
                if (first) openFile(first);
                else setNewFileName('');
              }}
            >
              <FilePlus2 size={13} /> {projectFiles.length > 0 ? t('Open a file') : t('Create a file')}
            </button>
          </div>
        )}

        <footer className="code__status">
          <span>~/Projects{activeNode ? `/${activeNode.name}` : ''}</span>
          <span className="code__status-spacer" />
          <span>{t('Ln {line}, Col {col}', { line: caret.line, col: caret.column })}</span>
          <span>{t('{n} lines', { n: lines })}</span>
          <span>{formatBytes(new Blob([value]).size)}</span>
          <span>{LANGUAGE_LABEL[language]}</span>
          <span className={cn('code__status-state', dirty[activeId ?? ''] && 'is-dirty')}>
            {dirty[activeId ?? ''] ? t('Unsaved') : t('Saved')}
          </span>
        </footer>
      </section>
    </div>
  );
}
