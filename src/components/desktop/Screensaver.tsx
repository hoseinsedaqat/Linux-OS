import { useEffect, useRef, useState } from 'react';
import { motion } from 'framer-motion';
import { useSettings } from '@/core/themes/settingsStore';
import { useT } from '@/core/localization/i18n';
import { NovaLogo } from '@/components/common/NovaLogo';

/**
 * Screensaver. Off by default (Settings → Accessibility sets a delay in
 * minutes). It appears after the configured idle time, dims the desktop and
 * shows a slowly drifting clock; any key, pointer or wheel dismisses it.
 */
export function Screensaver() {
  const t = useT();
  const minutes = useSettings((state) => state.screensaverMinutes);
  const reduceMotion = useSettings((state) => state.reduceMotion);
  const [active, setActive] = useState(false);
  const [now, setNow] = useState(() => new Date());
  const timer = useRef<number | undefined>(undefined);

  useEffect(() => {
    if (!minutes) {
      setActive(false);
      return;
    }
    const delay = Math.max(30_000, minutes * 60_000);
    const arm = () => {
      window.clearTimeout(timer.current);
      timer.current = window.setTimeout(() => setActive(true), delay);
    };
    arm();
    const onActivity = () => {
      if (active) return;
      arm();
    };
    const events: Array<keyof WindowEventMap> = ['pointerdown', 'pointermove', 'keydown', 'wheel', 'touchstart'];
    events.forEach((event) => window.addEventListener(event, onActivity, { passive: true }));
    return () => {
      window.clearTimeout(timer.current);
      events.forEach((event) => window.removeEventListener(event, onActivity));
    };
  }, [minutes, active]);

  useEffect(() => {
    if (!active) return;
    const tick = window.setInterval(() => setNow(new Date()), 1000);
    const dismiss = () => setActive(false);
    const events: Array<keyof WindowEventMap> = ['pointerdown', 'keydown', 'wheel', 'touchstart'];
    events.forEach((event) => window.addEventListener(event, dismiss, { passive: true, once: true }));
    return () => {
      window.clearInterval(tick);
      events.forEach((event) => window.removeEventListener(event, dismiss));
    };
  }, [active]);

  if (!active) return null;

  const time = now.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit', hour12: false });
  const date = now.toLocaleDateString(undefined, { weekday: 'long', day: 'numeric', month: 'long' });

  return (
    <motion.div
      className="screensaver"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: reduceMotion ? 0 : 0.6 }}
      onClick={() => setActive(false)}
      role="presentation"
    >
      <motion.div
        className="screensaver__inner"
        animate={reduceMotion ? undefined : { x: [0, 34, -22, 0], y: [0, -18, 14, 0] }}
        transition={reduceMotion ? undefined : { duration: 42, repeat: Infinity, ease: 'easeInOut' }}
      >
        <NovaLogo size={46} />
        <div className="screensaver__time">{time}</div>
        <div className="screensaver__date">{date}</div>
        <div className="screensaver__hint">{t('Move the pointer or press a key to return')}</div>
      </motion.div>
    </motion.div>
  );
}
