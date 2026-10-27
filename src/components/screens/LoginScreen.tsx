import { useEffect, useMemo, useRef, useState } from 'react';
import { motion } from 'framer-motion';
import {
  ArrowRight,
  ChevronDown,
  CirclePower,
  Eye,
  EyeOff,
  Globe,
  Keyboard,
  Loader2,
  Lock,
  LockKeyhole,
  RotateCcw,
  ShieldCheck,
  User,
} from 'lucide-react';
import { useSettings } from '@/core/themes/settingsStore';
import { useClock, useOutsideClick } from '@/hooks';
import { useT, formatLocalizedDate } from '@/core/localization/i18n';
import { NovaWordmark } from '@/components/common/NovaLogo';
import { wallpaperClass } from '@/core/themes/applyTheme';
import { cn } from '@/utils';

interface LoginScreenProps {
  mode: 'login' | 'lock';
  onSuccess: () => void;
  onRestart: () => void;
  onShutdown: () => void;
}

const LAYOUTS: Array<{ value: 'us' | 'uk' | 'de' | 'ir'; label: string }> = [
  { value: 'us', label: 'English (US)' },
  { value: 'uk', label: 'English (UK)' },
  { value: 'de', label: 'Deutsch' },
  { value: 'ir', label: 'فارسی' },
];

