import { useCallback, useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { AnimatePresence, motion } from 'framer-motion';
import {
  ChevronLeft,
  ChevronRight,
  Copy,
  Download,
  FolderOpen,
  LayoutTemplate,
  MonitorPlay,
  Palette,
  Plus,
  Printer,
  Save,
  Trash2,
  X,
} from 'lucide-react';
import type { DeckModel, SlideLayout, SlideModel } from '@/types/documents';
import type { FSNode } from '@/types';
import type { AppWindowProps } from '@/core/apps/types';
import { useFiles } from '@/core/virtual-filesystem/fsStore';
import { useWindows } from '@/core/window-manager/windowsStore';
import { FilePicker } from '@/components/common/FilePicker';
import { ConfirmDialog, Modal } from '@/components/common/Modal';
import { DECK_TEMPLATES } from './templates';
import { useT } from '@/core/localization/i18n';
import { notifyError, notifySuccess } from '@/core/notifications/notificationsStore';
import { openPrintWindow } from '@/services/print';
import { downloadText, escapeHtml, stripExtension, uid } from '@/utils';
import { cn } from '@/utils';
import { emptyDeck } from '@/services/fileTemplates';

const THEMES: Record<DeckModel['theme'], { name: string; bg: string; text: string; accent: string }> = {
  midnight: { name: 'Midnight', bg: 'linear-gradient(135deg,#0b1420,#132132)', text: '#eaf2fb', accent: '#3ddc97' },
  mint: { name: 'Mint', bg: 'linear-gradient(135deg,#06231c,#0d3a2d)', text: '#e8fff7', accent: '#6ee7a8' },
  sunset: { name: 'Sunset', bg: 'linear-gradient(135deg,#2a1020,#4a1b25)', text: '#ffece6', accent: '#ff9250' },
  paper: { name: 'Paper', bg: 'linear-gradient(135deg,#f5f2ea,#e9e4d6)', text: '#1d2430', accent: '#b26a2f' },
  ocean: { name: 'Ocean', bg: 'linear-gradient(135deg,#04202c,#08394c)', text: '#e8f7ff', accent: '#5ad1e6' },
};

const LAYOUTS: Array<{ value: SlideLayout; label: string }> = [
  { value: 'title', label: 'Title slide' },
  { value: 'title-body', label: 'Title and text' },
  { value: 'bullets', label: 'Bullets' },
  { value: 'two-column', label: 'Two columns' },
  { value: 'blank', label: 'Blank' },
];

function SlideCanvas({
  slide,
  theme,
  editable,
  onChange,
  scale = 1,
}: {
  slide: SlideModel;
  theme: DeckModel['theme'];
  editable?: boolean;
  onChange?: (patch: Partial<SlideModel>) => void;
  scale?: number;
}) {
  const palette = THEMES[theme];
  const background = slide.bg ?? palette.bg;
  const edit = (field: 'title' | 'body' | 'second', stripBullets = false) => ({
    contentEditable: editable,
    suppressContentEditableWarning: true,
    onBlur: (event: React.FocusEvent<HTMLDivElement>) =>
      onChange?.({
        [field]: stripBullets
          ? event.currentTarget.innerText
              .split('\n')
              .map((line) => line.replace(/^\s*•\s*/, ''))
              .join('\n')
          : event.currentTarget.innerText,
      }),
    style: { outline: 'none' } as React.CSSProperties,
  });

  const titleStyle: React.CSSProperties = {
    fontSize: `min(4.2vw, ${scale * 30}px)`,
    fontWeight: 700,
    lineHeight: 1.15,
    letterSpacing: '-0.02em',
  };
  const bodyStyle: React.CSSProperties = {
    fontSize: `min(2.1vw, ${scale * 15}px)`,
    lineHeight: 1.55,
    opacity: 0.88,
    whiteSpace: 'pre-wrap',
  };

  return (
    <div
      className="slide"
      style={{
        background,
        color: palette.text,
        aspectRatio: '16 / 9',
        borderRadius: 10,
        padding: `${scale * 36}px ${scale * 42}px`,
        display: 'flex',
        flexDirection: 'column',
        justifyContent: slide.layout === 'title' ? 'center' : 'flex-start',
        gap: scale * 16,
        overflow: 'hidden',
        position: 'relative',
      }}
    >
      {(slide.layout === 'title' || slide.layout === 'title-body' || slide.layout === 'bullets' || slide.layout === 'two-column') && (
        <div {...edit('title')} style={{ ...titleStyle, color: palette.text }}>
          {slide.title}
        </div>
      )}
      {slide.layout === 'title' && (
        <div {...edit('body')} style={{ ...bodyStyle, fontSize: `min(2.4vw, ${scale * 17}px)`, color: palette.accent }}>
          {slide.body}
        </div>
      )}
      {slide.layout === 'title-body' && (
        <div {...edit('body')} style={{ ...bodyStyle, display: 'flex', flexDirection: 'column', gap: scale * 10, flex: 1, overflow: 'auto' }}>
          {slide.body}
        </div>
      )}
      {slide.layout === 'bullets' && (
        <div {...edit('body', true)} style={{ ...bodyStyle, display: 'flex', flexDirection: 'column', gap: scale * 8, flex: 1, overflow: 'auto' }}>
          {slide.body.split('\n').map((line, index) => (
            <div key={`${line}-${index}`} style={{ display: 'flex', gap: scale * 10, alignItems: 'flex-start' }}>
              <span style={{ color: palette.accent, fontWeight: 700 }}>•</span>
              <span>{line}</span>
            </div>
          ))}
        </div>
      )}
      {slide.layout === 'two-column' && (
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: scale * 20, flex: 1, overflow: 'auto' }}>
          <div {...edit('body')} style={{ ...bodyStyle }}>
            {slide.body}
          </div>
          <div {...edit('second')} style={{ ...bodyStyle, opacity: 0.78, borderInlineStart: `2px solid ${palette.accent}33`, paddingInlineStart: scale * 16 }}>
            {slide.second ?? ''}
          </div>
        </div>
      )}
      {slide.layout === 'blank' && (
        <div {...edit('body')} style={{ ...bodyStyle, flex: 1 }}>
          {slide.body}
        </div>
      )}
      <span style={{ position: 'absolute', bottom: scale * 14, insetInlineEnd: scale * 22, fontSize: 10, opacity: 0.4, letterSpacing: '0.18em' }}>
        NOVA
      </span>
    </div>
  );
}

