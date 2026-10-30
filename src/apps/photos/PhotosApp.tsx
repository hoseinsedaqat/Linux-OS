import { useEffect, useMemo, useState } from 'react';
import {
  ChevronLeft,
  ChevronRight,
  FolderOpen,
  ImageOff,
  Images,
  Info,
  Maximize2,
  RotateCw,
  Wallpaper,
  ZoomIn,
  ZoomOut,
} from 'lucide-react';
import type { AppWindowProps } from '@/core/apps/types';
import { useT } from '@/core/localization/i18n';
import { useWindows } from '@/core/window-manager/windowsStore';
import { useSettings } from '@/core/themes/settingsStore';
import { notifySuccess } from '@/core/notifications/notificationsStore';
import { useFiles } from '@/core/virtual-filesystem/fsStore';
import { FOLDER_IDS, childrenOf } from '@/core/virtual-filesystem/fsUtils';
import type { FSNode } from '@/types';
import { cn } from '@/utils';

function toDataUrl(node: FSNode): string {
  const content = node.content ?? '';
  if (content.startsWith('data:')) return content;
  if (content.trimStart().startsWith('<svg')) return `data:image/svg+xml;utf8,${encodeURIComponent(content)}`;
  return content;
}

export function PhotosApp(_props: AppWindowProps) {
  const t = useT();
  const openApp = useWindows((state) => state.openApp);
  const nodes = useFiles((state) => state.nodes);
  const patchSettings = useSettings((state) => state.patch);

  const images = useMemo(
    () => childrenOf(nodes, FOLDER_IDS.pictures).filter((node) => node.kind === 'image'),
    [nodes],
  );

  const [index, setIndex] = useState(0);
  const [zoom, setZoom] = useState(1);
  const [rotation, setRotation] = useState(0);
  const [showInfo, setShowInfo] = useState(false);
  const current = images[Math.min(index, Math.max(images.length - 1, 0))];

  const step = (delta: number) => {
    if (images.length === 0) return;
    setIndex((value) => (value + delta + images.length) % images.length);
    setZoom(1);
    setRotation(0);
  };

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (!event.target) return;
      if (!(event.target as HTMLElement).closest('.photos')) return;
      if (event.key === 'ArrowRight') step(1);
      if (event.key === 'ArrowLeft') step(-1);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [images.length]);

  if (images.length === 0) {
    return (
      <div
      className="app photos"
      onDragOver={(event) => {
        if (event.dataTransfer.types.includes('text/nova-file')) event.preventDefault();
      }}
      onDrop={(event) => {
        const id = event.dataTransfer.getData('text/nova-file');
        if (!id) return;
        const node = useFiles.getState().nodes[id];
        if (!node || node.kind !== 'image') return;
        event.preventDefault();
        let targetId = node.id;
        if (node.parentId !== FOLDER_IDS.pictures) {
          // Real copy into Pictures, so the gallery can show it from now on.
          const copy = useFiles.getState().duplicateNode(node.id);
          if (copy && useFiles.getState().moveNode(copy.id, FOLDER_IDS.pictures)) targetId = copy.id;
        }
        const position = useFiles
          .getState()
          .nodes[targetId]
          ? images.findIndex((image) => image.id === targetId)
          : -1;
        if (position >= 0) setIndex(position);
      }}
    >
        <div className="photos__empty">
          <ImageOff size={30} strokeWidth={1.3} />
          <strong>{t('No pictures yet')}</strong>
          <p>{t('Images in ~/Pictures appear here automatically.')}</p>
          <button className="btn btn--primary" onClick={() => openApp('files', { folderPath: '~/Pictures' })}>
            <FolderOpen size={13} /> {t('Open ~/Pictures')}
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="app photos">
      <div className="photos__bar">
        <span className="photos__count">
          <Images size={13} /> {t('{count} pictures', { count: images.length })}
        </span>
        <div className="photos__actions">
          <button className="icon-btn" onClick={() => setZoom((value) => Math.max(0.5, value - 0.15))} title={t('Zoom out')}>
            <ZoomOut size={14} />
          </button>
          <span className="photos__zoom">{Math.round(zoom * 100)}%</span>
          <button className="icon-btn" onClick={() => setZoom((value) => Math.min(3, value + 0.15))} title={t('Zoom in')}>
            <ZoomIn size={14} />
          </button>
          <button className="icon-btn" onClick={() => setRotation((value) => (value + 90) % 360)} title={t('Rotate')}>
            <RotateCw size={14} />
          </button>
          <button className="icon-btn" onClick={() => setZoom(1)} title={t('Fit to window')}>
            <Maximize2 size={14} />
          </button>
          <button
            className={cn('icon-btn', showInfo && 'is-active')}
            onClick={() => setShowInfo((value) => !value)}
            title={t('Details')}
          >
            <Info size={14} />
          </button>
          <button
            className="btn btn--ghost btn--sm"
            onClick={() => {
              if (!current) return;
              patchSettings({ wallpaper: 'custom', customWallpaper: toDataUrl(current) });
              notifySuccess(t('Wallpaper changed'), current.name, 'photos');
            }}
          >
            <Wallpaper size={13} /> {t('Set as wallpaper')}
          </button>
        </div>
      </div>

      <div className="photos__stage">
        <button className="photos__nav photos__nav--prev" onClick={() => step(-1)} aria-label={t('Previous')}>
          <ChevronLeft size={20} />
        </button>
        <figure className="photos__figure">
          <img
            key={current.id}
            src={toDataUrl(current)}
            alt={current.name}
            style={{ transform: `scale(${zoom}) rotate(${rotation}deg)` }}
            draggable={false}
          />
          <figcaption className="photos__caption">
            {current.name}
            <span>
              {index + 1} / {images.length}
            </span>
          </figcaption>
        </figure>
        <button className="photos__nav photos__nav--next" onClick={() => step(1)} aria-label={t('Next')}>
          <ChevronRight size={20} />
        </button>

        {showInfo && (
          <aside className="photos__info">
            <strong>{t('Details')}</strong>
            <dl>
              <dt>{t('Name')}</dt>
              <dd>{current.name}</dd>
              <dt>{t('Type')}</dt>
              <dd>{String(current.meta?.mime ?? current.kind)}</dd>
              <dt>{t('Location')}</dt>
              <dd>~/Pictures</dd>
              <dt>{t('Size')}</dt>
              <dd>{((current.content ?? '').length / 1024).toFixed(1)} kB</dd>
              <dt>{t('Updated')}</dt>
              <dd>{new Date(current.modifiedAt).toLocaleString()}</dd>
            </dl>
          </aside>
        )}
      </div>

      <div className="photos__strip">
        {images.map((node, nodeIndex) => (
          <button
            key={node.id}
            className={cn('photos__thumb', nodeIndex === index && 'is-active')}
            onClick={() => {
              setIndex(nodeIndex);
              setZoom(1);
              setRotation(0);
            }}
            title={node.name}
          >
            <img src={toDataUrl(node)} alt={node.name} loading="lazy" />
          </button>
        ))}
      </div>
    </div>
  );
}