export function LoginScreen({ mode, onSuccess, onRestart, onShutdown }: LoginScreenProps) {
  const t = useT();
  const language = useSettings((state) => state.language);
  const setSetting = useSettings((state) => state.set);
  const settings = useSettings();
  const reduceMotion = useSettings((state) => state.reduceMotion);
  const clock = useClock(false);
  const [password, setPassword] = useState('');
  const [reveal, setReveal] = useState(false);
  const [capsLock, setCapsLock] = useState(false);
  const [signingIn, setSigningIn] = useState(false);
  const [powerOpen, setPowerOpen] = useState(false);
  const powerRef = useRef<HTMLDivElement | null>(null);
  const inputRef = useRef<HTMLInputElement | null>(null);
  useOutsideClick(powerRef, () => setPowerOpen(false), powerOpen);

  const isRtl = language === 'fa';
  const time = formatLocalizedDate(clock, language, {
    hour: '2-digit',
    minute: '2-digit',
    hour12: !settings.clock24h,
  });
  const date = formatLocalizedDate(clock, language, {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });

  useEffect(() => {
    const timer = window.setTimeout(() => inputRef.current?.focus(), 350);
    return () => window.clearTimeout(timer);
  }, []);

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => setCapsLock(event.getModifierState?.('CapsLock') ?? false);
    window.addEventListener('keydown', onKey);
    window.addEventListener('keyup', onKey);
    return () => {
      window.removeEventListener('keydown', onKey);
      window.removeEventListener('keyup', onKey);
    };
  }, []);

  const submit = (event?: React.FormEvent) => {
    event?.preventDefault();
    if (signingIn) return;
    setSigningIn(true);
    window.setTimeout(
      () => {
        setSigningIn(false);
        setPassword('');
        onSuccess();
      },
      reduceMotion ? 150 : 620,
    );
  };

  const wallpaperStyle = useMemo(() => {
    if (settings.wallpaper === 'custom' && settings.customWallpaper) {
      return { backgroundImage: `url(${settings.customWallpaper})` } as React.CSSProperties;
    }
    return undefined;
  }, [settings.wallpaper, settings.customWallpaper]);

  return (
    <div className="login">
      <div className={cn('wallpaper login__bg', wallpaperClass(settings.wallpaper))} style={wallpaperStyle} />

      <div className="login__corner-logo">
        <NovaWordmark />
      </div>

      <div className={cn('login__stage', isRtl && 'login__stage--rtl')}>
        <motion.div
          className="login__hero"
          initial={reduceMotion ? undefined : { opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, ease: [0.22, 1, 0.36, 1] }}
        >
          <div className="login__clock">{time}</div>
          <div className="login__date">{date}</div>
          <p className="login__quote">
            {mode === 'lock'
              ? t('Session locked') + ' — ' + t('Enter')
              : t('Web Desktop Simulator — not a real operating system')}
          </p>
        </motion.div>

        <motion.form
          className="login__card"
          onSubmit={submit}
          initial={reduceMotion ? undefined : { opacity: 0, y: 18, scale: 0.985 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          transition={{ duration: 0.5, delay: 0.08, ease: [0.22, 1, 0.36, 1] }}
        >
          <div className="login__user">
            <div className="login__avatar">N</div>
            <div className="login__name">{t('Demo User')}</div>
            <div className="login__role">
              {mode === 'lock' ? t('Session locked') : t('Common User')} · NOVA Linux 1.0
            </div>
          </div>

          <div className="login__password">
            <span className="login__password-icon">
              <LockKeyhole size={15} />
            </span>
            <input
              ref={inputRef}
              className="input"
              type={reveal ? 'text' : 'password'}
              value={password}
              placeholder={t('Password')}
              aria-label={t('Password')}
              autoComplete="off"
              onChange={(event) => setPassword(event.target.value)}
            />
            <button
              type="button"
              className="login__reveal"
              onClick={() => setReveal((value) => !value)}
              aria-label={reveal ? 'Hide password' : 'Show password'}
              title={reveal ? 'Hide password' : 'Show password'}
            >
              {reveal ? <EyeOff size={15} /> : <Eye size={15} />}
            </button>
          </div>

          {capsLock && (
            <div className="login__hint login__hint--caps">
              <ShieldCheck size={13} /> {t('Caps Lock is on')}
            </div>
          )}

          <div className="login__hint">
            <Lock size={12} /> {t('Demo mode — any password works. Nothing is stored.')}
          </div>

          <div className="login__actions">
            <button className="login__submit" type="submit" disabled={signingIn}>
              {signingIn ? <Loader2 size={16} className="spin" /> : <ArrowRight size={16} style={isRtl ? { transform: 'scaleX(-1)' } : undefined} />}
              {signingIn ? t('Signing in…') : mode === 'lock' ? t('Unlock') : t('Sign in')}
            </button>
            <button
              type="button"
              className="login__icon-btn"
              onClick={() => setPowerOpen((value) => !value)}
              title={t('Power Off')}
              aria-expanded={powerOpen}
            >
              <CirclePower size={17} />
            </button>
          </div>

          <div className="login__footer">
            <label className="row" style={{ gap: 4 }}>
              <Globe size={11} />
              <select
                className="select"
                value={language}
                aria-label={t('Language')}
                onChange={(event) => setSetting('language', event.target.value as 'en' | 'fa')}
              >
                <option value="en">English</option>
                <option value="fa">فارسی</option>
              </select>
            </label>
            <label className="row" style={{ gap: 4 }}>
              <Keyboard size={11} />
              <select
                className="select"
                value={settings.keyboardLayout}
                aria-label={t('Keyboard layout')}
                onChange={(event) => setSetting('keyboardLayout', event.target.value as 'us' | 'uk' | 'de' | 'ir')}
              >
                {LAYOUTS.map((layout) => (
                  <option key={layout.value} value={layout.value}>
                    {layout.label}
                  </option>
                ))}
              </select>
            </label>
          </div>

          <div className="login__error" role="alert">
            {signingIn ? t('Preparing environment') : ''}
          </div>
        </motion.form>
      </div>

      <div className="login__power" ref={powerRef}>
        {powerOpen && (
          <motion.div
            className="context-menu"
            style={{ position: 'absolute', bottom: 46, insetInlineEnd: 0 }}
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
          >
            <button
              className="context-menu__item"
              onClick={() => {
                setPowerOpen(false);
                onRestart();
              }}
            >
              <span className="context-menu__item-icon">
                <RotateCcw size={14} />
              </span>
              {t('Restart')}
            </button>
            <button
              className="context-menu__item context-menu__item--danger"
              onClick={() => {
                setPowerOpen(false);
                onShutdown();
              }}
            >
              <span className="context-menu__item-icon">
                <CirclePower size={14} />
              </span>
              {t('Shut down')}
            </button>
            <div className="context-menu__sep" />
            <button
              className="context-menu__item"
              onClick={() => {
                setPowerOpen(false);
                onSuccess();
              }}
            >
              <span className="context-menu__item-icon">
                <User size={14} />
              </span>
              {t('Sign in as Demo User')}
            </button>
          </motion.div>
        )}
        <div className="login__footer" style={{ padding: 0 }}>
          <span className="tiny" style={{ opacity: 0.55 }}>
            {t('Web Desktop Simulator')}
          </span>
          <ChevronDown size={12} style={{ opacity: 0.4 }} />
        </div>
      </div>
    </div>
  );
}
