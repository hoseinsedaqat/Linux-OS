import { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { CirclePower, RotateCcw } from 'lucide-react';
import { useSettings } from '@/core/themes/settingsStore';
import { applyTheme } from '@/core/themes/applyTheme';
import { useFiles } from '@/core/virtual-filesystem/fsStore';
import { isStorageUnavailable } from '@/core/persistence/db';
import { useUiStatus } from '@/core/persistence/kvStore';
import { useShell } from '@/core/apps/shellStore';
import { useWindows } from '@/core/window-manager/windowsStore';
import { BootScreen } from '@/components/screens/BootScreen';
import { LoginScreen } from '@/components/screens/LoginScreen';
import { Desktop } from '@/components/desktop/Desktop';
import { NovaLogo } from '@/components/common/NovaLogo';
import { Toasts } from '@/components/common/Toasts';
import { useT } from '@/core/localization/i18n';
import { APP_META } from '@/core/apps/appMeta';
import type { AppId } from '@/types';
import { playSound } from '@/core/audio/sfx';

type Phase = 'boot' | 'login' | 'desktop' | 'locked' | 'shutdown' | 'restarting' | 'off';

const SESSION_KEY = 'nova.session';

function initialPhase(): Phase {
  try {
    const session = sessionStorage.getItem(SESSION_KEY);
    if (session === 'active') return 'desktop';
    if (session === 'locked') return 'locked';
  } catch {
    /* storage blocked */
  }
  return 'boot';
}

export default function App() {
  const t = useT();
  const settings = useSettings();
  const setStorageWarning = useUiStatus((state) => state.setStorageWarning);
  const [phase, setPhase] = useState<Phase>(initialPhase);
  const [quickBoot, setQuickBoot] = useState(false);

  /* Theme + direction are driven by the settings store (localStorage). */
  useEffect(() => {
    applyTheme(settings);
  }, [settings]);

  /* PWA shortcuts open ./?app=<id>; consume it once the desktop is visible. */
  useEffect(() => {
    if (phase !== 'desktop') return;
    const params = new URLSearchParams(window.location.search);
    const requested = params.get('app');
    if (!requested) return;
    if (requested in APP_META) {
      useWindows.getState().openApp(requested as AppId);
    }
    params.delete('app');
    const query = params.toString();
    window.history.replaceState({}, '', `${window.location.pathname}${query ? `?${query}` : ''}${window.location.hash}`);
  }, [phase]);

  /* Mount the virtual file system once. */
  useEffect(() => {
    void useFiles.getState().init();
  }, []);

  useEffect(() => {
    const filesError = useFiles.getState().error;
    setStorageWarning(isStorageUnavailable() || Boolean(filesError));
  }, [setStorageWarning, phase]);

  /* Global keyboard shortcuts for the shell. */
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      const inDesktop = phase === 'desktop';
      const mod = event.ctrlKey || event.metaKey;
      const target = event.target as HTMLElement | null;
      const typing = Boolean(target?.closest('input, textarea, select, [contenteditable="true"]'));
      if (mod && event.key.toLowerCase() === 'k') {
        event.preventDefault();
        if (inDesktop) useShell.getState().togglePalette();
        return;
      }
      if (event.ctrlKey && event.altKey && event.key === 'ArrowUp') {
        event.preventDefault();
        if (inDesktop) useShell.getState().openOverlay('overview');
        return;
      }
      if (event.ctrlKey && event.altKey && (event.key === 'ArrowLeft' || event.key === 'ArrowRight')) {
        event.preventDefault();
        if (inDesktop) useWindows.getState().cycleWorkspace(event.key === 'ArrowLeft' ? -1 : 1);
        return;
      }
      if (event.metaKey && !typing && inDesktop && /^Arrow(Left|Right|Up|Down)$/.test(event.key)) {
        event.preventDefault();
        const { activeId, snapWindow, toggleMaximize, minimizeWindow, unsnap, windows } = useWindows.getState();
        const active = windows.find((win) => win.id === activeId);
        if (!active) return;
        if (event.key === 'ArrowLeft') snapWindow(active.id, 'left');
        else if (event.key === 'ArrowRight') snapWindow(active.id, 'right');
        else if (event.key === 'ArrowUp') toggleMaximize(active.id);
        else {
          if (active.snapped) unsnap(active.id);
          else minimizeWindow(active.id);
        }
        return;
      }
      if (event.ctrlKey && event.altKey && event.key.toLowerCase() === 't') {
        event.preventDefault();
        if (inDesktop) {
          useShell.getState().closeOverlays();
          useWindows.getState().openApp('terminal');
        }
        return;
      }
      if (event.ctrlKey && event.altKey && event.key.toLowerCase() === 'l') {
        event.preventDefault();
        if (inDesktop) {
          try {
            sessionStorage.setItem(SESSION_KEY, 'locked');
          } catch {
            /* storage blocked */
          }
          useShell.getState().closeOverlays();
          setPhase('locked');
        }
        return;
      }
      if (event.key === 'Escape') {
        useShell.getState().closeOverlays();
      }
      if (event.altKey && event.key === 'Tab' && inDesktop) {
        event.preventDefault();
        const { windows, activeId, focusWindow } = useWindows.getState();
        const visible = windows.filter((win) => !win.minimized);
        if (visible.length > 1) {
          const index = visible.findIndex((win) => win.id === activeId);
          focusWindow(visible[(index + 1) % visible.length].id);
        }
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [phase]);

  const signIn = () => {
    try {
      sessionStorage.setItem(SESSION_KEY, 'active');
    } catch {
      /* ignore */
    }
    playSound('boot');
    setPhase('desktop');
  };

  const lock = () => {
    try {
      sessionStorage.setItem(SESSION_KEY, 'locked');
    } catch {
      /* ignore */
    }
    playSound('lock');
    useShell.getState().closeOverlays();
    setPhase('locked');
  };

  const shutdown = () => {
    useShell.getState().closeOverlays();
    setPhase('shutdown');
    window.setTimeout(() => {
      try {
        sessionStorage.removeItem(SESSION_KEY);
      } catch {
        /* ignore */
      }
      setPhase('off');
    }, settings.reduceMotion ? 250 : 1500);
  };

  const restart = () => {
    useShell.getState().closeOverlays();
    setPhase('restarting');
    window.setTimeout(() => {
      try {
        sessionStorage.clear();
      } catch {
        /* ignore */
      }
      useWindows.setState({ windows: [], activeId: null, nextZ: 120 });
      setQuickBoot(true);
      setPhase('boot');
    }, settings.reduceMotion ? 250 : 1400);
  };

  const powerOn = () => {
    try {
      sessionStorage.removeItem(SESSION_KEY);
    } catch {
      /* ignore */
    }
    setQuickBoot(false);
    setPhase('boot');
  };

  return (
    <>
      {phase === 'boot' && <BootScreen onComplete={() => setPhase('login')} quick={quickBoot} />}

      {(phase === 'login' || phase === 'locked') && (
        <LoginScreen
          mode={phase === 'locked' ? 'lock' : 'login'}
          onSuccess={signIn}
          onRestart={restart}
          onShutdown={shutdown}
        />
      )}

      {phase === 'desktop' && <Desktop onLock={lock} onShutdown={shutdown} onRestart={restart} />}

      {(phase === 'shutdown' || phase === 'restarting') && (
        <motion.div className="poweroff" initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.25 }}>
          <NovaLogo size={54} />
          <div className="row" style={{ color: 'var(--text-2)' }}>
            <span className="poweroff__spinner" />
            <span>{phase === 'shutdown' ? t('Shutting down…') : t('Restarting…')}</span>
          </div>
          <div className="tiny faint">{t('Web Desktop Simulator')}</div>
        </motion.div>
      )}

      {phase === 'off' && (
        <div className="poweroff">
          <NovaLogo size={46} monochrome />
          <p className="small faint" style={{ maxWidth: 320, textAlign: 'center' }}>
            {t('The simulated desktop is powered off. Your saved files remain in this browser.')}
          </p>
          <button className="btn btn--primary" onClick={powerOn}>
            <CirclePower size={15} /> {t('Power on')}
          </button>
          <button
            className="btn btn--ghost btn--sm"
            onClick={() => {
              powerOn();
              setQuickBoot(true);
            }}
          >
            <RotateCcw size={13} /> {t('Restart')}
          </button>
        </div>
      )}

      <Toasts />
    </>
  );
}
