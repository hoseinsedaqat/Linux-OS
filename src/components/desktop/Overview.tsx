import { useEffect } from 'react';
import { createPortal } from 'react-dom';
import { ArrowRightLeft, Maximize2, Minimize2, X } from 'lucide-react';
import { useWindows, WORKSPACE_COUNT, workspaceOf } from '@/core/window-manager/windowsStore';
import { useShell } from '@/core/apps/shellStore';
import { useT } from '@/core/localization/i18n';
import { AppIcon } from '@/components/common/AppIcon';
import { cn } from '@/utils';

/**
 * Overview (Exposé). It lists every open window with its real size and
 * workspace and lets you focus, minimize or close it. It deliberately does not
 * pretend to be a live screenshot of the window content.
 */
export function Overview() {
  const t = useT();
  const open = useShell((state) => state.overlay === 'overview');
  const closeOverlays = useShell((state) => state.closeOverlays);
  const windows = useWindows((state) => state.windows);
  const workspace = useWindows((state) => state.workspace);
  const switchWorkspace = useWindows((state) => state.switchWorkspace);
  const focusWindow = useWindows((state) => state.focusWindow);
  const restoreWindow = useWindows((state) => state.restoreWindow);
  const minimizeWindow = useWindows((state) => state.minimizeWindow);
  const closeWindow = useWindows((state) => state.closeWindow);
  const moveToWorkspace = useWindows((state) => state.moveToWorkspace);

  useEffect(() => {
    if (!open) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') closeOverlays();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, closeOverlays]);

  if (!open || typeof document === 'undefined') return null;

  const openOnWorkspace = (index: number) => windows.filter((win) => workspaceOf(win) === index);

  return createPortal(
    <div className="overview" role="dialog" aria-modal="true" aria-label={t('Window overview')}>
      <header className="overview__head">
        <div>
          <h2>{t('Window overview')}</h2>
          <p>{t('{count} windows across {total} workspaces', { count: windows.length, total: WORKSPACE_COUNT })}</p>
        </div>
        <button className="btn btn--ghost btn--sm" onClick={closeOverlays}>
          {t('Close')} · Esc
        </button>
      </header>

      <div className="overview__workspaces">
        {Array.from({ length: WORKSPACE_COUNT }, (_, i) => i + 1).map((index) => {
          const count = openOnWorkspace(index).length;
          return (
            <button
              key={index}
              className={cn('overview__workspace', index === workspace && 'is-active')}
              onClick={() => {
                switchWorkspace(index);
                closeOverlays();
              }}
            >
              <span className="overview__workspace-count">{count}</span>
              <span>{t('Workspace')} {index}</span>
            </button>
          );
        })}
      </div>

      {windows.length === 0 ? (
        <div className="overview__empty">{t('No windows are open. Launch an app to see it here.')}</div>
      ) : (
        <div className="overview__grid">
          {windows
            .slice()
            .sort((a, b) => workspaceOf(a) - workspaceOf(b) || b.zIndex - a.zIndex)
            .map((win) => (
              <article
                key={win.id}
                className={cn(
                  'overview__card',
                  workspaceOf(win) === workspace && 'is-current-workspace',
                  win.minimized && 'is-minimized',
                )}
              >
                <div className="overview__card-head">
                  <AppIcon appId={win.appId} size="sm" plain />
                  <strong className="truncate">{win.title}</strong>
                </div>
                <button
                  className="overview__preview"
                  onClick={() => {
                    if (workspaceOf(win) !== workspace) switchWorkspace(workspaceOf(win));
                    if (win.minimized) restoreWindow(win.id);
                    focusWindow(win.id);
                    closeOverlays();
                  }}
                  aria-label={t('Focus {title}', { title: win.title })}
                >
                  <span className="overview__preview-shape" style={{ aspectRatio: `${win.width} / ${win.height}` }} />
                  <span className="overview__preview-meta">
                    {win.width}×{win.height} · {t('Workspace')} {workspaceOf(win)}
                    {win.minimized ? ` · ${t('Minimized')}` : ''}
                  </span>
                </button>
                <div className="overview__card-actions">
                  <button
                    className="icon-btn"
                    title={win.minimized ? t('Restore') : t('Minimize')}
                    onClick={() => (win.minimized ? restoreWindow(win.id) : minimizeWindow(win.id))}
                  >
                    {win.minimized ? <Maximize2 size={13} /> : <Minimize2 size={13} />}
                  </button>
                  <button
                    className="icon-btn"
                    title={t('Move to next workspace')}
                    onClick={() => moveToWorkspace(win.id, (workspaceOf(win) % WORKSPACE_COUNT) + 1)}
                  >
                    <ArrowRightLeft size={13} />
                  </button>
                  <button className="icon-btn" title={t('Close')} onClick={() => closeWindow(win.id)}>
                    <X size={13} />
                  </button>
                </div>
              </article>
            ))}
        </div>
      )}
    </div>,
    document.body,
  );
}
