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

/** Hardware report shown like a firmware POST table (all values are simulated). */
const SPECS = [
  { label: 'CPU', value: 'NOVA Virtual Core · 2 threads' },
  { label: 'Memory', value: '4096 MB · browser heap' },
  { label: 'Display', value: 'Virtual framebuffer · CSS compositor' },
  { label: 'Storage', value: 'IndexedDB · /home/demo' },
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
      <div className="boot__aurora" aria-hidden />
      <div className="boot__scanlines" aria-hidden />

      <div className="boot__post" aria-hidden>
        <span>NOVA Firmware 1.0 — Web Virtual Machine</span>
        <span>
          4096 MB RAM · virtual display · simulated hardware
          <span className="boot__cursor" />
        </span>
      </div>

      <div className="boot__spec" aria-hidden>
        {SPECS.map((spec, index) => (
          <div
            className="boot__spec-row"
            key={spec.label}
            style={{ animationDelay: `${0.25 + index * 0.18}s` }}
          >
            <span className="boot__spec-label">{spec.label}</span>
            <span className="boot__spec-value">{spec.value}</span>
          </div>
        ))}
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

      <div className="boot__meter">
        <div className="boot__progress" aria-hidden="true">
          <div className="boot__progress-fill" style={{ width: `${progress}%` }} />
        </div>
        <span className="boot__percent">{progress}%</span>
      </div>

      <div className="boot__status">
        <span>{t(STEPS[stepIndex])}</span>
        <span className="boot__dots">
          <i />
          <i />
          <i />
        </span>
      </div>

      {/* systemd-style service checklist */}
      <div className="boot__checks" aria-hidden>
        {STEPS.map((step, index) => (
          <div
            className={`boot__check${index < stepIndex ? ' is-done' : ''}${index === stepIndex ? ' is-active' : ''}`}
            key={step}
            style={{ animationDelay: `${0.15 + index * 0.1}s` }}
          >
            <span className="boot__check-icon">{index < stepIndex ? '✓' : index === stepIndex ? '›' : '·'}</span>
            <span className="boot__check-text">{t(step)}</span>
          </div>
        ))}
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
