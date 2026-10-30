import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  AlignCenter,
  AlignLeft,
  AlignRight,
  Bold,
  FileDown,
  FilePlus2,
  LayoutTemplate,
  FolderOpen,
  Highlighter,
  Italic,
  Link2,
  List,
  ListOrdered,
  Printer,
  Redo2,
  Save,
  Search,
  Table2,
  Underline,
  Undo2,
  X,
} from 'lucide-react';
import type { FSNode } from '@/types';
import type { AppWindowProps } from '@/core/apps/types';
import type { WriterDoc } from '@/types/documents';
import { useFiles } from '@/core/virtual-filesystem/fsStore';
import { useWindows } from '@/core/window-manager/windowsStore';
import { useSettings } from '@/core/themes/settingsStore';
import { FilePicker } from '@/components/common/FilePicker';
import { Modal } from '@/components/common/Modal';
import { PromptDialog } from '@/components/common/PromptDialog';
import { useT } from '@/core/localization/i18n';
import { notify, notifySuccess } from '@/core/notifications/notificationsStore';
import { openPrintWindow } from '@/services/print';
import { WRITER_TEMPLATES } from './templates';
import { downloadText, escapeHtml, stripExtension } from '@/utils';
import { formatLocalizedDate } from '@/core/localization/i18n';
import { cn } from '@/utils';

const FONTS = ['Inter', 'Vazirmatn', 'Georgia', 'Times New Roman', 'Courier New', 'Arial'];
const SIZES = [
  { label: '10', value: '1' },
  { label: '12', value: '2' },
  { label: '14', value: '3' },
  { label: '18', value: '4' },
  { label: '24', value: '5' },
  { label: '32', value: '6' },
  { label: '48', value: '7' },
];

function textToHtml(text: string): string {
  return text
    .split(/\n{2,}/)
    .map((block) => `<p>${escapeHtml(block).replace(/\n/g, '<br>') || '<br>'}</p>`)
    .join('');
}

function htmlToText(html: string): string {
  const container = document.createElement('div');
  container.innerHTML = html
    .replace(/<\/(p|div|h1|h2|h3|li|tr)>/gi, '\n')
    .replace(/<br\s*\/?>/gi, '\n');
  return (container.textContent ?? '').replace(/\n{3,}/g, '\n\n').trim();
}

function countWords(text: string): number {
  const trimmed = text.trim();
  if (!trimmed) return 0;
  return trimmed.split(/\s+/).length;
}

