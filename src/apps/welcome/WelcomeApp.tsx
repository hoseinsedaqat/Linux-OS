import {
  ArrowRight,
  FolderOpen,
  Globe2,
  Keyboard,
  NotebookPen,
  Settings2,
  ShieldCheck,
  Sparkles,
  Table2,
  Wallet,
  Gamepad2,
  CloudSun,
  Images,
  Music4,
} from 'lucide-react';
import type { AppWindowProps } from '@/core/apps/types';
import { useWindows } from '@/core/window-manager/windowsStore';
import { useSettings } from '@/core/themes/settingsStore';
import { useT } from '@/core/localization/i18n';
import { NovaLogo } from '@/components/common/NovaLogo';
import { cn } from '@/utils';

export function WelcomeApp({ win }: AppWindowProps) {
  const t = useT();
  const language = useSettings((state) => state.language);
  const set = useSettings((state) => state.set);
  const openApp = useWindows((state) => state.openApp);
  const closeWindow = useWindows((state) => state.closeWindow);

  const features = [
    { appId: 'files' as const, icon: FolderOpen, title: t('Files'), description: t('Browse, organize and edit the simulated file system.') },
    { appId: 'writer' as const, icon: NotebookPen, title: t('Writer'), description: t('Rich text documents with export to TXT and HTML.') },
    { appId: 'calc' as const, icon: Table2, title: t('Calc'), description: t('Spreadsheets with formulas, CSV import/export and formatting.') },
    { appId: 'browser' as const, icon: Globe2, title: t('Browser'), description: t('A simulated browser with tabs, bookmarks and history.') },
    { appId: 'accounting' as const, icon: Wallet, title: t('Accounting'), description: t('Persian-first bookkeeping: invoices, parties, reports.') },
    { appId: 'games' as const, icon: Gamepad2, title: t('Games'), description: t('Four complete games with saved high scores.') },
    { appId: 'music' as const, icon: Music4, title: t('Music'), description: t('A synthesised player with a live visualizer.') },
    { appId: 'photos' as const, icon: Images, title: t('Photos'), description: t('A gallery over the virtual Pictures folder.') },
    { appId: 'weather' as const, icon: CloudSun, title: t('Weather'), description: t('Live forecasts from Open-Meteo.') },
    { appId: 'settings' as const, icon: Settings2, title: t('Settings'), description: t('Personalize appearance, panel, storage and accessibility.') },
  ];

  return (
    <div className="welcome">
      <div className="welcome__hero">
        <NovaLogo size={58} />
        <div>
          <h1 className="welcome__title">{t('Welcome to NOVA Linux')}</h1>
          <p className="welcome__subtitle">{t('A complete, interactive desktop that runs entirely in your browser.')}</p>
        </div>
      </div>

      <div className="welcome__banner">
        <ShieldCheck size={15} />
        {t('Everything you create is saved locally in this browser. Nothing is uploaded anywhere.')}
      </div>

      <div className="welcome__grid">
        {features.map((feature) => (
          <button
            key={feature.appId}
            className="welcome__card"
            onClick={() => {
              openApp(feature.appId);
              closeWindow(win.id);
            }}
          >
            <span className="welcome__card-icon">
              <feature.icon size={17} />
            </span>
            <span>
              <span className="welcome__card-title">{feature.title}</span>
              <span className="welcome__card-desc">{feature.description}</span>
            </span>
          </button>
        ))}
      </div>

      <div className="welcome__row">
        <div className="welcome__tip">
          <Keyboard size={15} />
          <div>
            <div className="welcome__tip-title">{t('Getting started')}</div>
            <div className="tiny faint">
              Ctrl/Cmd + K → {t('Applications')} · Ctrl + Alt + T → {t('Terminal')} · Esc → {t('Close')}
            </div>
          </div>
        </div>
        <div className="welcome__tip">
          <Sparkles size={15} />
          <div>
            <div className="welcome__tip-title">{t('Language')}</div>
            <div className="row" style={{ gap: 6, marginTop: 4 }}>
              <button
                className={cn('chip', language === 'en' && 'is-active')}
                onClick={() => set('language', 'en')}
              >
                English
              </button>
              <button
                className={cn('chip', language === 'fa' && 'is-active')}
                onClick={() => set('language', 'fa')}
              >
                فارسی
              </button>
            </div>
          </div>
        </div>
      </div>

      <div className="welcome__footer">
        <span className="tiny faint">{t('Web Desktop Simulator — not a real operating system')}</span>
        <div className="row" style={{ gap: 8 }}>
          <button
            className="btn btn--sm btn--ghost"
            onClick={() => {
              openApp('settings', { section: 'about' });
              closeWindow(win.id);
            }}
          >
            {t('About this simulator')}
          </button>
          <button
            className="btn btn--sm btn--primary"
            onClick={() => {
              openApp('files');
              closeWindow(win.id);
            }}
          >
            {t('Open Files')} <ArrowRight size={13} />
          </button>
        </div>
      </div>
    </div>
  );
}
