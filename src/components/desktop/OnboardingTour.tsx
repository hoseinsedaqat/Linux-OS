import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { ArrowLeft, ArrowRight, Check, Command, Grid2x2, LayoutGrid, MousePointerClick, Sparkles } from 'lucide-react';
import { useShell } from '@/core/apps/shellStore';
import { useT } from '@/core/localization/i18n';
import { cn } from '@/utils';

const SEEN_KEY = 'nova.tour.seen';

interface Step {
  icon: typeof Sparkles;
  title: string;
  body: string;
  hint: string;
}

const STEPS: Step[] = [
  {
    icon: Sparkles,
    title: 'Welcome to NOVA Linux',
    body: 'This is a desktop environment that runs entirely in your browser. Nothing here touches your real computer — it is a complete, honest simulation.',
    hint: 'Everything you open, save or delete lives inside this tab.',
  },
  {
    icon: LayoutGrid,
    title: 'The panel and the menu',
    body: 'The panel at the bottom launches applications, switches virtual desktops and holds the quick settings, notifications and clock.',
    hint: 'Click “Applications” on the far left of the panel.',
  },
  {
    icon: Command,
    title: 'Ctrl + K is the fastest way',
    body: 'The command palette searches every installed app and shell action. Arrow keys move, Enter runs, Escape closes.',
    hint: 'Try Ctrl + K, type “term” and press Enter.',
  },
  {
    icon: Grid2x2,
    title: 'Windows that behave',
    body: 'Drag a window to a screen edge or corner to tile it, use Super + arrows, and press Ctrl + Alt + ↑ for the window overview.',
    hint: 'Four virtual desktops are available from the dots in the panel.',
  },
  {
    icon: MousePointerClick,
    title: 'Files that persist',
    body: 'Documents, notes, pictures and game scores are stored in your browser. Export a backup from Settings → Storage whenever you like.',
    hint: 'The Games folder on the desktop starts with four playable games.',
  },
];

function seenBefore(): boolean {
  try {
    return localStorage.getItem(SEEN_KEY) === '1';
  } catch {
    return true;
  }
}

/** First-run tour plus a manual re-open from the shell overlay. */
export function OnboardingTour() {
  const t = useT();
  const open = useShell((state) => state.overlay === 'tour');
  const openOverlay = useShell((state) => state.openOverlay);
  const closeOverlays = useShell((state) => state.closeOverlays);
  const [step, setStep] = useState(0);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    if (seenBefore()) return;
    const timer = window.setTimeout(() => {
      openOverlay('tour');
      setVisible(true);
    }, 900);
    return () => window.clearTimeout(timer);
  }, [openOverlay]);

  useEffect(() => {
    if (open) setVisible(true);
  }, [open]);

  if (!open || typeof document === 'undefined' || !visible) return null;

  const finish = () => {
    try {
      localStorage.setItem(SEEN_KEY, '1');
    } catch {
      /* storage blocked */
    }
    setVisible(false);
    setStep(0);
    closeOverlays();
  };

  const current = STEPS[step];
  const Icon = current.icon;

  return createPortal(
    <div className="tour-backdrop" role="presentation" onMouseDown={finish}>
      <section
        className="tour"
        role="dialog"
        aria-modal="true"
        aria-label={t('Desktop tour')}
        onMouseDown={(event) => event.stopPropagation()}
        onKeyDown={(event) => {
          if (event.key === 'Escape') finish();
          if (event.key === 'ArrowRight' && step < STEPS.length - 1) setStep(step + 1);
          if (event.key === 'ArrowLeft' && step > 0) setStep(step - 1);
        }}
      >
        <div className="tour__icon">
          <Icon size={22} strokeWidth={1.6} />
        </div>
        <h2>{t(current.title)}</h2>
        <p>{t(current.body)}</p>
        <div className="tour__hint">{t(current.hint)}</div>

        <div className="tour__dots" aria-hidden>
          {STEPS.map((_, index) => (
            <span key={index} className={cn('tour__dot', index === step && 'is-active')} />
          ))}
        </div>

        <div className="tour__actions">
          <button className="btn btn--ghost btn--sm" onClick={finish}>
            {t('Skip')}
          </button>
          <div className="row" style={{ gap: 6 }}>
            {step > 0 && (
              <button className="btn btn--sm" onClick={() => setStep(step - 1)}>
                <ArrowLeft size={13} /> {t('Back')}
              </button>
            )}
            {step < STEPS.length - 1 ? (
              <button className="btn btn--primary btn--sm" onClick={() => setStep(step + 1)}>
                {t('Next')} <ArrowRight size={13} />
              </button>
            ) : (
              <button className="btn btn--primary btn--sm" onClick={finish}>
                <Check size={13} /> {t('Start using NOVA')}
              </button>
            )}
          </div>
        </div>
      </section>
    </div>,
    document.body,
  );
}
