import { createPortal } from 'react-dom';
import { AnimatePresence, motion } from 'framer-motion';
import {
  Bluetooth,
  ChevronRight,
  Moon,
  Power,
  Settings2,
  Sun,
  SunMedium,
  Volume2,
  Wifi,
  Lock,
  BellOff,
  BatteryFull,
  Monitor,
  RotateCcw,
} from 'lucide-react';
import { useSettings } from '@/core/themes/settingsStore';
import { useWindows } from '@/core/window-manager/windowsStore';
import { useShell } from '@/core/apps/shellStore';
import { useT } from '@/core/localization/i18n';
import { SliderRow } from '@/components/common/Controls';
import { cn } from '@/utils';

interface QuickSettingsProps {
  open: boolean;
  style: React.CSSProperties;
  onClose: () => void;
  onLock: () => void;
  onShutdown: () => void;
  onRestart: () => void;
}

export function QuickSettings({ open, style, onClose, onLock, onShutdown, onRestart }: QuickSettingsProps) {
  const t = useT();
  const settings = useSettings();
  const reduceMotion = useSettings((state) => state.reduceMotion);
  const closeOverlays = useShell((state) => state.closeOverlays);
  const openApp = useWindows((state) => state.openApp);

  if (typeof document === 'undefined') return null;

  const goSettings = (section?: string) => {
    openApp('settings', section ? { section } : undefined);
    onClose();
  };

  return createPortal(
    <AnimatePresence>
      {open && (
        <>
          <div
            style={{ position: 'fixed', inset: 0, zIndex: 8400 }}
            onMouseDown={() => {
              closeOverlays();
            }}
          />
          <motion.div
            className="popover"
            style={{ ...style, zIndex: 8500 }}
            initial={reduceMotion ? { opacity: 0 } : { opacity: 0, y: 10, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={reduceMotion ? { opacity: 0 } : { opacity: 0, y: 8, scale: 0.985 }}
            transition={{ duration: 0.18, ease: [0.22, 1, 0.36, 1] }}
            role="dialog"
            aria-label={t('Quick Settings')}
          >
            <div className="popover__header">
              <div className="row" style={{ gap: 8 }}>
                <span className="panel__avatar" style={{ width: 26, height: 26 }}>
                  N
                </span>
                <div style={{ display: 'flex', flexDirection: 'column', lineHeight: 1.25 }}>
                  <strong style={{ fontSize: 12 }}>{t('Demo User')}</strong>
                  <span className="tiny faint">{t('NOVA Linux 1.0')}</span>
                </div>
              </div>
              <button className="icon-btn" onClick={() => goSettings()} title={t('Settings')}>
                <Settings2 size={15} />
              </button>
            </div>

            <div className="qs">
              <div className="qs__grid">
                <button
                  className={cn('qs__tile', settings.wifi && 'is-on')}
                  onClick={() => settings.set('wifi', !settings.wifi)}
                >
                  <span className="qs__tile-icon">
                    <Wifi size={15} />
                  </span>
                  <span className="qs__tile-text">
                    <span className="qs__tile-title">{settings.wifi ? t('Connected — simulated') : t('Off — simulated')}</span>
                    <span className="qs__tile-sub">{t('Wireless & Network')}</span>
                  </span>
                </button>
                <button
                  className={cn('qs__tile', settings.bluetooth && 'is-on')}
                  onClick={() => settings.set('bluetooth', !settings.bluetooth)}
                >
                  <span className="qs__tile-icon">
                    <Bluetooth size={15} />
                  </span>
                  <span className="qs__tile-text">
                    <span className="qs__tile-title">{settings.bluetooth ? t('On — simulated') : t('Off — simulated')}</span>
                    <span className="qs__tile-sub">Bluetooth</span>
                  </span>
                </button>
                <button
                  className={cn('qs__tile', settings.theme === 'dark' && 'is-on')}
                  onClick={() => settings.set('theme', settings.theme === 'dark' ? 'light' : 'dark')}
                >
                  <span className="qs__tile-icon">
                    {settings.theme === 'dark' ? <Moon size={15} /> : <Sun size={15} />}
                  </span>
                  <span className="qs__tile-text">
                    <span className="qs__tile-title">{settings.theme === 'dark' ? t('Dark Mode') : t('Light Mode')}</span>
                    <span className="qs__tile-sub">{t('Appearance')}</span>
                  </span>
                </button>
                <button
                  className={cn('qs__tile', settings.dnd && 'is-on')}
                  onClick={() => settings.set('dnd', !settings.dnd)}
                >
                  <span className="qs__tile-icon">
                    <BellOff size={15} />
                  </span>
                  <span className="qs__tile-text">
                    <span className="qs__tile-title">{t('Do Not Disturb')}</span>
                    <span className="qs__tile-sub">{settings.dnd ? t('On — simulated') : t('Off — simulated')}</span>
                  </span>
                </button>
              </div>

              <SliderRow
                label={
                  <>
                    <SunMedium size={13} /> {t('Brightness')}
                  </>
                }
                value={settings.brightness}
                onChange={(value) => settings.set('brightness', value)}
                format={(value) => `${value}%`}
              />
              <SliderRow
                label={
                  <>
                    <Volume2 size={13} /> {t('Volume')}
                  </>
                }
                value={settings.volume}
                onChange={(value) => settings.set('volume', value)}
                format={(value) => `${value}%`}
              />

              <div className="qs__grid">
                <button className="qs__tile" onClick={() => goSettings('display')}>
                  <span className="qs__tile-icon">
                    <Monitor size={15} />
                  </span>
                  <span className="qs__tile-text">
                    <span className="qs__tile-title">{t('Display')}</span>
                    <span className="qs__tile-sub">{t('Scale & resolution')}</span>
                  </span>
                </button>
                <button className="qs__tile" onClick={() => goSettings('storage')}>
                  <span className="qs__tile-icon">
                    <BatteryFull size={15} />
                  </span>
                  <span className="qs__tile-text">
                    <span className="qs__tile-title">87% · {t('Battery')}</span>
                    <span className="qs__tile-sub">{t('Simulated')}</span>
                  </span>
                </button>
              </div>
            </div>

            <div className="qs__footer">
              <button className="btn btn--sm btn--ghost" onClick={onLock}>
                <Lock size={13} /> {t('Lock Screen')}
              </button>
              <div className="row" style={{ gap: 4 }}>
                <button className="btn btn--sm btn--ghost" onClick={() => goSettings()}>
                  {t('Settings')} <ChevronRight size={13} />
                </button>
                <button className="icon-btn" title={t('Restart')} onClick={onRestart}>
                  <RotateCcw size={15} />
                </button>
                <button
                  className="icon-btn"
                  title={t('Power Off')}
                  onClick={() => {
                    onShutdown();
                  }}
                >
                  <Power size={16} />
                </button>
              </div>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>,
    document.body,
  );
}
