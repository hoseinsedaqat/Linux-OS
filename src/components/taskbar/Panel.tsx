import { useEffect, useMemo, useRef, useState } from 'react';
import {
  BatteryMedium,
  Bell,
  ChevronUp,
  LayoutGrid,
  Monitor,
  Power,
  SunMedium,
  Volume2,
  VolumeX,
  Wifi,
  WifiOff,
} from 'lucide-react';
import { APP_META } from '@/core/apps/appMeta';
import { useLauncher } from '@/core/apps/launcherStore';
import { useSettings } from '@/core/themes/settingsStore';
import { WORKSPACE_COUNT, useWindows, workspaceOf } from '@/core/window-manager/windowsStore';
import { useNotifications } from '@/core/notifications/notificationsStore';
import { useShell } from '@/core/apps/shellStore';
import { useClock } from '@/hooks';
import { AppIcon } from '@/components/common/AppIcon';
import { useT } from '@/core/localization/i18n';
import { QuickSettings } from '@/components/quick-settings/QuickSettings';
import { NotificationCenter } from '@/components/notifications/NotificationCenter';
import { CalendarPopover } from '@/components/notifications/CalendarPopover';
import { formatLocalizedDate } from '@/core/localization/i18n';
import type { Metrics } from '@/core/window-manager/metrics';
import { cn } from '@/utils';

interface PanelProps {
  metrics: Metrics;
  onLock: () => void;
  onShutdown: () => void;
  onRestart: () => void;
}

