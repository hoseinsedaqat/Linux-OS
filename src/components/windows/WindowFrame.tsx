import { Suspense, useCallback, useEffect, useRef, useState } from 'react';
import { motion } from 'framer-motion';
import { Columns2, Maximize2, Minus, PanelLeft, PanelRight, X } from 'lucide-react';
import type { WindowInstance } from '@/types';
import { useWindows, workspaceOf } from '@/core/window-manager/windowsStore';
import { useSettings } from '@/core/themes/settingsStore';
import { clampRect, currentMetrics } from '@/core/window-manager/metrics';
import { AppIcon } from '@/components/common/AppIcon';
import { useContextMenu } from '@/components/common/ContextMenu';
import { useT } from '@/core/localization/i18n';
import { APP_COMPONENTS } from '@/core/apps/registry';
import { APP_META } from '@/core/apps/appMeta';
import { cn } from '@/utils';

type Interaction =
  | { kind: 'move'; pointerId: number; startX: number; startY: number; origin: { x: number; y: number } }
  | {
      kind: 'resize';
      dir: string;
      pointerId: number;
      startX: number;
      startY: number;
      origin: { x: number; y: number; width: number; height: number };
    };

const MIN_WIDTH = 260;
const MIN_HEIGHT = 160;

export function WindowFrame({ win }: { win: WindowInstance }) {
  const t = useT();
  const reduceMotion = useSettings((state) => state.reduceMotion);
  const activeId = useWindows((state) => state.activeId);
  const focusWindow = useWindows((state) => state.focusWindow);
  const closeWindow = useWindows((state) => state.closeWindow);
  const minimizeWindow = useWindows((state) => state.minimizeWindow);
  const toggleMaximize = useWindows((state) => state.toggleMaximize);
  const updateRect = useWindows((state) => state.updateRect);
  const snapWindow = useWindows((state) => state.snapWindow);
  const moveToWorkspace = useWindows((state) => state.moveToWorkspace);
  const workspace = useWindows((state) => state.workspace);
  const [interaction, setInteraction] = useState<Interaction | null>(null);
  const [dragging, setDragging] = useState(false);
  const menu = useContextMenu();
  const frameRef = useRef<HTMLDivElement | null>(null);
  const AppComponent = APP_COMPONENTS[win.appId];
  const isActive = activeId === win.id;

  const endInteraction = useCallback(() => {
    setInteraction(null);
    setDragging(false);
  }, []);

  useEffect(() => {
    if (!interaction) return;
    const onMove = (event: PointerEvent) => {
      if (event.pointerId !== interaction.pointerId) return;
      const metrics = currentMetrics();
      const dx = event.clientX - interaction.startX;
      const dy = event.clientY - interaction.startY;
      if (interaction.kind === 'move') {
        updateRect(win.id, {
          x: interaction.origin.x + dx,
          y: interaction.origin.y + dy,
        });
      } else {
        const { dir } = interaction;
        let { x, y, width, height } = interaction.origin;
        if (dir.includes('e')) width = interaction.origin.width + dx;
        if (dir.includes('s')) height = interaction.origin.height + dy;
        if (dir.includes('w')) {
          width = interaction.origin.width - dx;
          x = interaction.origin.x + dx;
        }
        if (dir.includes('n')) {
          height = interaction.origin.height - dy;
          y = interaction.origin.y + dy;
        }
        width = Math.max(MIN_WIDTH, Math.min(width, metrics.workArea.width));
        height = Math.max(MIN_HEIGHT, Math.min(height, metrics.workArea.height));
        if (x < metrics.workArea.x) {
          width += x - metrics.workArea.x;
          x = metrics.workArea.x;
        }
        if (y < metrics.workArea.y) {
          height += y - metrics.workArea.y;
          y = metrics.workArea.y;
        }
        updateRect(win.id, { x, y, width, height });
      }
      if (!dragging) setDragging(true);
    };
    const onUp = () => {
      const current = useWindows.getState().windows.find((item) => item.id === win.id);
      if (current && interaction.kind === 'move') {
        const metrics = currentMetrics();
        const area = metrics.workArea;
        const nearTop = current.y <= area.y + 4;
        const nearLeft = current.x <= area.x + 4;
        const nearRight = current.x + current.width >= area.x + area.width - 4;
        const nearBottom = current.y + current.height >= area.y + area.height - 4;
        if (!current.maximized && nearTop && nearLeft) {
          snapWindow(win.id, 'top-left');
        } else if (!current.maximized && nearTop && nearRight) {
          snapWindow(win.id, 'top-right');
        } else if (!current.maximized && nearBottom && nearLeft) {
          snapWindow(win.id, 'bottom-left');
        } else if (!current.maximized && nearBottom && nearRight) {
          snapWindow(win.id, 'bottom-right');
        } else if (nearTop && !current.maximized) {
          toggleMaximize(win.id);
        } else if (!current.maximized && (nearLeft || nearRight)) {
          snapWindow(win.id, nearLeft ? 'left' : 'right');
        } else {
          updateRect(win.id, clampRect({ ...current }, area, MIN_WIDTH, MIN_HEIGHT));
        }
      }
      endInteraction();
    };
    window.addEventListener('pointermove', onMove);
    window.addEventListener('pointerup', onUp);
    window.addEventListener('pointercancel', onUp);
    return () => {
      window.removeEventListener('pointermove', onMove);
      window.removeEventListener('pointerup', onUp);
      window.removeEventListener('pointercancel', onUp);
    };
  }, [interaction, win.id, dragging, updateRect, toggleMaximize, endInteraction, snapWindow]);

  const startMove = (event: React.PointerEvent) => {
    if (event.button !== 0) return;
    focusWindow(win.id);
    if (win.maximized) return;
    setInteraction({
      kind: 'move',
      pointerId: event.pointerId,
      startX: event.clientX,
      startY: event.clientY,
      origin: { x: win.x, y: win.y },
    });
  };

  const startResize = (dir: string) => (event: React.PointerEvent) => {
    event.stopPropagation();
    if (win.maximized) return;
    focusWindow(win.id);
    setInteraction({
      kind: 'resize',
      dir,
      pointerId: event.pointerId,
      startX: event.clientX,
      startY: event.clientY,
      origin: { x: win.x, y: win.y, width: win.width, height: win.height },
    });
  };

  const titleMenu = () => {
    menu.open(
      { clientX: win.x + 60, clientY: win.y + 42 },
      [
        {
          id: 'min',
          label: t('Minimize'),
          icon: Minus,
          onClick: () => minimizeWindow(win.id),
        },
        {
          id: 'max',
          label: win.maximized ? t('Restore') : t('Maximize'),
          icon: Maximize2,
          onClick: () => toggleMaximize(win.id),
        },
        { id: 's1', separator: true },
        {
          id: 'left',
          label: t('Tile to the left half'),
          icon: PanelLeft,
          onClick: () => snapWindow(win.id, 'left'),
        },
        {
          id: 'right',
          label: t('Tile to the right half'),
          icon: PanelRight,
          onClick: () => snapWindow(win.id, 'right'),
        },
        {
          id: 'quarter',
          label: t('Tile to a quarter'),
          icon: Columns2,
          onClick: () => snapWindow(win.id, 'top-left'),
        },
        { id: 's2', separator: true },
        ...[1, 2, 3, 4]
          .filter((index) => index !== workspace)
          .map((index) => ({
            id: `ws-${index}`,
            label: t('Move to workspace {n}', { n: index }),
            onClick: () => moveToWorkspace(win.id, index),
          })),
        { id: 's3', separator: true },
        { id: 'close', label: t('Close'), icon: X, danger: true, onClick: () => closeWindow(win.id) },
      ],
    );
  };

  const onThisWorkspace = workspaceOf(win) === workspace;
  const style = {
    left: win.x,
    top: win.y,
    width: win.width,
    height: win.height,
    zIndex: win.zIndex,
    display: win.minimized || !onThisWorkspace ? 'none' : undefined,
  } as const;

  return (
    <>
      <motion.div
        ref={frameRef}
        className={cn(
          'window',
          isActive && 'is-active',
          win.maximized && 'is-maximized',
          win.snapped && 'is-snapped',
          !isActive && 'is-inactive',
        )}
        style={style}
        initial={reduceMotion ? { opacity: 0 } : { opacity: 0, scale: 0.94, y: 12 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        transition={{ duration: 0.18, ease: [0.22, 1, 0.36, 1] }}
        onPointerDown={() => focusWindow(win.id)}
        data-window-id={win.id}
        role="dialog"
        aria-label={win.title}
      >
        <header
          className="window__titlebar"
          onPointerDown={startMove}
          onDoubleClick={() => toggleMaximize(win.id)}
          onContextMenu={(event) => {
            event.preventDefault();
            titleMenu();
          }}
        >
          <div className="window__title">
            <AppIcon appId={win.appId} size="sm" />
            <span className="window__title-text">{win.title}</span>
          </div>
          <div className="window__controls" onPointerDown={(event) => event.stopPropagation()}>
            <button
              className="window__control window__control--min"
              onClick={() => minimizeWindow(win.id)}
              title={t('Minimize')}
              aria-label={t('Minimize')}
            >
              <Minus />
            </button>
            <button
              className="window__control window__control--max"
              onClick={() => toggleMaximize(win.id)}
              title={win.maximized ? t('Restore') : t('Maximize')}
              aria-label={win.maximized ? t('Restore') : t('Maximize')}
            >
              <Maximize2 />
            </button>
            <button
              className="window__control window__control--close"
              onClick={() => closeWindow(win.id)}
              title={t('Close')}
              aria-label={t('Close')}
            >
              <X />
            </button>
          </div>
        </header>
        <div className="window__body">
          <Suspense
            fallback={
              <div className="window__loading" role="status" aria-live="polite">
                <span className="window__loading-spinner" aria-hidden />
                {t('Loading {app}…', { app: t(APP_META[win.appId].name) })}
              </div>
            }
          >
            <AppComponent win={win} />
          </Suspense>
        </div>
        {!win.maximized && (
          <>
            {(['n', 's', 'e', 'w', 'nw', 'ne', 'sw', 'se'] as const).map((dir) => (
              <div
                key={dir}
                className={`window__resize window__resize--${dir}`}
                onPointerDown={startResize(dir)}
              />
            ))}
          </>
        )}
      </motion.div>
      {menu.node}
      {dragging && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            zIndex: 99999,
            cursor: interaction?.kind === 'resize' ? 'nwse-resize' : 'grabbing',
          }}
        />
      )}
    </>
  );
}