export function ImpressApp({ win }: AppWindowProps) {
  const t = useT();
  const createFile = useFiles((state) => state.createFile);
  const updateContent = useFiles((state) => state.updateContent);
  const setTitle = useWindows((state) => state.setTitle);
  const [deck, setDeck] = useState<DeckModel>(() => emptyDeck());
  const [fileNode, setFileNode] = useState<FSNode | null>(null);
  const [dirty, setDirty] = useState(false);
  const [activeId, setActiveId] = useState(deck.slides[0].id);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [openPicker, setOpenPicker] = useState(false);
  const [presenting, setPresenting] = useState(false);
  const [presentIndex, setPresentIndex] = useState(0);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [templatesOpen, setTemplatesOpen] = useState(false);

  const activeIndex = deck.slides.findIndex((slide) => slide.id === activeId);
  const activeSlide = deck.slides[activeIndex] ?? deck.slides[0];

  const loadDeck = useCallback((next: DeckModel, node: FSNode | null) => {
    setDeck(next);
    setFileNode(node);
    setActiveId(next.slides[0]?.id ?? uid('slide'));
    setDirty(false);
  }, []);

  useEffect(() => {
    const path = win.payload?.path;
    if (!path) {
      if (win.payload?.untitled) loadDeck(emptyDeck(), null);
      return;
    }
    const node = Object.values(useFiles.getState().nodes).find((item) => item.id === path);
    if (!node) return;
    try {
      const parsed = JSON.parse(node.content) as DeckModel;
      if (parsed && Array.isArray(parsed.slides) && parsed.slides.length > 0) {
        loadDeck({ theme: parsed.theme ?? 'midnight', title: parsed.title ?? stripExtension(node.name), slides: parsed.slides }, node);
      }
    } catch {
      notifyError(t('Invalid backup file'), node.name);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [win.payload?.path, win.payload?.untitled]);

  useEffect(() => {
    setTitle(win.id, `${t('Impress')} — ${deck.title}${dirty ? ' •' : ''}`);
  }, [deck.title, dirty, setTitle, t, win.id]);

  const updateSlide = (id: string, patch: Partial<SlideModel>) => {
    setDeck((current) => ({
      ...current,
      slides: current.slides.map((slide) => (slide.id === id ? { ...slide, ...patch } : slide)),
    }));
    setDirty(true);
  };

  const addSlide = () => {
    const slide: SlideModel = { id: uid('slide'), layout: 'title-body', title: t('Title'), body: '' };
    setDeck((current) => ({ ...current, slides: [...current.slides, slide] }));
    setActiveId(slide.id);
    setDirty(true);
  };

  const duplicateSlide = () => {
    if (!activeSlide) return;
    const copy: SlideModel = { ...activeSlide, id: uid('slide') };
    setDeck((current) => {
      const slides = [...current.slides];
      slides.splice(activeIndex + 1, 0, copy);
      return { ...current, slides };
    });
    setActiveId(copy.id);
    setDirty(true);
  };

  const deleteSlide = () => {
    if (!activeSlide || deck.slides.length === 1) return;
    const slides = deck.slides.filter((slide) => slide.id !== activeSlide.id);
    setDeck((current) => ({ ...current, slides }));
    setActiveId(slides[Math.max(0, activeIndex - 1)].id);
    setDirty(true);
    setConfirmDelete(false);
  };

  const moveSlide = (direction: -1 | 1) => {
    const target = activeIndex + direction;
    if (target < 0 || target >= deck.slides.length) return;
    const slides = [...deck.slides];
    const [removed] = slides.splice(activeIndex, 1);
    slides.splice(target, 0, removed);
    setDeck((current) => ({ ...current, slides }));
    setDirty(true);
  };

  const save = () => {
    if (fileNode) {
      updateContent(fileNode.id, JSON.stringify(deck), { title: deck.title });
      setDirty(false);
      notifySuccess(t('Saved'), fileNode.name, 'impress');
    } else setPickerOpen(true);
  };

  const saveAs = (name: string, folderId: string) => {
    const created = createFile(folderId, name, { content: JSON.stringify(deck), kind: 'presentation' });
    if (!created) {
      notifyError(t('Name already exists'));
      return;
    }
    setFileNode(created);
    setDirty(false);
    notifySuccess(t('Saved'), name, 'impress');
  };

  const exportJson = () => {
    downloadText(`${stripExtension(deck.title) || 'presentation'}.novadeck.json`, JSON.stringify(deck, null, 2), 'application/json');
    notifySuccess(t('Export JSON'), deck.title);
  };

  const applyTemplate = (id: string) => {
    const template = DECK_TEMPLATES.find((item) => item.id === id);
    if (!template) return;
    loadDeck(template.build(), null);
    setTemplatesOpen(false);
    notifySuccess(t('Template applied'), t(template.name), 'impress');
  };

  const exportPdf = () => {
    const palette = THEMES[deck.theme];
    const html = deck.slides
      .map(
        (slide) => `<section style="page-break-after:always;min-height:600px;padding:48px 56px;background:${slide.bg ?? palette.bg};color:${palette.text};border-radius:8px;display:flex;flex-direction:column;justify-content:${slide.layout === 'title' ? 'center' : 'flex-start'};gap:16px">
      <h1 style="font-size:36px;margin:0">${escapeHtml(slide.title)}</h1>
      <p style="font-size:18px;line-height:1.6;white-space:pre-wrap">${escapeHtml(slide.body)}</p>
      ${slide.layout === 'two-column' ? `<p style="font-size:18px;line-height:1.6;white-space:pre-wrap">${escapeHtml(slide.second ?? '')}</p>` : ''}
    </section>`,
      )
      .join('');
    openPrintWindow(deck.title, html, 'landscape');
    notifySuccess(t('Print'), t('Export PDF'));
  };

  useEffect(() => {
    const onF5 = (event: KeyboardEvent) => {
      if (event.key === 'F5' && !presenting) {
        event.preventDefault();
        setPresentIndex(0);
        setPresenting(true);
      }
    };
    window.addEventListener('keydown', onF5);
    return () => window.removeEventListener('keydown', onF5);
  }, [presenting]);

  useEffect(() => {
    if (!presenting) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setPresenting(false);
      if (event.key === 'ArrowRight' || event.key === 'PageDown' || event.key === ' ') {
        event.preventDefault();
        setPresentIndex((index) => Math.min(index + 1, deck.slides.length - 1));
      }
      if (event.key === 'ArrowLeft' || event.key === 'PageUp') {
        event.preventDefault();
        setPresentIndex((index) => Math.max(index - 1, 0));
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [presenting, deck.slides.length]);

  const palette = THEMES[deck.theme];

  return (
    <div className="app impress">
      <div className="app__menubar">
        <button className="menubar__item" onClick={() => loadDeck(emptyDeck(), null)}>
          <Plus size={14} /> {t('New Presentation')}
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
        <button
          className="menubar__item"
          onClick={() => {
            setPresentIndex(activeIndex);
            setPresenting(true);
          }}
        >
          <MonitorPlay size={14} /> {t('Slide show')}
        </button>
        <button className="menubar__item" onClick={() => setTemplatesOpen(true)}>
          <LayoutTemplate size={14} /> {t('Templates')}
        </button>
        <button className="menubar__item" onClick={exportJson}>
          <Download size={14} /> {t('Export JSON')}
        </button>
        <button className="menubar__item" onClick={exportPdf}>
          <Printer size={14} /> {t('Export PDF')}
        </button>
        <span className="menubar__spacer" />
        {dirty && <span className="badge badge--warning">{t('Unsaved changes')}</span>}
      </div>

      <div className="impress__body">
        <aside className="impress__rail">
          {deck.slides.map((slide, index) => (
            <button
              key={slide.id}
              className={cn('impress__thumb', slide.id === activeSlide?.id && 'is-active')}
              onClick={() => setActiveId(slide.id)}
              draggable
              onDragStart={(event) => event.dataTransfer.setData('text/nova-slide', slide.id)}
              onDragOver={(event) => event.preventDefault()}
              onDrop={(event) => {
                const draggedId = event.dataTransfer.getData('text/nova-slide');
                if (!draggedId || draggedId === slide.id) return;
                setDeck((current) => {
                  const slides = [...current.slides];
                  const from = slides.findIndex((item) => item.id === draggedId);
                  const to = slides.findIndex((item) => item.id === slide.id);
                  const [moved] = slides.splice(from, 1);
                  slides.splice(to, 0, moved);
                  return { ...current, slides };
                });
                setDirty(true);
              }}
              onDoubleClick={() => {
                setPresentIndex(index);
                setPresenting(true);
              }}
            >
              <span className="impress__thumb-number">{index + 1}</span>
              <div className="impress__thumb-canvas">
                <SlideCanvas slide={slide} theme={deck.theme} scale={0.22} />
              </div>
              <span className="impress__thumb-title">{slide.title || t('Slide {n}', { n: index + 1 })}</span>
            </button>
          ))}
          <div className="impress__rail-actions">
            <button className="btn btn--sm" onClick={addSlide}>
              <Plus size={13} /> {t('New slide')}
            </button>
            <button className="btn btn--sm" onClick={duplicateSlide} title={t('Duplicate')}>
              <Copy size={13} />
            </button>
            <button
              className="btn btn--sm"
              onClick={() => moveSlide(-1)}
              disabled={activeIndex <= 0}
              title={t('Move up')}
            >
              <ChevronLeft size={13} />
            </button>
            <button
              className="btn btn--sm"
              onClick={() => moveSlide(1)}
              disabled={activeIndex >= deck.slides.length - 1}
              title={t('Move down')}
            >
              <ChevronRight size={13} />
            </button>
            <button
              className="btn btn--sm btn--danger"
              onClick={() => setConfirmDelete(true)}
              disabled={deck.slides.length === 1}
              title={t('Delete slide')}
            >
              <Trash2 size={13} />
            </button>
          </div>
        </aside>

        <main className="impress__main">
          <div className="impress__toolbar">
            <label className="row" style={{ gap: 6 }}>
              <LayoutTemplate size={14} className="faint" />
              <select
                className="select select--compact"
                value={activeSlide?.layout ?? 'title-body'}
                onChange={(event) => updateSlide(activeSlide.id, { layout: event.target.value as SlideLayout })}
              >
                {LAYOUTS.map((layout) => (
                  <option key={layout.value} value={layout.value}>
                    {t(layout.label)}
                  </option>
                ))}
              </select>
            </label>
            <label className="row" style={{ gap: 6 }}>
              <Palette size={14} className="faint" />
              <select
                className="select select--compact"
                value={deck.theme}
                onChange={(event) => {
                  setDeck((current) => ({ ...current, theme: event.target.value as DeckModel['theme'] }));
                  setDirty(true);
                }}
              >
                {(Object.keys(THEMES) as Array<DeckModel['theme']>).map((theme) => (
                  <option key={theme} value={theme}>
                    {THEMES[theme].name}
                  </option>
                ))}
              </select>
            </label>
            <label className="row" style={{ gap: 6 }}>
              <span className="tiny faint">{t('Background')}</span>
              <input
                type="color"
                className="color-input color-input--inline"
                value={activeSlide?.bg?.startsWith('#') ? activeSlide.bg : '#0b1420'}
                onChange={(event) => updateSlide(activeSlide.id, { bg: event.target.value })}
              />
              <button className="btn btn--sm btn--ghost" onClick={() => updateSlide(activeSlide.id, { bg: undefined })}>
                {t('Reset to default')}
              </button>
            </label>
            <span className="grow" />
            <input
              className="input input--sm"
              style={{ maxWidth: 220 }}
              value={deck.title}
              aria-label={t('Presentation title')}
              onChange={(event) => {
                setDeck((current) => ({ ...current, title: event.target.value }));
                setDirty(true);
              }}
            />
          </div>

          <div className="impress__stage" style={{ background: palette.bg }}>
            {activeSlide && (
              <SlideCanvas
                slide={activeSlide}
                theme={deck.theme}
                editable
                onChange={(patch) => updateSlide(activeSlide.id, patch)}
                scale={1.35}
              />
            )}
          </div>
          <div className="impress__hint">
            {t('Text boxes are editable directly on the slide.')} · {activeIndex + 1} / {deck.slides.length}
          </div>
        </main>
      </div>

      {presenting &&
        createPortal(
          <AnimatePresence>
            <motion.div
              className="slideshow"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              style={{ background: '#04070a' }}
            >
              <div className="slideshow__stage">
                {deck.slides[presentIndex] && (
                  <SlideCanvas slide={deck.slides[presentIndex]} theme={deck.theme} scale={2} />
                )}
              </div>
              <div className="slideshow__bar">
                <span className="tiny faint">
                  {presentIndex + 1} / {deck.slides.length}
                </span>
                <div className="row" style={{ gap: 6 }}>
                  <button
                    className="btn btn--sm"
                    onClick={() => setPresentIndex((index) => Math.max(0, index - 1))}
                    disabled={presentIndex === 0}
                  >
                    <ChevronLeft size={14} /> {t('Previous')}
                  </button>
                  <button
                    className="btn btn--sm btn--primary"
                    onClick={() => setPresentIndex((index) => Math.min(deck.slides.length - 1, index + 1))}
                    disabled={presentIndex >= deck.slides.length - 1}
                  >
                    {t('Next')} <ChevronRight size={14} />
                  </button>
                  <button className="btn btn--sm btn--ghost" onClick={() => setPresenting(false)}>
                    <X size={14} /> {t('Exit')}
                  </button>
                </div>
              </div>
            </motion.div>
          </AnimatePresence>,
          document.body,
        )}

      <FilePicker
        open={pickerOpen}
        mode="save"
        initialName={`${stripExtension(deck.title) || 'Untitled'}.novadeck`}
        initialFolderPath="/home/demo/Documents"
        extension="novadeck"
        onClose={() => setPickerOpen(false)}
        onSave={({ name, folderId }) => saveAs(name, folderId)}
      />
      <FilePicker
        open={openPicker}
        mode="open"
        kinds={['presentation']}
        onClose={() => setOpenPicker(false)}
        onOpen={(node) => {
          try {
            const parsed = JSON.parse(node.content) as DeckModel;
            if (parsed?.slides?.length) loadDeck({ ...parsed, theme: parsed.theme ?? 'midnight' }, node);
          } catch {
            notifyError(t('Invalid backup file'), node.name);
          }
        }}
      />
      <ConfirmDialog
        open={confirmDelete}
        title={t('Delete slide')}
        message={t('This action cannot be undone.')}
        danger
        onCancel={() => setConfirmDelete(false)}
        onConfirm={deleteSlide}
      />

      <Modal
        open={templatesOpen}
        onClose={() => setTemplatesOpen(false)}
        title={t('Presentation templates')}
        icon={<LayoutTemplate size={16} />}
        wide
      >
        <div className="template-grid">
          {DECK_TEMPLATES.map((template) => (
            <button key={template.id} className="template-card" onClick={() => applyTemplate(template.id)}>
              <div className={cn('template-card__preview', `is-${template.id}`)}>
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
