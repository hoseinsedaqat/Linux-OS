import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  AlignCenter,
  AlignLeft,
  AlignRight,
  ArrowDownToLine,
  ArrowLeftRight,
  ArrowUpFromLine,
  Bold,
  ChevronLeft,
  ChevronRight,
  Download,
  Eraser,
  FolderOpen,
  Italic,
  Plus,
  Save,
  Trash2,
  Upload,
} from 'lucide-react';
import type { Sheet, Workbook, SheetCell } from '@/types/documents';
import type { FSNode } from '@/types';
import type { AppWindowProps } from '@/core/apps/types';
import { useFiles } from '@/core/virtual-filesystem/fsStore';
import { useWindows } from '@/core/window-manager/windowsStore';
import { FilePicker } from '@/components/common/FilePicker';
import { PromptDialog } from '@/components/common/PromptDialog';
import { ConfirmDialog } from '@/components/common/Modal';
import { useT } from '@/core/localization/i18n';
import { notify, notifyError, notifySuccess } from '@/core/notifications/notificationsStore';
import { downloadText } from '@/utils';
import { cn, stripExtension } from '@/utils';
import {
  COLS,
  ROWS,
  columnName,
  emptySheet,
  emptyWorkbook,
  evaluateCell,
  parseCsv,
  shiftCells,
  toCsv,
} from './calcEngine';

const ALPHABET = Array.from({ length: COLS }, (_, index) => columnName(index));
const ROW_INDEXES = Array.from({ length: ROWS }, (_, index) => index + 1);