export function WriterApp({ win }: AppWindowProps) {
  const t = useT();
  const language = useSettings((state) => state.language);
  const createFile = useFiles((state) => state.createFile);
  const updateContent = useFiles((state) => state.updateContent);
  const setTitle = useWindows((state) => state.setTitle);

  const [doc, setDoc] = useState<WriterDoc>(() => ({ title: 'Untitled Document', html: '<p><br></p>' }));
  const [fileNode, setFileNode] = useState<FSNode | null>(null);
  const [dirty, setDirty] = useState(false);
  const [plainMode, setPlainMode] = useState(false);
  const [pageSize, setPageSize] = useState<'a4' | 'letter'>('a4');
  const [lineHeight, setLineHeight] = useState(1.6);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [openPicker, setOpenPicker] = useState(false);
  const [findOpen, setFindOpen] = useState(false);
  const [findText, setFindText] = useState('');
  const [replaceText, setReplaceText] = useState('');
  const [matches, setMatches] = useState(0);
  const [preview, setPreview] = useState(false);
  const [prompt, setPrompt] = useState<null | 'table' | 'link'>(null);
  const [templatesOpen, setTemplatesOpen] = useState(false);
  const editorRef = useRef<HTMLDivElement | null>(null);
  const savedHtml = useRef(doc.html);
  const pendingHtml = useRef<string | null>(null);
  const [loadVersion, setLoadVersion] = useState(0);

  /** Load a document into the editor exactly once (avoids caret jumps). */
  const loadDocument = useCallback((next: WriterDoc, node: FSNode | null, plain: boolean) => {
    pendingHtml.current = next.html;
    savedHtml.current = next.html;
    setDoc(next);
    setFileNode(node);
    setPlainMode(plain);
    setDirty(false);
    setLoadVersion((version) => version + 1);
  }, []);

  useEffect(() => {
    if (!editorRef.current) return;
    const html = pendingHtml.current ?? doc.html;
    editorRef.current.innerHTML = html;
    editorRef.current.style.lineHeight = String(lineHeight);
    savedHtml.current = html;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loadVersion]);

  useEffect(() => {
    const path = win.payload?.path;
    if (!path) {
      if (win.payload?.untitled) {
        loadDocument({ title: 'Untitled Document', html: '<p><br></p>' }, null, false);
      }
      return;
    }
    const node = Object.values(useFiles.getState().nodes).find((item) => item.id === path);
    if (!node) return;
    if (node.kind === 'document') {
      try {
        const parsed = JSON.parse(node.content) as WriterDoc;
        loadDocument(
          { title: parsed.title || stripExtension(node.name), html: parsed.html || '<p><br></p>' },
          node,
          false,
        );
      } catch {
        loadDocument({ title: stripExtension(node.name), html: textToHtml(node.content) }, node, false);
      }
    } else {
      loadDocument({ title: stripExtension(node.name), html: textToHtml(node.content) }, node, true);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [win.payload?.path, win.payload?.untitled]);

  useEffect(() => {
    setTitle(win.id, `${t('Writer')} — ${doc.title}${dirty ? ' •' : ''}`);
  }, [doc.title, dirty, setTitle, t, win.id]);

  const exec = (command: string, value?: string) => {
    editorRef.current?.focus();
    document.execCommand(command, false, value);
    syncFromEditor();
  };

  const syncFromEditor = () => {
    if (!editorRef.current) return;
    const html = editorRef.current.innerHTML;
    setDoc((current) => ({ ...current, html }));
    setDirty(html !== savedHtml.current);
  };

  const wordCount = useMemo(() => countWords(htmlToText(doc.html)), [doc.html]);
  const charCount = useMemo(() => htmlToText(doc.html).length, [doc.html]);

  const serialize = useCallback(() => {
    if (plainMode && fileNode) return htmlToText(doc.html);
    return JSON.stringify({ ...doc, html: doc.html });
  }, [doc, plainMode, fileNode]);

  const save = () => {
    if (fileNode) {
      updateContent(fileNode.id, serialize(), { title: doc.title });
      savedHtml.current = doc.html;
      setDirty(false);
      notifySuccess(t('Document saved'), fileNode.name, 'writer');
      return;
    }
    setPickerOpen(true);
  };

  const saveAs = (name: string, folderId: string) => {
    const content = serialize();
    const created = createFile(folderId, name, { content, kind: plainMode ? 'text' : 'document' });
    if (!created) {
      notify(t('Name already exists'), { kind: 'error' });
      return;
    }
    setFileNode(created);
    savedHtml.current = doc.html;
    setDirty(false);
    setTitle(win.id, `${t('Writer')} — ${created.name}`);
    notifySuccess(t('Document saved'), created.name, 'writer');
  };

  const replaceAll = () => {
    if (!editorRef.current || !findText) return;
    const walker = document.createTreeWalker(editorRef.current, NodeFilter.SHOW_TEXT);
    let replaced = 0;
    const targets: Text[] = [];
    let node = walker.nextNode();
    while (node) {
      if (node.nodeType === Node.TEXT_NODE && (node as Text).data.includes(findText)) targets.push(node as Text);
      node = walker.nextNode();
    }
    targets.forEach((textNode) => {
      replaced += textNode.data.split(findText).length - 1;
      textNode.data = textNode.data.split(findText).join(replaceText);
    });
    syncFromEditor();
    setMatches(0);
    notify(replaced ? `${t('Replaced')}: ${replaced}` : t('No matching text'), { kind: replaced ? 'success' : 'info' });
  };

  const findMatches = (value: string) => {
    setFindText(value);
    if (!editorRef.current || !value) {
      setMatches(0);
      return;
    }
    const text = editorRef.current.innerText ?? '';
    let count = 0;
    let index = text.indexOf(value);
    while (index !== -1) {
      count += 1;
      index = text.indexOf(value, index + value.length);
    }
    setMatches(count);
    if (count > 0) {
      const selection = window.getSelection();
      const walker = document.createTreeWalker(editorRef.current, NodeFilter.SHOW_TEXT);
      let node = walker.nextNode();
      while (node) {
        const data = (node as Text).data;
        const at = data.indexOf(value);
        if (at !== -1) {
          const range = document.createRange();
          range.setStart(node, at);
          range.setEnd(node, at + value.length);
          selection?.removeAllRanges();
          selection?.addRange(range);
          (node.parentElement as HTMLElement | null)?.scrollIntoView({ block: 'center' });
          break;
        }
        node = walker.nextNode();
      }
    }
  };

  const exportTxt = () => {
    const text = htmlToText(doc.html);
    downloadText(`${stripExtension(doc.title) || 'document'}.txt`, text);
    notifySuccess(t('Export'), 'TXT');
  };

  const exportHtml = () => {
    const html = `<!doctype html><html><head><meta charset="utf-8"><title>${escapeHtml(doc.title)}</title>
<style>body{font-family:Inter,Vazirmatn,sans-serif;max-width:760px;margin:40px auto;line-height:1.7;color:#1b2733;padding:0 20px}</style>
</head><body>${doc.html}</body></html>`;
    downloadText(`${stripExtension(doc.title) || 'document'}.html`, html, 'text/html;charset=utf-8');
    notifySuccess(t('Export'), 'HTML');
  };

  const insertTable = (rows: number, cols: number) => {
    const cells = Array.from({ length: cols }, () => '<td>&nbsp;</td>').join('');
    const html = `<table style="border-collapse:collapse;width:100%"><tbody>${Array.from({ length: rows }, () => `<tr>${cells}</tr>`).join('')}</tbody></table><p><br></p>`;
    exec('insertHTML', html);
  };

  const newDoc = () => loadDocument({ title: 'Untitled Document', html: '<p><br></p>' }, null, false);

  const openFromPicker = (node: FSNode) => {
    const html =
      node.kind === 'document'
        ? (() => {
            try {
              return (JSON.parse(node.content) as WriterDoc).html;
            } catch {
              return textToHtml(node.content);
            }
          })()
        : textToHtml(node.content);
    loadDocument({ title: stripExtension(node.name), html }, node, node.kind === 'text');
  };

  const print = () => {
    openPrintWindow(doc.title, doc.html, 'portrait');
  };

  /** "Save as PDF" is the browser's own print dialog — honest about that. */
  const saveAsPdf = () => {
    if (openPrintWindow(doc.title, doc.html, 'portrait')) {
      notifySuccess(t('Choose “Save as PDF”'), t('In the print dialog, pick “Save as PDF” as the destination.'), 'writer');
    }
  };

  const applyTemplate = (id: string) => {
    const template = WRITER_TEMPLATES.find((item) => item.id === id);
    if (!template) return;
    loadDocument({ title: template.name === 'Blank' ? 'Untitled Document' : template.name, html: template.html }, null, false);
    setTemplatesOpen(false);
  };

  return (
    <div
      className="app writer"
      onDragOver={(event) => {
        if (event.dataTransfer.types.includes('text/nova-file')) event.preventDefault();
      }}
      onDrop={(event) => {
        const id = event.dataTransfer.getData('text/nova-file');
        if (!id) return;
        const node = useFiles.getState().nodes[id];
        if (!node || (node.kind !== 'text' && node.kind !== 'document')) return;
        event.preventDefault();
        const html =
          node.kind === 'document'
            ? (() => {
                try {
                  return (JSON.parse(node.content ?? '') as WriterDoc).html;
                } catch {
                  return textToHtml(node.content ?? '');
                }
              })()
            : textToHtml(node.content ?? '');
        setDoc({ title: node.name.replace(/\.[^.]+$/, ''), html });
        setFileNode(node);
        setDirty(false);
        notifySuccess(t('Opened'), node.name, 'writer');
      }}
    >
      <div className="app__menubar">
        <button className="menubar__item" onClick={newDoc}>
          <FilePlus2 size={14} /> {t('New Document')}
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
        <button className="menubar__item" onClick={() => setTemplatesOpen(true)}>
          <LayoutTemplate size={14} /> {t('Templates')}
        </button>
        <span className="menubar__sep" />
        <button className="menubar__item" onClick={() => setPreview(true)}>
          <Printer size={14} /> {t('Print preview')}
        </button>
        <button className="menubar__item" onClick={exportTxt}>
          <FileDown size={14} /> TXT
        </button>
        <button className="menubar__item" onClick={exportHtml}>
          <FileDown size={14} /> HTML
        </button>
        <button className="menubar__item" onClick={saveAsPdf}>
          <FileDown size={14} /> PDF
        </button>
        <span className="menubar__spacer" />
        <button className={cn('menubar__item', findOpen && 'is-active')} onClick={() => setFindOpen((value) => !value)}>
          <Search size={14} /> {t('Find')}
        </button>
      </div>

      <div className="app__toolbar writer__toolbar">
        <select
          className="select select--compact"
          defaultValue="Inter"
          onChange={(event) => exec('fontName', event.target.value)}
          aria-label={t('Font')}
        >
          {FONTS.map((font) => (
            <option key={font} value={font}>
              {font}
            </option>
          ))}
        </select>
        <select
          className="select select--compact"
          defaultValue="3"
          onChange={(event) => exec('fontSize', event.target.value)}
          aria-label={t('Font size')}
        >
          {SIZES.map((size) => (
            <option key={size.value} value={size.value}>
              {size.label}
            </option>
          ))}
        </select>
        <span className="app__toolbar-sep" />
        <button className="icon-btn" onClick={() => exec('undo')} title={t('Undo')}>
          <Undo2 size={15} />
        </button>
        <button className="icon-btn" onClick={() => exec('redo')} title={t('Redo')}>
          <Redo2 size={15} />
        </button>
        <span className="app__toolbar-sep" />
        <button className="icon-btn" onClick={() => exec('bold')} title={t('Bold')}>
          <Bold size={15} />
        </button>
        <button className="icon-btn" onClick={() => exec('italic')} title={t('Italic')}>
          <Italic size={15} />
        </button>
        <button className="icon-btn" onClick={() => exec('underline')} title={t('Underline')}>
          <Underline size={15} />
        </button>
        <label className="icon-btn" style={{ position: 'relative', cursor: 'pointer' }} title={t('Text color')}>
          <span style={{ fontWeight: 700, fontSize: 13 }}>A</span>
          <input
            type="color"
            defaultValue="#e9eff7"
            className="color-input"
            onChange={(event) => exec('foreColor', event.target.value)}
            aria-label={t('Text color')}
          />
        </label>
        <label className="icon-btn" style={{ position: 'relative', cursor: 'pointer' }} title={t('Highlight')}>
          <Highlighter size={15} />
          <input
            type="color"
            defaultValue="#f5c542"
            className="color-input"
            onChange={(event) => exec('hiliteColor', event.target.value)}
            aria-label={t('Highlight')}
          />
        </label>
        <span className="app__toolbar-sep" />
        <button className="icon-btn" onClick={() => exec('justifyLeft')} title={t('Align left')}>
          <AlignLeft size={15} />
        </button>
        <button className="icon-btn" onClick={() => exec('justifyCenter')} title={t('Align center')}>
          <AlignCenter size={15} />
        </button>
        <button className="icon-btn" onClick={() => exec('justifyRight')} title={t('Align right')}>
          <AlignRight size={15} />
        </button>
        <span className="app__toolbar-sep" />
        <button className="icon-btn" onClick={() => exec('insertUnorderedList')} title={t('Bullet list')}>
          <List size={15} />
        </button>
        <button className="icon-btn" onClick={() => exec('insertOrderedList')} title={t('Numbered list')}>
          <ListOrdered size={15} />
        </button>
        <button className="icon-btn" onClick={() => setPrompt('table')} title={t('Insert table')}>
          <Table2 size={15} />
        </button>
        <button className="icon-btn" onClick={() => setPrompt('link')} title={t('Insert link')}>
          <Link2 size={15} />
        </button>
        <span className="app__toolbar-sep" />
        <select
          className="select select--compact"
          value={String(lineHeight)}
          onChange={(event) => {
            const value = Number(event.target.value);
            setLineHeight(value);
            if (editorRef.current) editorRef.current.style.lineHeight = String(value);
          }}
          title={t('Paragraph spacing')}
        >
          {[1.2, 1.4, 1.6, 1.8, 2].map((value) => (
            <option key={value} value={value}>
              {value.toFixed(1)}
            </option>
          ))}
        </select>
        <select
          className="select select--compact"
          value={pageSize}
          onChange={(event) => setPageSize(event.target.value as 'a4' | 'letter')}
          title={t('Page setup')}
        >
          <option value="a4">A4</option>
          <option value="letter">Letter</option>
        </select>
        <input
          className="input input--sm writer__title-input"
          value={doc.title}
          aria-label={t('Document title')}
          onChange={(event) => {
            setDoc((current) => ({ ...current, title: event.target.value }));
            setDirty(true);
          }}
        />
      </div>

      {findOpen && (
        <div className="writer__find">
          <div className="writer__find-row">
            <input
              className="input input--sm"
              placeholder={t('Find what')}
              value={findText}
              onChange={(event) => findMatches(event.target.value)}
            />
            <span className="tiny faint">{matches ? `${matches}` : ''}</span>
            <input
              className="input input--sm"
              placeholder={t('Replace with')}
              value={replaceText}
              onChange={(event) => setReplaceText(event.target.value)}
            />
            <button className="btn btn--sm" onClick={replaceAll} disabled={!findText}>
              {t('Replace all')}
            </button>
            <button className="icon-btn" onClick={() => setFindOpen(false)}>
              <X size={14} />
            </button>
          </div>
        </div>
      )}

      <div className="writer__canvas" onClick={() => editorRef.current?.focus()}>
        <div className={cn('writer__page', pageSize === 'letter' && 'writer__page--letter')}>
          <div
            ref={editorRef}
            className="writer__editor"
            contentEditable
            suppressContentEditableWarning
            spellCheck
            dir={language === 'fa' ? 'rtl' : 'ltr'}
            style={{ lineHeight }}
            onInput={syncFromEditor}
            onBlur={syncFromEditor}
            onKeyDown={(event) => {
              const mod = event.ctrlKey || event.metaKey;
              const key = event.key.toLowerCase();
              if (mod && key === 's') {
                event.preventDefault();
                save();
              } else if (mod && (key === 'b' || key === 'i' || key === 'u')) {
                event.preventDefault();
                exec(key === 'b' ? 'bold' : key === 'i' ? 'italic' : 'underline');
              } else if (mod && key === 'f') {
                event.preventDefault();
                setFindOpen(true);
              } else if (event.key === 'Escape' && findOpen) {
                setFindOpen(false);
              }
            }}
          />
        </div>
      </div>

      <footer className="app__status">
        <span>
          {wordCount} {t('words')} · {charCount} {t('characters')}
        </span>
        <span className="row" style={{ gap: 10 }}>
          {dirty && <span className="badge badge--warning">{t('Unsaved changes')}</span>}
          <span className="faint">
            {fileNode ? `${t('Saved')} · ${formatLocalizedDate(fileNode.modifiedAt, language, { dateStyle: 'medium', timeStyle: 'short' })}` : t('Not saved yet')}
          </span>
        </span>
      </footer>

      <FilePicker
        open={pickerOpen}
        mode="save"
        initialName={`${stripExtension(doc.title) || 'Untitled'}.novadoc`}
        initialFolderPath="/home/demo/Documents"
        extension={plainMode ? 'txt' : 'novadoc'}
        onClose={() => setPickerOpen(false)}
        onSave={({ name, folderId }) => saveAs(name, folderId)}
      />

      <FilePicker
        open={openPicker}
        mode="open"
        kinds={['document', 'text']}
        onClose={() => setOpenPicker(false)}
        onOpen={openFromPicker}
      />

      <PromptDialog
        open={prompt === 'table'}
        title={t('Insert table')}
        label={`${t('Rows')}, ${t('Columns')}`}
        initialValue="3, 3"
        validate={(value) => {
          const match = /^(\d{1,2})\s*[,x]\s*(\d{1,2})$/.exec(value);
          if (!match) return 'Use the format rows, columns — e.g. 3, 3';
          if (Number(match[1]) < 1 || Number(match[2]) < 1) return 'Numbers must be greater than zero';
          return null;
        }}
        onCancel={() => setPrompt(null)}
        onSubmit={(value) => {
          const match = /^(\d{1,2})\s*[,x]\s*(\d{1,2})$/.exec(value) as RegExpExecArray;
          insertTable(Number(match[1]), Number(match[2]));
        }}
      />

      <PromptDialog
        open={prompt === 'link'}
        title={t('Insert link')}
        label={t('URL')}
        initialValue="https://"
        validate={(value) => (/^(https?:\/\/|mailto:|\/)\S+/.test(value) ? null : 'Enter a valid http(s) URL')}
        onCancel={() => setPrompt(null)}
        onSubmit={(value) => {
          const text = window.getSelection()?.toString() || value;
          exec('insertHTML', `<a href="${escapeHtml(value)}" target="_blank" rel="noreferrer">${escapeHtml(text)}</a>`);
        }}
      />

      <Modal
        open={preview}
        onClose={() => setPreview(false)}
        title={t('Print preview')}
        wide
        footer={
          <>
            <button className="btn" onClick={() => setPreview(false)}>
              {t('Close')}
            </button>
            <button className="btn btn--primary" onClick={print}>
              <Printer size={14} /> {t('Print')}
            </button>
          </>
        }
      >
        <div className="print-preview" dangerouslySetInnerHTML={{ __html: doc.html }} />
      </Modal>

      <Modal
        open={templatesOpen}
        onClose={() => setTemplatesOpen(false)}
        title={t('Document templates')}
        icon={<LayoutTemplate size={16} />}
        wide
      >
        <div className="template-grid">
          {WRITER_TEMPLATES.map((template) => (
            <button key={template.id} className="template-card" onClick={() => applyTemplate(template.id)}>
              <div className={cn('template-card__preview', template.rtl && 'is-rtl')}>
                <span />
                <span />
                <span className="is-short" />
              </div>
              <strong>{t(template.name)}</strong>
              <span>{t(template.description)}</span>
            </button>
          ))}
        </div>
      </Modal>
    </div>
  );
}
