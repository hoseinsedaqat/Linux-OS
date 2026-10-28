import { useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { AnimatePresence, motion } from 'framer-motion';
import { SunMedium, Volume1, Volume2, VolumeX } from 'lucide-react';
import { useOsd } from '@/core/apps/osdStore';
import { useSettings } from '@/core/themes/settingsStore';
import { useT } from '@/core/localization/i18n';

function volumeIcon(value: number) {
  if (value === 0) return VolumeX;
  if (value < 45) return Volume1;
  return Volume2;
}

/**
 * Watches the settings store and surfaces a short OSD whenever the simulated
 * volume or brightness changes — no matter which surface changed it (panel,
 * quick settings, Settings app or keyboard shortcut). Keeping the watcher here
 * means there is exactly one place that mirrors those two values.
 */
export function Osd() {
  const t = useT();
  const { kind, value, nonce, show, hide } = useOsd();
  const previous = useRef<{ volume: number; brightness: number } | null>(null);

  useEffect(() => {
    const state = useSettings.getState();
    previous.current = { volume: state.volume, brightness: state.brightness };
    const unsubscribe = useSettings.subscribe((next) => {
      const last = previous.current;
      if (!last) return;
      if (next.volume !== last.volume) {
        last.volume = next.volume;
        show('volume', next.volume);
      }
      if (next.brightness !== last.brightness) {
        last.brightness = next.brightness;
        show('brightness', next.brightness);
      }
    });
    return unsubscribe;
  }, [show]);

  useEffect(() => {
    if (!kind) return;
    const timer = window.setTimeout(() => hide(), 1400);
    return () => window.clearTimeout(timer);
  }, [kind, value, nonce, hide]);

  if (typeof document === 'undefined') return null;

  const Icon = kind === 'brightness' ? SunMedium : volumeIcon(value);
  const label = kind === 'brightness' ? t('Brightness') : t('Volume');

  return createPortal(
    <AnimatePresence>
      {kind && (
        <motion.div
          key="osd"
          className="osd"
          initial={{ opacity: 0, y: 10, scale: 0.97 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: 6, scale: 0.98 }}
          transition={{ duration: 0.16, ease: [0.22, 1, 0.36, 1] }}
          role="status"
          aria-live="polite"
          data-kind={kind}
        >
          <div className="osd__head">
            <span className="osd__icon">
              <Icon size={15} strokeWidth={2.1} />
            </span>
            <span className="osd__label">{label}</span>
            <span className="osd__value numeric">{value}%</span>
          </div>
          <div className="osd__track">
            <motion.span
              className="osd__fill"
              initial={false}
              animate={{ width: `${value}%` }}
              transition={{ duration: 0.12, ease: 'linear' }}
            />
          </div>
        </motion.div>
      )}
    </AnimatePresence>,
    document.body,
  );
}