export function Panel({ metrics, onLock, onShutdown, onRestart }: PanelProps) {
  const t = useT();
  const clock = useClock(true);
  const language = useSettings((state) => state.language);
  const clock24h = useSettings((state) => state.clock24h);
  const showSeconds = useSettings((state) => state.showSeconds);
  const panelPosition = useSettings((state) => state.panelPosition);
  const panelAutoHide = useSettings((state) => state.panelAutoHide);
  const showLabels = useSettings((state) => state.dockShowLabels);
  const wifi = useSettings((state) => state.wifi);
  const volume = useSettings((state) => state.volume);
  const brightness = useSettings((state) => state.brightness);
  const setSetting = useSettings((state) => state.set);
  const favorites = useLauncher((state) => state.favorites);
  const installed = useLauncher((state) => state.installed);
  const windows = useWindows((state) => state.windows);
  const activeId = useWindows((state) => state.activeId);
  const openApp = useWindows((state) => state.openApp);
  const focusWindow = useWindows((state) => state.focusWindow);
  const restoreWindow = useWindows((state) => state.restoreWindow);
  const minimizeAll = useWindows((state) => state.minimizeAll);
  const restoreAll = useWindows((state) => state.restoreAll);
  const overlay = useShell((state) => state.overlay);
  const toggleOverlay = useShell((state) => state.toggleOverlay);
  const closeOverlays = useShell((state) => state.closeOverlays);
  const unread = useNotifications((state) => state.items.filter((item) => !item.read).length);
  const [hovered, setHovered] = useState(false);
  const [peek, setPeek] = useState(false);
  const hideTimer = useRef<number | undefined>(undefined);

  useEffect(() => {
    if (!panelAutoHide) {
      setHovered(false);
      setPeek(false);
    }
  }, [panelAutoHide]);

  const hidden = panelAutoHide && !hovered && !peek && overlay === null;

  const pinned = useMemo(
    () => favorites.filter((id) => installed.includes(id)).slice(0, 8),
    [favorites, installed],
  );

  const workspace = useWindows((state) => state.workspace);
  const switchWorkspace = useWindows((state) => state.switchWorkspace);
  const tasks = windows.filter((win) => workspaceOf(win) === workspace && (!win.minimized || win.id === activeId));

  const side = metrics.isMobile ? 'bottom' : panelPosition;
  const style: React.CSSProperties =
    side === 'bottom' || side === 'top'
      ? { height: metrics.panelThickness, ['--panel-h' as string]: `${metrics.panelThickness}px` }
      : { width: 88, ['--panel-h' as string]: `${metrics.panelThickness}px` };

  const popoverStyle = (width = 340): React.CSSProperties => {
    if (side === 'bottom') return { right: 8, bottom: metrics.panelThickness + 8, width };
    if (side === 'top') return { right: 8, top: metrics.panelThickness + 8, width };
    if (side === 'left') return { left: metrics.panelThickness + 8, bottom: 8, width };
    return { right: metrics.panelThickness + 8, bottom: 8, width };
  };

  const openTask = (winId: string, minimized: boolean) => {
    if (minimized) restoreWindow(winId);
    else if (activeId === winId) {
      useWindows.getState().minimizeWindow(winId);
    } else focusWindow(winId);
  };

  const startButton = (
    <button
      className={cn('panel__button panel__start', overlay === 'appmenu' && 'is-active')}
      onClick={() => toggleOverlay('appmenu')}
      title={t('Applications')}
      aria-expanded={overlay === 'appmenu'}
    >
      <span className="panel__avatar">N</span>
      <span>{t('Applications')}</span>
    </button>
  );

  const taskList = (
    <div className="panel__windows">
      {tasks.length === 0 ? (
        <span className="tiny faint" style={{ padding: '0 6px', opacity: 0.6 }}>
          {side === 'left' || side === 'right' ? '' : t('Open windows')}
        </span>
      ) : (
        tasks.map((win) => (
          <button
            key={win.id}
            className={cn('panel__window-btn', activeId === win.id && !win.minimized && 'is-active')}
            onClick={() => openTask(win.id, win.minimized)}
            title={win.title}
          >
            <AppIcon appId={win.appId} size="xs" plain />
            <span>{win.title}</span>
          </button>
        ))
      )}
    </div>
  );

  const workspaceSwitcher = (
    <div className="panel__workspaces" role="group" aria-label={t('Workspaces')}>
      {Array.from({ length: WORKSPACE_COUNT }, (_, index) => index + 1).map((index) => {
        const busy = windows.some((win) => workspaceOf(win) === index);
        return (
          <button
            key={index}
            className={cn('panel__workspace', index === workspace && 'is-active', busy && 'is-busy')}
            onClick={() => switchWorkspace(index)}
            title={`${t('Workspace')} ${index}`}
            aria-label={`${t('Workspace')} ${index}`}
            aria-pressed={index === workspace}
          />
        );
      })}
    </div>
  );

  const tray = (
    <>
      <button className="panel__tray-btn" title={t('Network')} onClick={() => toggleOverlay('quick')}>
        {wifi ? <Wifi size={15} /> : <WifiOff size={15} style={{ color: 'var(--danger)' }} />}
      </button>
      <button
        className="panel__tray-btn"
        title={`${t('Volume')}: ${volume}%`}
        aria-label={`${t('Volume')}: ${volume}%`}
        onClick={() => toggleOverlay('quick')}
        onWheel={(event) => {
          // Mouse wheel over the tray icon adjusts the simulated output volume.
          const delta = event.deltaY > 0 ? -5 : 5;
          const next = Math.min(100, Math.max(0, volume + delta));
          if (next !== volume) setSetting('volume', next);
        }}
      >
        {volume === 0 ? <VolumeX size={15} /> : <Volume2 size={15} />}
      </button>
      <button
        className="panel__tray-btn panel__tray-btn--brightness"
        title={`${t('Brightness')}: ${brightness}%`}
        aria-label={`${t('Brightness')}: ${brightness}%`}
        onClick={() => toggleOverlay('quick')}
        onWheel={(event) => {
          const delta = event.deltaY > 0 ? -5 : 5;
          const next = Math.min(100, Math.max(5, brightness + delta));
          if (next !== brightness) setSetting('brightness', next);
        }}
      >
        <SunMedium size={15} />
      </button>
      <button className="panel__tray-btn" title={`${t('Battery')}: 87%`} onClick={() => openApp('settings', { section: 'storage' })}>
        <BatteryMedium size={16} />
        <span className="tiny numeric" style={{ color: 'var(--text-2)' }}>
          87%
        </span>
      </button>
      <span className="panel__sep" />
      {side !== 'left' && side !== 'right' && workspaceSwitcher}
      <button
        className={cn('panel__tray-btn', overlay === 'quick' && 'is-active')}
        title={t('Quick Settings')}
        onClick={() => toggleOverlay('quick')}
      >
        <ChevronUp size={15} />
      </button>
      <button
        className="panel__tray-btn"
        title={t('Notifications')}
        onClick={() => toggleOverlay('notifications')}
        style={{ position: 'relative' }}
      >
        <Bell size={15} />
        {unread > 0 && <span className="panel__badge">{unread}</span>}
      </button>
      <button
        className="panel__clock panel__button"
        onClick={() => toggleOverlay('calendar')}
        title={formatLocalizedDate(clock, language, { dateStyle: 'full' })}
        aria-label={`${t('Calendar')} — ${formatLocalizedDate(clock, language, { dateStyle: 'full' })}`}
      >
        <span className="panel__clock-time">
          {formatLocalizedDate(clock, language, {
            hour: '2-digit',
            minute: '2-digit',
            ...(showSeconds ? { second: '2-digit' } : {}),
            hour12: !clock24h,
          })}
        </span>
        <span className="panel__clock-date">
          {formatLocalizedDate(clock, language, { month: 'short', day: 'numeric' })}
        </span>
      </button>
      <button
        className="panel__tray-btn panel__tray-btn--desktop"
        title={t('Show Desktop')}
        onClick={() => {
          const anyVisible = windows.some((win) => !win.minimized);
          if (anyVisible) minimizeAll();
          else restoreAll();
          closeOverlays();
        }}
      >
        <Monitor size={15} />
      </button>
    </>
  );

  return (
    <>
      <div
        className={cn('panel', `panel--${side}`, hidden && 'is-hidden')}
        style={style}
        onMouseEnter={() => {
          window.clearTimeout(hideTimer.current);
          setHovered(true);
        }}
        onMouseLeave={() => {
          hideTimer.current = window.setTimeout(() => setHovered(false), 400);
        }}
      >
        <div className="panel__group panel__group--start">
          {startButton}
          <button
            className="panel__button"
            onClick={() => openApp('files')}
            title={t('Computer')}
            aria-label={t('Computer')}
          >
            <AppIcon appId="files" size="sm" plain />
          </button>
          {side !== 'left' && side !== 'right' && (
            <button
              className="panel__button"
              onClick={() => openApp('browser')}
              title={t('Browser')}
              aria-label={t('Browser')}
            >
              <AppIcon appId="browser" size="sm" plain />
            </button>
          )}
        </div>

        {side === 'left' || side === 'right' ? (
          <>
            <div className="panel__group">
              {pinned.map((appId) => (
                <button
                  key={appId}
                  className={cn(
                    'panel__button',
                    windows.some((win) => win.appId === appId && !win.minimized) && 'is-open',
                  )}
                  onClick={(event) => {
                    const existing = windows.find((win) => win.appId === appId);
                    if (existing) {
                      if (existing.minimized) restoreWindow(existing.id);
                      else if (activeId === existing.id) useWindows.getState().minimizeWindow(existing.id);
                      else focusWindow(existing.id);
                    } else {
                      openApp(appId);
                      // Do not leave the keyboard on this button: Enter must reach
                      // the app that was just launched, not launch it again.
                      event.currentTarget.blur();
                    }
                  }}
                  title={t(APP_META[appId].name)}
                >
                  <AppIcon appId={appId} size="xs" plain />
                </button>
              ))}
            </div>
            {taskList}
          </>
        ) : (
          <>
            <div className="panel__group panel__group--center">
              {pinned.map((appId) => (
                <button
                  key={appId}
                  className={cn(
                    'panel__button',
                    windows.some((win) => win.appId === appId && !win.minimized) && 'is-open',
                  )}
                  onClick={(event) => {
                    const existing = windows.find((win) => win.appId === appId);
                    if (existing) {
                      if (existing.minimized) restoreWindow(existing.id);
                      else if (activeId === existing.id) useWindows.getState().minimizeWindow(existing.id);
                      else focusWindow(existing.id);
                    } else {
                      openApp(appId);
                      // Do not leave the keyboard on this button: Enter must reach
                      // the app that was just launched, not launch it again.
                      event.currentTarget.blur();
                    }
                  }}
                  title={t(APP_META[appId].name)}
                >
                  <AppIcon appId={appId} size="sm" plain />
                  {showLabels && <span className="tiny">{t(APP_META[appId].name)}</span>}
                </button>
              ))}
              {pinned.length > 0 && <span className="panel__sep" />}
              {taskList}
            </div>
            <div className="panel__group panel__group--end">{tray}</div>
          </>
        )}

        {side === 'left' || side === 'right' ? (
          <div className="panel__group" style={{ marginTop: 'auto' }}>
            <div className="panel__workspaces panel__workspaces--vertical">{workspaceSwitcher}</div>
            <button className="panel__button" onClick={() => toggleOverlay('notifications')} style={{ position: 'relative' }}>
              <Bell size={16} />
              {unread > 0 && <span className="panel__badge">{unread}</span>}
            </button>
            <button className="panel__button" onClick={() => toggleOverlay('quick')}>
              <LayoutGrid size={16} />
            </button>
            <button className="panel__clock panel__button" onClick={() => toggleOverlay('calendar')}>
              <span className="panel__clock-time">
                {formatLocalizedDate(clock, language, { hour: '2-digit', minute: '2-digit', hour12: !clock24h })}
              </span>
            </button>
            <button className="panel__button" title={t('Power Off')} onClick={onShutdown}>
              <Power size={16} />
            </button>
          </div>
        ) : null}
      </div>

      {panelAutoHide && hidden && (
        <div
          className={cn('panel-edge', `panel-edge--${side}`)}
          onMouseEnter={() => setPeek(true)}
          onMouseLeave={() => setPeek(false)}
        />
      )}

      <QuickSettings
        open={overlay === 'quick'}
        style={popoverStyle(340)}
        onClose={closeOverlays}
        onLock={onLock}
        onShutdown={onShutdown}
        onRestart={onRestart}
      />
      <NotificationCenter open={overlay === 'notifications'} style={popoverStyle(372)} onClose={closeOverlays} />
      <CalendarPopover open={overlay === 'calendar'} style={popoverStyle(340)} onClose={closeOverlays} />
    </>
  );
}
