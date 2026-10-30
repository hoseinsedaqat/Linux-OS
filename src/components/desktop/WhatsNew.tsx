import { Sparkles } from 'lucide-react';
import { Modal } from '@/components/common/Modal';
import { useT } from '@/core/localization/i18n';
import { RELEASE } from '@/core/apps/releaseNotes';

interface WhatsNewProps {
  open: boolean;
  onClose: () => void;
}

/**
 * Release notes sheet. Opened from the application menu, and once by itself
 * after an update so a new build explains itself instead of just appearing.
 */
export function WhatsNew({ open, onClose }: WhatsNewProps) {
  const t = useT();

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={`${t("What's new")} — ${RELEASE.version}`}
      icon={<Sparkles size={15} />}
      wide
      footer={
        <button className="btn btn--primary" onClick={onClose}>
          {t('Got it')}
        </button>
      }
    >
      <div className="whatsnew">
        <p className="whatsnew__lead muted small">
          {RELEASE.codename} · {RELEASE.date}
        </p>
        <ul className="whatsnew__list">
          {RELEASE.notes.map((note) => (
            <li key={note.title} className="whatsnew__item">
              <strong>{t(note.title)}</strong>
              <span>{t(note.detail)}</span>
            </li>
          ))}
        </ul>
        <p className="whatsnew__foot tiny faint">
          {t('These notes describe this build only — nothing here is a promise about a future version.')}
        </p>
      </div>
    </Modal>
  );
}
