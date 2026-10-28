import { useEffect, useRef, useState } from 'react';
import { motion } from 'framer-motion';
import { NovaLogo } from '@/components/common/NovaLogo';
import { useSettings } from '@/core/themes/settingsStore';
import { useT } from '@/core/localization/i18n';

interface BootScreenProps {
  onComplete: () => void;
  /** Short boot (used after restart or when the user enabled "skip boot"). */
  quick?: boolean;
}

const STEPS = [
  'Initialising web desktop…',
  'Loading window manager…',
  'Mounting virtual file system…',
  'Preparing workspace…',
  'Starting desktop services…',
];

export function BootScreen({ onComplete, quick = false }: BootScreenProps) {
  const t = useT();
  const reduceMotion = useSettings((state) => state.reduceMotion);
  const skipBoot = useSettings((state) => state.skipBoot);
  const [progress, setProgress] = useState(0);
  const [stepIndex, setStepIndex] = useState(0);
  const [log, setLog] = useState<string[]>([]);
  const [done, setDone] = useState(false);
  const completeRef = useRef(onComplete);
  completeRef.current = onComplete;

  const duration = quick || skipBoot ? 1400 : reduceMotion ? 1500 : 3400;

  useEffect(() => {
    const start = performance.now();
    let frame = 0;
    const tick = (now: number) => {
      const elapsed = now - start;
      const ratio = Math.min(elapsed / duration, 1);
      setProgress(Math.round(ratio * 100));
      setStepIndex(Math.min(STEPS.length - 1, Math.floor(ratio * STEPS.length)));
      if (ratio < 1) frame = requestAnimationFrame(tick);
      else setDone(true);
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [duration]);

  useEffect(() => {
    const messages = [
      'nova-firmware: simulated bootloader ready',
      'nova-shell: compositor connected (webgl fallback)',
      'nova-vfs: indexeddb mounted at /home/demo',
      'nova-policy: demo session, no credentials stored',
    ];
    const timers = messages.map((message, index) =>
      window.setTimeout(() => setLog((current) => [...current.slice(-3), message]), 520 + index * Math.max(320, duration / 6)),
    );
    return () => timers.forEach((timer) => window.clearTimeout(timer));
  }, [duration]);

  const finish = () => {
    completeRef.current();
  };

  useEffect(() => {
    if (!done) return;
    const timer = window.setTimeout(() => completeRef.current(), reduceMotion ? 120 : 380);
    return () => window.clearTimeout(timer);
  }, [done, reduceMotion]);

  useEffect(() => {
    const onKey = () => {
      completeRef.current();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  return (
    <div className="boot" onPointerDown={finish} role="status" aria-live="polite">
      <div className="boot__post" aria-hidden>
        <span>NOVA Firmware 1.0 — Web Virtual Machine</span>
        <span>4096 MB RAM · virtual display · simulated hardware</span>
      </div>

      <motion.div
        className="boot__logo"
        initial={reduceMotion ? { opacity: 1 } : { opacity: 0, scale: 0.86 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 0.7, ease: [0.22, 1, 0.36, 1] }}
      >
        <span className="boot__ring" />
        <span className="boot__ring boot__ring--2" />
        <span className="boot__mark">
          <NovaLogo size={62} />
        </span>
      </motion.div>

      <motion.div
        className="boot__title"
        initial={reduceMotion ? { opacity: 1 } : { opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.18, duration: 0.5 }}
      >
        <div className="boot__name">
          NOVA<span>LINUX</span>
        </div>
        <div className="boot__tagline">{t('Web Desktop Simulator')}</div>
      </motion.div>

      <div className="boot__progress" aria-hidden="true">
        <div className="boot__progress-fill" style={{ width: `${progress}%` }} />
      </div>

      <div className="boot__status">
        <span>{t(STEPS[stepIndex])}</span>
        <span className="boot__dots">
          <i />
          <i />
          <i />
        </span>
      </div>

      <div className="boot__log">
        {log.map((line) => (
          <span key={line}>{line}</span>
        ))}
      </div>

      <div className="boot__footer">{t('Firmware simulation — not a real bootloader')}</div>

      <button
        className="boot__skip"
        onClick={(event) => {
          event.stopPropagation();
          completeRef.current();
        }}
      >
        {t('Skip')} →
      </button>
    </div>
  );
}