export function CalcApp({ win }: AppWindowProps) {
  const t = useT();
  const createFile = useFiles((state) => state.createFile);
  const updateContent = useFiles((state) => state.updateContent);
  const setTitle = useWindows((state) => state.setTitle);

  const [workbook, setWorkbook] = useState<Workbook>(() => emptyWorkbook());
  const [fileNode, setFileNode] = useState<FSNode | null>(null);
  const [dirty, setDirty] = useState(false);
  const [active, setActive] = useState('A1');
  const [editing, setEditing] = useState<string | null>(null);
  const [draft, setDraft] = useState('');
  const [pickerOpen, setPickerOpen] = useState(false);
  const [openPicker, setOpenPicker] = useState(false);
  const [prompt, setPrompt] = useState<null | 'sheet' | 'rename'>(null);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const importRef = useRef<HTMLInputElement | null>(null);
  const gridRef = useRef<HTMLDivElement | null>(null);
  const resizeRef = useRef<null | { col: string; startX: number; startWidth: number }>(null);
  const cellClipboard = useRef<{ ref: string; value: string } | null>(null);

  const activeSheet = useMemo(
    () => workbook.sheets.find((sheet) => sheet.id === workbook.activeSheet) ?? workbook.sheets[0]!,
    [workbook],
  );

  const loadWorkbook = useCallback(
    (next: Workbook, node: FSNode | null) => {
      setWorkbook(next);
      setFileNode(node);
      setDirty(false);
      setActive('A1');
      setEditing(null);
    },
    [],
  );

  useEffect(() => {
    const path = win.payload?.path;
    if (!path) {
      if (win.payload?.untitled) loadWorkbook(emptyWorkbook(), null);
      return;
    }
    const node = Object.values(useFiles.getState().nodes).find((item) => item.id === path);
    if (!node) return;
    try {
      const parsed = JSON.parse(node.content) as Workbook;
      if (parsed && Array.isArray(parsed.sheets) && parsed.sheets.length > 0) {
        loadWorkbook({ ...parsed, activeSheet: parsed.activeSheet ?? parsed.sheets[0].id }, node);
        return;
      }
    } catch {
      /* fall through to CSV parsing */
    }
    // Non-workbook files open as CSV.
    const rows = parseCsv(node.content);
    const sheet = emptySheet(stripExtension(node.name) || 'Sheet 1');
    rows.forEach((row, rowIndex) => {
      row.forEach((value, colIndex) => {
        if (value !== '') sheet.cells[`${columnName(colIndex)}${rowIndex + 1}`] = { v: value };
      });
    });
    loadWorkbook({ title: stripExtension(node.name), sheets: [sheet], activeSheet: sheet.id }, node);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [win.payload?.path, win.payload?.untitled]);

  useEffect(() => {
    setTitle(win.id, `${t('Calc')} — ${workbook.title}${dirty ? ' •' : ''}`);
  }, [workbook.title, dirty, setTitle, t, win.id]);

  const updateSheet = (updater: (sheet: Sheet) => Sheet) => {
    setWorkbook((current) => ({
      ...current,
      sheets: current.sheets.map((sheet) => (sheet.id === current.activeSheet ? updater(sheet) : sheet)),
    }));
    setDirty(true);
  };

  const setCell = (ref: string, patch: Partial<SheetCell> | null) => {
    updateSheet((sheet) => {
      const cells = { ...sheet.cells };
      if (patch === null) delete cells[ref];
      else cells[ref] = { ...(cells[ref] ?? { v: '' }), ...patch };
      return { ...sheet, cells };
    });
  };

  const commitCell = (ref: string, value: string, move: 'down' | 'right' | null = 'down') => {
    setCell(ref, { v: value });
    setEditing(null);
    setDraft('');
    if (move === 'down') {
      const row = Number(ref.replace(/[A-Z]/g, ''));
      if (row < ROWS) setActive(`${ref.replace(/\d+/g, '')}${row + 1}`);
    } else if (move === 'right') {
      const col = ref.replace(/\d+/g, '');
      const nextIndex = ALPHABET.indexOf(col) + 1;
      if (nextIndex < COLS) setActive(`${ALPHABET[nextIndex]}${ref.replace(/[A-Z]/g, '')}`);
    }
  };

  const serialized = useCallback(() => JSON.stringify(workbook), [workbook]);

  const save = () => {
    if (fileNode) {
      updateContent(fileNode.id, serialized(), { title: workbook.title });
      setDirty(false);
      notifySuccess(t('Saved'), fileNode.name, 'calc');
    } else setPickerOpen(true);
  };

  const saveAs = (name: string, folderId: string) => {
    const created = createFile(folderId, name, { content: serialized(), kind: 'spreadsheet' });
    if (!created) {
      notifyError(t('Name already exists'));
      return;
    }
    setFileNode(created);
    setDirty(false);
    setTitle(win.id, `${t('Calc')} — ${name}`);
    notifySuccess(t('Saved'), name, 'calc');
  };

  const exportCsv = () => {
    const csv = toCsv(activeSheet, ROWS, COLS);
    downloadText(`${stripExtension(workbook.title) || 'spreadsheet'}-${activeSheet.name}.csv`, csv, 'text/csv;charset=utf-8');
    notifySuccess(t('Export CSV'), activeSheet.name);
  };

  const importCsvFile = async (file: File) => {
    const text = await file.text();
    const rows = parseCsv(text);
    const sheet = emptySheet(file.name.replace(/\.csv$/i, '') || 'Imported');
    rows.forEach((row, rowIndex) => {
      row.forEach((value, colIndex) => {
        if (value !== '') sheet.cells[`${columnName(colIndex)}${rowIndex + 1}`] = { v: value };
      });
    });
    setWorkbook((current) => ({ ...current, sheets: [...current.sheets, sheet], activeSheet: sheet.id }));
    setDirty(true);
    notifySuccess(t('Import CSV'), `${rows.length} × ${rows[0]?.length ?? 0}`);
  };

  const applyFormat = (patch: Partial<SheetCell>) => setCell(active, patch);

  const activeCell = activeSheet.cells[active];
  const evaluation = evaluateCell(activeSheet, active);
  const displayValue = editing === active ? draft : activeCell?.v ?? '';

  const insertRow = (delta: 1 | -1) => {
    const row = Number(active.replace(/[A-Z]/g, '')) - 1;
    updateSheet((sheet) => ({ ...sheet, cells: shiftCells(sheet.cells, 'row', row + (delta === 1 ? 0 : 0), delta) }));
    notify(delta === 1 ? t('Insert row') : t('Delete row'), { body: active });
  };

  const insertCol = (delta: 1 | -1) => {
    const col = ALPHABET.indexOf(active.replace(/\d+/g, ''));
    updateSheet((sheet) => ({ ...sheet, cells: shiftCells(sheet.cells, 'col', col, delta) }));
    notify(delta === 1 ? t('Insert column') : t('Delete column'), { body: active });
  };

  const addSheet = (name: string) => {
    const sheet = emptySheet(name || `Sheet ${workbook.sheets.length + 1}`);
    setWorkbook((current) => ({ ...current, sheets: [...current.sheets, sheet], activeSheet: sheet.id }));
    setDirty(true);
  };

  const renameSheet = (name: string) => {
    updateSheet((sheet) => ({ ...sheet, name }));
  };

  const deleteSheet = () => {
    if (workbook.sheets.length === 1) return;
    const remaining = workbook.sheets.filter((sheet) => sheet.id !== activeSheet.id);
    setWorkbook((current) => ({ ...current, sheets: remaining, activeSheet: remaining[0].id }));
    setDirty(true);
    setConfirmDelete(false);
  };

  const moveSheet = (direction: -1 | 1) => {
    const index = workbook.sheets.findIndex((sheet) => sheet.id === activeSheet.id);
    const target = index + direction;
    if (target < 0 || target >= workbook.sheets.length) return;
    const sheets = [...workbook.sheets];
    const [removed] = sheets.splice(index, 1);
    sheets.splice(target, 0, removed);
    setWorkbook((current) => ({ ...current, sheets }));
    setDirty(true);
  };

  const beginEdit = (ref: string) => {
    setActive(ref);
    setDraft(activeSheet.cells[ref]?.v ?? '');
    setEditing(ref);
  };

  useEffect(() => {
    const onMove = (event: PointerEvent) => {
      const state = resizeRef.current;
      if (!state) return;
      const width = Math.max(52, Math.min(360, state.startWidth + (event.clientX - state.startX)));
      updateSheet((sheet) => ({ ...sheet, colWidths: { ...sheet.colWidths, [state.col]: width } }));
    };
    const onUp = () => {
      resizeRef.current = null;
    };
    window.addEventListener('pointermove', onMove);
    window.addEventListener('pointerup', onUp);
    return () => {
      window.removeEventListener('pointermove', onMove);
      window.removeEventListener('pointerup', onUp);
    };
  }, []);

  const colWidth = (col: string) => activeSheet.colWidths[col] ?? 108;

  const splitRef = (ref: string) => {
    const match = /^([A-Z]+)(\d+)$/.exec(ref);
    return { col: match ? Math.max(0, ALPHABET.indexOf(match[1])) : 0, row: match ? Number(match[2]) - 1 : 0 };
  };

  const moveActive = (deltaRow: number, deltaCol: number) => {
    const { col, row } = splitRef(active);
    const nextCol = Math.min(ALPHABET.length - 1, Math.max(0, col + deltaCol));
    const nextRow = Math.min(ROWS - 1, Math.max(0, row + deltaRow));
    setActive(`${ALPHABET[nextCol]}${nextRow + 1}`);
    setEditing(null);
    setDraft('');
  };

  const onGridKeyDown = (event: React.KeyboardEvent) => {
    if (event.target instanceof HTMLInputElement) return;
    const mod = event.ctrlKey || event.metaKey;
    if (mod && event.key.toLowerCase() === 'c') {
      cellClipboard.current = { ref: active, value: activeSheet.cells[active]?.v ?? '' };
      notify(t('Copied to clipboard'), { body: active });
      return;
    }
    if (mod && event.key.toLowerCase() === 'v') {
      const item = cellClipboard.current;
      if (!item) return;
      setCell(active, { v: item.value });
      notify(t('Paste'), { body: `${item.ref} → ${active}` });
      return;
    }
    if (event.key === 'ArrowDown' || event.key === 'ArrowUp' || event.key === 'ArrowLeft' || event.key === 'ArrowRight') {
      event.preventDefault();
      moveActive(event.key === 'ArrowDown' ? 1 : event.key === 'ArrowUp' ? -1 : 0, event.key === 'ArrowRight' ? 1 : event.key === 'ArrowLeft' ? -1 : 0);
      return;
    }
    if (event.key === 'Enter' || event.key === 'F2') {
      event.preventDefault();
      beginEdit(active);
      return;
    }
    if (event.key === 'Tab') {
      event.preventDefault();
      moveActive(0, event.shiftKey ? -1 : 1);
      return;
    }
    if (event.key === 'Delete' || event.key === 'Backspace') {
      event.preventDefault();
      setCell(active, null);
      return;
    }
    if (event.key.length === 1 && !mod && !event.altKey) {
      setDraft(event.key);
      setEditing(active);
      event.preventDefault();
    }
  };

  return (
    <div className="app calc">
      <div className="app__menubar">
        <button
          className="menubar__item"
          onClick={() => loadWorkbook(emptyWorkbook(), null)}
        >
          <Plus size={14} /> {t('New Spreadsheet')}
        </button>
        <button className="menubar__item" onClick={() => setOpenPicker(true)}>
          <FolderOpen size={14} /> {t('Open')}
        </button>
        <button className="menubar__item" onClick={save}>
          <Save size={14} /> {t('Save')}
        </button>
        <button className="menubar__item" onClick={() => setPickerOpen(true)}>
          {t('Save As')}
        </button>
        <span className="menubar__sep" />
        <button className="menubar__item" onClick={exportCsv}>
          <Download size={14} /> {t('Export CSV')}
        </button>
        <button className="menubar__item" onClick={() => importRef.current?.click()}>
          <Upload size={14} /> {t('Import CSV')}
        </button>
        <span className="menubar__spacer" />
        <span className="tiny faint">{t('SUM, AVERAGE, MIN, MAX, COUNT and basic arithmetic are supported.')}</span>
      </div>

      <div className="app__toolbar">
        <div className="calc__namebox">
          <span className="calc__ref">{active}</span>
          <span className="calc__fx">fx</span>
          <input
            className="input calc__formula"
            value={displayValue}
            aria-label={t('Formula')}
            onChange={(event) => {
              setDraft(event.target.value);
              setEditing(active);
            }}
            onKeyDown={(event) => {
              if (event.key === 'Enter') commitCell(active, editing === active ? draft : displayValue, 'down');
              if (event.key === 'Escape') {
                setEditing(null);
                setDraft('');
              }
            }}
          />
        </div>
        <span className="app__toolbar-sep" />
        <button className="icon-btn" onClick={() => applyFormat({ bold: !activeCell?.bold })} title={t('Bold')}>
          <Bold size={15} style={{ opacity: activeCell?.bold ? 1 : 0.65 }} />
        </button>
        <button className="icon-btn" onClick={() => applyFormat({ italic: !activeCell?.italic })} title={t('Italic')}>
          <Italic size={15} style={{ opacity: activeCell?.italic ? 1 : 0.65 }} />
        </button>
        <button className="icon-btn" onClick={() => applyFormat({ align: 'left' })} title={t('Align left')}>
          <AlignLeft size={15} />
        </button>
        <button className="icon-btn" onClick={() => applyFormat({ align: 'center' })} title={t('Align center')}>
          <AlignCenter size={15} />
        </button>
        <button className="icon-btn" onClick={() => applyFormat({ align: 'right' })} title={t('Align right')}>
          <AlignRight size={15} />
        </button>
        <label className="icon-btn" title={t('Text color')} style={{ position: 'relative', cursor: 'pointer' }}>
          <span style={{ fontWeight: 700, fontSize: 12 }}>A</span>
          <input
            type="color"
            className="color-input"
            defaultValue="#e9eff7"
            onChange={(event) => applyFormat({ color: event.target.value })}
          />
        </label>
        <label className="icon-btn" title={t('Cell background')} style={{ position: 'relative', cursor: 'pointer' }}>
          <span className="calc__fill-swatch" />
          <input
            type="color"
            className="color-input"
            defaultValue="#1f2c3a"
            onChange={(event) => applyFormat({ bg: event.target.value })}
          />
        </label>
        <select
          className="select select--compact"
          value={activeCell?.format ?? 'number'}
          onChange={(event) => applyFormat({ format: event.target.value as SheetCell['format'] })}
          title={t('Format')}
        >
          <option value="text">{t('Text')}</option>
          <option value="number">{t('Number')}</option>
          <option value="currency">{t('Currency')}</option>
          <option value="percent">{t('Percent')}</option>
        </select>
        <span className="app__toolbar-sep" />
        <button className="icon-btn" onClick={() => insertRow(1)} title={t('Insert row')}>
          <ArrowDownToLine size={15} />
        </button>
        <button className="icon-btn" onClick={() => insertRow(-1)} title={t('Delete row')}>
          <ArrowUpFromLine size={15} />
        </button>
        <button className="icon-btn" onClick={() => insertCol(1)} title={t('Insert column')}>
          <ArrowLeftRight size={15} />
        </button>
        <button className="icon-btn" onClick={() => insertCol(-1)} title={t('Delete column')}>
          <Eraser size={15} />
        </button>
        <button className="icon-btn" onClick={() => setCell(active, null)} title={t('Clear')}>
          <Trash2 size={15} />
        </button>
      </div>

      <div className="calc__grid-wrap" ref={gridRef} tabIndex={0} onKeyDown={onGridKeyDown} aria-label={t('Spreadsheet grid')}>
        <div className="calc__grid" style={{ width: 54 + ALPHABET.reduce((acc, col) => acc + colWidth(col), 0) }}>
          <div className="calc__corner" />
          {ALPHABET.map((col) => (
            <div key={col} className="calc__col-head" style={{ width: colWidth(col) }}>
              <span>{col}</span>
              <span
                className="calc__col-resizer"
                onPointerDown={(event) => {
                  resizeRef.current = { col, startX: event.clientX, startWidth: colWidth(col) };
                }}
                title={t('Column width')}
              />
            </div>
          ))}

          {ROW_INDEXES.map((rowNumber) => (
            <div key={`row-${rowNumber}`} className="calc__row" style={{ display: 'contents' }}>
              <div className="calc__row-head">{rowNumber}</div>
              {ALPHABET.map((col) => {
                const ref = `${col}${rowNumber}`;
                const cell = activeSheet.cells[ref];
                const result = evaluateCell(activeSheet, ref);
                const isActive = active === ref;
                const isEditing = editing === ref;
                return (
                  <div
                    key={ref}
                    className={cn('calc__cell', isActive && 'is-active', cell?.bg && 'has-bg')}
                    style={{
                      width: colWidth(col),
                      background: cell?.bg,
                      textAlign: cell?.align ?? (result.numeric !== null ? 'right' : 'left'),
                      fontWeight: cell?.bold ? 600 : 400,
                      fontStyle: cell?.italic ? 'italic' : 'normal',
                      color: cell?.color,
                      height: activeSheet.rowHeights[`${rowNumber}`] ?? 28,
                    }}
                    onPointerDown={() => {
                      setActive(ref);
                      setEditing(null);
                      setDraft('');
                    }}
                    onDoubleClick={() => beginEdit(ref)}
                  >
                    {isEditing ? (
                      <input
                        className="calc__cell-input"
                        value={draft}
                        autoFocus
                        onChange={(event) => setDraft(event.target.value)}
                        onBlur={() => commitCell(ref, draft, null)}
                        onKeyDown={(event) => {
                          if (event.key === 'Enter') {
                            event.preventDefault();
                            commitCell(ref, draft, 'down');
                          } else if (event.key === 'Tab') {
                            event.preventDefault();
                            commitCell(ref, draft, 'right');
                          } else if (event.key === 'Escape') {
                            setEditing(null);
                            setDraft('');
                          }
                        }}
                      />
                    ) : (
                      <span className={cn('calc__cell-text', result.error && 'is-error')}>
                        {result.error ? '#ERROR' : result.display}
                      </span>
                    )}
                  </div>
                );
              })}
            </div>
          ))}
        </div>
      </div>

      <div className="calc__sheets">
        <button className="icon-btn" onClick={() => moveSheet(-1)} title={t('Move left')}>
          <ChevronLeft size={14} />
        </button>
        <button className="icon-btn" onClick={() => moveSheet(1)} title={t('Move right')}>
          <ChevronRight size={14} />
        </button>
        <div className="calc__sheet-tabs">
          {workbook.sheets.map((sheet) => (
            <button
              key={sheet.id}
              className={cn('calc__sheet-tab', sheet.id === activeSheet.id && 'is-active')}
              onClick={() => {
                setWorkbook((current) => ({ ...current, activeSheet: sheet.id }));
                setActive('A1');
              }}
              onDoubleClick={() => setPrompt('rename')}
              title={t('Rename sheet')}
            >
              {sheet.name}
            </button>
          ))}
          <button className="icon-btn" onClick={() => setPrompt('sheet')} title={t('Add sheet')}>
            <Plus size={14} />
          </button>
          <button
            className="icon-btn"
            onClick={() => setConfirmDelete(true)}
            title={t('Delete sheet')}
            disabled={workbook.sheets.length === 1}
          >
            <Trash2 size={13} />
          </button>
        </div>
        <span className="grow" />
        <span className="tiny faint">
          {editing === active && evaluation.error ? t('Unsupported formula: {formula}', { formula: evaluation.raw }) : ''}
        </span>
      </div>

      <footer className="app__status">
        <span>
          {active} · {evaluation.error ? `#ERROR — ${evaluation.error}` : evaluation.display || '—'}
        </span>
        <span className="faint">
          {dirty ? t('Unsaved changes') : t('Saved')} · {workbook.sheets.length} {t('Sheet')}
        </span>
      </footer>

      <input
        ref={importRef}
        type="file"
        accept=".csv,text/csv"
        hidden
        onChange={(event) => {
          const file = event.target.files?.[0];
          if (file) void importCsvFile(file);
          event.target.value = '';
        }}
      />

      <FilePicker
        open={pickerOpen}
        mode="save"
        initialName={`${stripExtension(workbook.title) || 'Untitled'}.novasheet`}
        initialFolderPath="/home/demo/Documents"
        extension="novasheet"
        onClose={() => setPickerOpen(false)}
        onSave={({ name, folderId }) => saveAs(name, folderId)}
      />
      <FilePicker
        open={openPicker}
        mode="open"
        kinds={['spreadsheet', 'text']}
        onClose={() => setOpenPicker(false)}
        onOpen={(node) => {
          try {
            const parsed = JSON.parse(node.content) as Workbook;
            if (Array.isArray(parsed.sheets) && parsed.sheets.length > 0) {
              loadWorkbook(parsed, node);
              return;
            }
          } catch {
            /* csv fallback */
          }
          const rows = parseCsv(node.content);
          const sheet = emptySheet(stripExtension(node.name) || 'Imported');
          rows.forEach((row, rowIndex) =>
            row.forEach((value, colIndex) => {
              if (value !== '') sheet.cells[`${columnName(colIndex)}${rowIndex + 1}`] = { v: value };
            }),
          );
          loadWorkbook({ title: stripExtension(node.name), sheets: [sheet], activeSheet: sheet.id }, node);
        }}
      />
      <PromptDialog
        open={prompt === 'sheet'}
        title={t('Add sheet')}
        label={t('Sheet')}
        initialValue={`Sheet ${workbook.sheets.length + 1}`}
        onCancel={() => setPrompt(null)}
        onSubmit={(name) => addSheet(name)}
      />
      <PromptDialog
        open={prompt === 'rename'}
        title={t('Rename sheet')}
        label={t('Sheet')}
        initialValue={activeSheet.name}
        onCancel={() => setPrompt(null)}
        onSubmit={(name) => renameSheet(name)}
      />
      <ConfirmDialog
        open={confirmDelete}
        title={t('Delete sheet')}
        message={`${activeSheet.name} — ${t('This action cannot be undone.')}`}
        danger
        onCancel={() => setConfirmDelete(false)}
        onConfirm={deleteSheet}
      />
    </div>
  );
}
